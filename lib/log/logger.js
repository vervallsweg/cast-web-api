const chalk = require('chalk');
const debug = require('debug')('cast-web-api');

class Logger {
    constructor() {

    }

    static buildMeta(functionName, message, id) {
        // {date+time}  {id_underline} {functionName}: {message}
        let date = new Date();
        let time = date.toISOString();
        if (id == null) {
            id = '';
        } else {
            time = time + ' ';
        };
        return time + chalk.inverse(id) + ' ' + chalk.underline(functionName) + ': ' + message;
    }

    static info(functionName, message, id) {
        console.log(this.buildMeta(functionName, message, id));
    }

    static error(functionName, message, id) {
        console.log(chalk.red(Logger.buildMeta(functionName, message, id)));
    }

    static debug(functionName, message, id) {
        debug(Logger.buildMeta(functionName, message, id));
    }

    static debugServer(functionName, message, id) { //TODO: debug-param
        debug(chalk.cyan(Logger.buildMeta(functionName, message, id)));
    }

    static debugWarn(functionName, message, id) {
        debug(chalk.yellow(Logger.buildMeta(functionName, message, id)));
    }

    static debugError(functionName, message, id) {
        debug(chalk.red(Logger.buildMeta(functionName, message, id)));
    }

    static server(functionName, message, id) {
        console.log(chalk.cyan(Logger.buildMeta(functionName, message, id)));
    }

    static log(type, functionName, message, id) { //TODO: replace
        if (type === 'info') {
            this.info(functionName, message, id);
        }
        if (type === 'error') {
            this.error(functionName, message, id);
        }
        if (type === 'debug') {
            this.debug(functionName, message, id);
        }
        if (type === 'debug-server') {
            this.debugServer(functionName, message, id);
        }
        if (type === 'debug-warn') {
            this.debugWarn(functionName, message, id);
        }
        if (type === 'debug-error') {
            this.debugError(functionName, message, id);
        }
        if (type === 'server') {
            this.server(functionName, message, id);
        }
    }
}

module.exports = Logger;