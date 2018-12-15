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

    debugServer(functionName, message, id) { //TODO: debug-param
        debug(chalk.cyan(Logger.buildMeta(functionName, message, id)));
    }

    debugWarn(functionName, message, id) {
        debug(chalk.yellow(Logger.buildMeta(functionName, message, id)));
    }

    debugError(functionName, message, id) {
        debug(chalk.red(Logger.buildMeta(functionName, message, id)));
    }

    static server(functionName, message, id) {
        console.log(chalk.cyan(Logger.buildMeta(functionName, message, id)));
    }

    static log(type, functionName, message, id) { //TODO: replace
        if (type === 'info') {
            console.log(Logger.buildMeta(functionName, message, id));
        }
        if (type === 'error') {
            console.log(chalk.red(Logger.buildMeta(functionName, message, id)));
        }
        if (type === 'debug') {
            debug(Logger.buildMeta(functionName, message, id));
        }
        if (type === 'debug-server') {
            debug(chalk.cyan(Logger.buildMeta(functionName, message, id)));
        }
        if (type === 'debug-warn') {
            debug(chalk.yellow(Logger.buildMeta(functionName, message, id)));
        }
        if (type === 'debug-error') {
            debug(chalk.red(Logger.buildMeta(functionName, message, id)));
        }
        if (type === 'server') {
            console.log(chalk.cyan(Logger.buildMeta(functionName, message, id)));
        }
    }
}

module.exports = Logger;