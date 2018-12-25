const logger = require('../log/logger');
const url = require('url');
const http = require('http');

class Callback {
    constructor(callback, status) {
        logger.log('debug', 'Callback ()', 'callback: '+ JSON.stringify(callback), status.id);
        this._id = status.id;
        this._url = null;

        try {
            this._url = url.parse(`http://${callback}`);
        } catch(e) {
            //TODO:
        }

        this.send(status)
    }

    stop() {
        logger.log('info', 'Callback.stop()', '', this._id);
        this._id = null;
        this._url = null;
        return {response:'ok'};
    }

    send(status) {
        logger.log( 'debug', 'Callback.send()', 'to: '+ JSON.stringify(this._url) +', status: ' + JSON.stringify(status), status.id );

        try{
            let data = JSON.stringify(status);
            let that = this;

            let options = {
                hostname: this._url.hostname,
                port: this._url.port,
                path: this._url.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data) //TODO: without import?
                }
            };

            let req = http.request(options, function(res) {
                res.setEncoding('utf8');
            });

            req.on('error', function(error) {
                logger.log('error', 'sendCallBack()', 'cannot send callback: ' + JSON.stringify(that._url) + ', error: ' + error, status.id);
            });

            req.write(data);
            req.end();
        } catch (e) {
            logger.log('error', 'sendCallBack()', 'cannot send callback: ' + JSON.stringify(this._url) + ', error: ' + e, status.id);
        }
    }
}