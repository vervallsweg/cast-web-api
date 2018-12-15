const Express = require("express");
const GoogleAssistant = require("./google-assistant");
const app = module.exports = Express();
const assistant = new GoogleAssistant();

app.get('/assistant', function (req, res) {
    res.json(assistant.status());
});

app.get('/assistant/broadcast/:message', function (req, res) {
    console.log('/assistant/broadcast/:message');

    assistant.broadcast( req.params.message )
        .then(response => {
            res.json( { response: response } );
        })
        .catch(error => {
            res.statusCode = 500;
            res.json( { response: 'error', error: error } );
        });
});

app.get('/assistant/command/:query', function (req, res) {
    console.log('/assistant/command/:query');

    assistant.command( req.params.message )
        .then(response => {
            res.json( { response: response } );
        })
        .catch(error => {
            res.statusCode = 500;
            res.json( { response: 'error', error: error } );
        });
});