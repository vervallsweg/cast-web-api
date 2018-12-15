const os = require('os');
const Logger = require("../log/logger");
const pkg = require('../../package.json');

class Config {

    static init(argv) {
        Config._hostname = Config.getNetworkIp();
        Config._port = 3000;
        Config._windows = false;
        Config._thisVersion = pkg.version;

        Config.interpretArguments(argv);
        Config.isWindows();
    }

    static interpretArguments(argv) {
        let args = require('minimist')(argv);
        Logger.log('debug', 'interpretArguments()', JSON.stringify(args));

        if (args.hostname) {
            Config._hostname = args.hostname;
        }
        if (args.port) {
            Config._port = args.port;
        }
        if (args.windows) {
            Config._windows = true;
        }
    }

    static getLatestVersion() {
        return new Promise( function(resolve, reject) {
            fetch('https://raw.githubusercontent.com/vervallsweg/cast-web-api/master/package.json')
                .then(function(res) {
                    return res.json();
                }).then(function(json) {
                Logger.log('debug', 'getLatestVersion()', 'JSON received: '+JSON.stringify(json));
                try {
                    let version = json.version;
                    Logger.log('debug', 'getLatestVersion()', 'version: ' + version);
                    resolve(version);
                } catch (e) {
                    reject(e);
                }
            });

            setTimeout(() => {
                reject('request timeout');
            }, 5000);
        });
    }

    static getNetworkIp() {
        let interfaces = os.networkInterfaces();
        let addresses = [];
        for (let k in interfaces) {
            for (let k2 in interfaces[k]) {
                let address = interfaces[k][k2];
                if (address.family === 'IPv4' && !address.internal) {
                    addresses.push(address.address);
                }
            }
        }
        Logger.log('debug', 'getNetworkIp()', 'addresses: ' + addresses);
        return addresses[0];
    }

    static isWindows() {
        if (Config._windows) {
            console.log( process.argv[1].substring(0, process.argv[1].length - 17) );
            //TODO: quit api and better solution
        }
    }

    static get hostname() {
        return Config._hostname;
    }

    static set hostname(value) {
        Config._hostname = value;
    }

    static get port() {
        return Config._port;
    }

    static set port(value) {
        Config._port = value;
    }

    static get windows() {
        return Config._windows;
    }

    static set windows(value) {
        Config._windows = value;
    }

    static get thisVersion() {
        return Config._thisVersion;
    }
}

module.exports = Config;