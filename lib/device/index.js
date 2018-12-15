const Exoress = require("express");
const CastManager = require("./cast-manager");
const app = module.exports = Exoress();
const castManager = new CastManager();
const util = require('util');
const logger = require('../log/logger');

app.get('/device', function (req, res) {
    res.send( castManager.getDevices('all') );
});

app.get('/device/connected', function (req, res) {
    res.send( getDevices('connected') );
});

app.get('/device/disconnected', function (req, res) {
    res.send( getDevices('disconnected') );
});

app.get('/device/:id*', function (req, res, next) {
    castManager.getDeviceConnected(req.params.id)
        .then(device => {
            res.locals.device = device;
            next();
        })
        .catch(error => {
            res.status(404).json({ response: 'error', error: error });
        });
});

app.get('/device/:id*', function (req, res, next) {
    if (req.params[0]==="") {
        res.json( res.locals.device.toString() );
    } else {
        next();
    }
});

app.get('/device/memdump', function (req, res) {
    logger.log( 'server', 'memory dump', util.inspect(castManager) );
    res.send('ok');
});

//get device connected, then redirect to id