const Callback = require("./callback");
const Config = require("../config/config");
const logger = require("./../log/logger");
const jsonfile = require('jsonfile');

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
        let callbacks = CallbackManager.readFS();
        if (callbacks && callbacks.length > 0) {
            callbacks.forEach(callback => {
                console.log("parseCallbacksJson");
                CallbackManager.setCallback(callback.url, callback.settings);
            });
        }
    }

    static readFS() {
        let file = Config.getAbsolutePath()+'/config/callbacks.json';
        try { return jsonfile.readFileSync(file); }
        catch (e) { return false; }
    }

    static writeFS(object) {
        let file = Config.getAbsolutePath()+'/config/callbacks.json';
        jsonfile.writeFileSync(file, object, err => {
            //TODO: log err
        });
    }

    static writeCallbacks(callbacks) {
        CallbackManager.writeFS(callbacks);
    }
}

module.exports = CallbackManager;