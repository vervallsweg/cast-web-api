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
            callbacks.push(callback.object);
        });
        return callbacks;
    }

    static getCallback(id) {
        return CallbackManager._callbacks.get(id);
    }

    static setCallback(id, url, settings) {
        CallbackManager._callbacks.set(id, new Callback(url, settings));
        CallbackManager.writeCallbacks(CallbackManager.callbacks);
    }

    static deleteCallback(id) {
        CallbackManager._callbacks.get(id).delete();
        CallbackManager._callbacks.delete(id);
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
                CallbackManager.setCallback(callback.id, callback.url, callback.settings);
            });
        }
    }

    static writeCallbacks(callbacks) {
        Fs.writeFS('callbacks.json', callbacks);
    }
}

module.exports = CallbackManager;