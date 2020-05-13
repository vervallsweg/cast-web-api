const logger = require("../log/logger");
const http = require("http");
const url = require("url");
const Heartbeat = require("./heartbeat");

class Callback {
    constructor(callbackUrl, settings) {
        this._url = null;
        this._heartbeat = new Heartbeat(this, 0);

        this.settings = settings;
        this.address = callbackUrl;
    }

    send(status) {
        logger.log( 'info', 'Callback.send()', 'to: '+ JSON.stringify(this._url) +', status: ' + JSON.stringify(status), status.id );

        try {
            let data = JSON.stringify(status);

            let options = {
                hostname: this._url.hostname,
                port: this._url.port,
                path: this._url.path,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            let req = http.request(options, res => {
                res.setEncoding('utf8');
            });

            req.on('error', err => {
                logger.log('error', 'sendCallBack()', 'cannot send callback: ' + JSON.stringify(this._url) + ', err: ' + err, status.id);
            });

            req.write(data);
            req.end();
        } catch (e) {
            logger.log('error', 'sendCallBack()', 'cannot send callback: ' + JSON.stringify(this._url) + ', error: ' + e, status.id);
        }
    }

    delete() {
        this._heartbeat.delete();
    }

    get settings() {
        return {
            heartbeat: this._heartbeat.ms
        }
    }

    set settings(value) {
        console.log("value: " + JSON.stringify(value));
        if (value.hasOwnProperty("heartbeat")) {
            this._heartbeat.ms = value.heartbeat;
        }
    }

    get address() {
        return this._url.hostname+":"+this._url.port+this._url.path;
    }

    set address(value) {
        try {
            //TODO: manage replacing address with current listeners, etc.
            this._url = url.parse(`http://${value}`);
        } catch(e) {
            logger.error('Callback set address()', 'error parsing url: ' + e, '');
        }
    }

    get object() {
        return {
            url: this.address,
            settings: this.settings
        };
    }

    set object(object) {
        if (object.address) this.address = object.address;
        if (object.settings) this.settings = object.settings;
    }
}

module.exports = Callback;
