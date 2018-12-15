const Express = require("express");
const config = require("./config");
const app = module.exports = Express();

app.get('/config?/config/version', function (req, res) {
    console.log('config');

    config.getLatestVersion()
        .then(version => {
            res.json( { version: {this: config.thisVersion, latest: version} } );
        })
        .catch(error => {
            res.status(500).json( { response: error, error: error } );
        })
});

app.get('/config/version/this', function (req, res) {
    console.log('/config/version/this');
    res.json( { version: config.thisVersion } );
});

app.get('/config/version/lastest', function (req, res) {
    console.log('/config/version/lastest');

    config.getLatestVersion()
        .then(version => {
            res.json( { version: version } );
        })
        .catch(error => {
            res.status(500).json( { response: error, error: error } );
        })
});