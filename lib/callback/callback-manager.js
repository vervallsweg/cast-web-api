const Callback = require("./callback");
const logger = require("./../log/logger");
const Fs = require("../config/fs");

class CallbackManager {
    static init() {
        if (!CallbackManager._callbacks) {
            CallbackManager._callbacks = new Map();
            CallbackManager.parseCallbacksJson();
        }
    }

    static get callbacks() {
        let callbacks = [];
        CallbackManager._callbacks.forEach(callback => {
            callbacks.push(callback.toObject());
        });
        return callbacks;
    }

    static getCallback(url) {
        return CallbackManager._callbacks.get(url);
    }

    static setCallback(url, settings) {
        CallbackManager._callbacks.set(url, new Callback(url, settings));
        CallbackManager.writeCallbacks(CallbackManager.callbacks);
    }

    static deleteCallback(url) {
        CallbackManager._callbacks.get(url).delete();
        CallbackManager._callbacks.delete(url);
        CallbackManager.writeCallbacks(CallbackManager.callbacks);
    }

    static send(status) {
        logger.info('CallbackManager.send()', 'status: '+JSON.stringify(status), '');
        CallbackManager._callbacks.forEach(callback => {
            callback.send(status);
        });
    }

    //save to /config/callbacks.json
    static parseCallbacksJson() {
        let callbacks = Fs.readFS('callbacks.json');
        if (callbacks && callbacks.length > 0) {
            callbacks.forEach(callback => {
                console.log("parseCallbacksJson");
                CallbackManager.setCallback(callback.url, callback.settings);
            });
        }
    }

    static writeCallbacks(callbacks) {
        Fs.writeFS('callbacks.json', callbacks);
    }
}

module.exports = CallbackManager;