const logger = require("../log/logger");

class Heartbeat {
    constructor(callback, ms) {
        this.ms = ms;
        this._interval = false;
        this._callback = callback;
    }

    start() {
        console.log("start, ms: " + this.ms);
        if (this.ms > 0) {
            this._interval = setInterval(() => {
                this._callback.send({heartbeat:"ping"});
            }, this._ms);
        }
    }

    stop() {
        clearInterval(this._interval);
    }

    delete() {
        this.stop();
        delete this._callback;
    }

    get ms() {
        return this._ms;
    }

    set ms(value) {
        console.log("ms: " + value);
        this._ms = value;
        this.stop();
        if (value > 0) {
            this.start();
        }
    }
}

module.exports = Heartbeat;