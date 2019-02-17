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

app.get('/config/version/latest', function (req, res) {
    console.log('/config/version/latest');

    config.getLatestVersion()
        .then(version => {
            res.json( { version: version } );
        })
        .catch(error => {
            res.status(500).json( { response: error, error: error } );
        })
});

app.get('/config/debug', function (req, res) {
    console.log('/config/debug/');
    res.json( { debug: config.debug } );
});

app.get('/config/debug/:target', function (req, res) {
    console.log('/config/debug/:target + '+req.params.target);
    config.debug = req.params.target;
    res.json( { response: 'ok' } );
});