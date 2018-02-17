const express = require('express');
const bodyParser = require('body-parser');
const requestp = require('request-promise-native');

const app = express();

app.use(bodyParser.json())

app.get('/', (req, res) => res.send('Hello World!'));

app.get('/webhook', (req, res) => {

    // Your verify token. Should be a random string.
    // It lives in BITCOIN_BOT_SECRET environment variable
    let VERIFY_TOKEN = process.env.BITCOIN_BOT_SECRET

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});

app.post('/webhook', (req, res) => {

    let body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function (entry) {

            // Gets the message. entry.messaging is an array, but 
            // will only ever contain one message, so we get index 0
            let webhook_event = entry.messaging[0];
            checkLUIS(webhook_event.message.text).then(answer => {
                if (answer === 'price') {
                    sendFBMessage(webhook_event.sender.id, 'Wait a second, let me take a look...');
                    getBTCPrice().then(priceData => {
                        const btcPriceAnswer = `$ ${priceData.bpi.USD.rate} USD, Updated: ${priceData.time.updated}. ${priceData.disclaimer}`;
                        sendFBMessage(webhook_event.sender.id, btcPriceAnswer);
                    });
                } else {
                    sendFBMessage(webhook_event.sender.id, answer);
                }
            });
            console.log(webhook_event);
        });

        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});

function sendFBMessage(recipientId, text) {
    const options = {
        method: 'POST',
        uri: `https://graph.facebook.com/v2.6/me/messages?access_token=${process.env.FB_PAGE_TOKEN}`,
        body: {
            "recipient": {
                "id": recipientId
            },
            "message": {
                "text": text
            }
        },
        json: true // Automatically stringifies the body to JSON
    };

    requestp(options)
        .catch(function (error) {
            console.log(error);
        });
}

function checkLUIS(question) {
    console.log('Question', question);
    const options = {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': process.env.MS_KB_KEY
          },
        uri: `https://westus.api.cognitive.microsoft.com/qnamaker/v2.0/knowledgebases/${process.env.MS_KB_ID}/generateAnswer`,
        body: { question },
        json: true // Automatically stringifies the body to JSON
    };

    return requestp(options)
        .then(function (parsedBody) {
            console.log(parsedBody)
            return parsedBody.answers[0].answer;
        })
        .catch(function (error) {
            console.log(error);
        });
}

function getBTCPrice() {
    const options = {
        method: 'GET',
        uri: 'https://api.coindesk.com/v1/bpi/currentprice.json',
        json: true // Automatically stringifies the body to JSON
    };
    return requestp(options);
}

app.listen(process.env.PORT || 3000, () => console.log('Example app listening on port 3000!'));
