const os = require('os');
const pkg = require('../../package.json');
const AssistantSetup = require('./assistant-setup');
const jsonfile = require('jsonfile');

class Config {

    static init(argv) {
        Config.interpretArguments(argv);
    }

    static interpretArguments(argv) {
        let args = require('minimist')(argv);
        require("../log/logger").log('info', 'interpretArguments()', JSON.stringify(args));

        if (args.autoConnect) {
            Config.autoConnect = args.autoConnect;
        }
        if (args.reconnectTimeout) {
            Config.reconnectTimeout = args.reconnectTimeout;
        }
        if (args.hostname) {
            Config.hostname = args.hostname;
        }
        if (args.port) {
            Config.port = args.port;
        }
        if (args.debug) {
            Config.debug = args.debug;
        }
    }

    static getLatestVersion() {
        return new Promise( function(resolve, reject) {
            fetch('https://raw.githubusercontent.com/vervallsweg/cast-web-api/master/package.json')
                .then(function(res) {
                    return res.json();
                }).then(function(json) {
                require("../log/logger").log('debug', 'getLatestVersion()', 'JSON received: '+JSON.stringify(json));
                try {
                    let version = json.version;
                    require("../log/logger").log('debug', 'getLatestVersion()', 'version: ' + version);
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
        require("../log/logger").log('debug', 'getNetworkIp()', 'addresses: ' + addresses);
        return addresses[0];
    }

    static get autoConnect() {
        return Config.readConfig("autoConnect", true);
    }

    static set autoConnect(value) {
        Config.writeConfig("autoConnect", value);
    }

    static get reconnectTimeout() {
        return Config.readConfig("reconnectTimeout", 10000);
    }

    static set reconnectTimeout(value) {
        Config.writeConfig("reconnectTimeout", value);
    }

    static get hostname() {
        return Config.readConfig("hostname", Config.getNetworkIp());
    }

    static set hostname(value) {
        Config.writeConfig("hostname", value);
    }

    static get port() {
        return Config.readConfig("port", 3000);
    }

    static set port(value) {
        Config.writeConfig("port", value);
    }

    static get thisVersion() {
        return pkg.version;
    }

    static get logLevel() {
        return Config.readConfig("logLevel", {
                info: true,
                error: true,
                server: true
        });
    }

    static set logLevel(value) {
        Config.writeConfig("logLevel", value);
    }

    static get debug() {
        return Config.readConfig("debug", false);
    }

    static set debug(value) {
        Config.writeConfig("debug", value);
    }

    static getConfig() {
        return new Promise(resolve => {
           let config = {
               api: {
                   debug: Config.debug,
                   logLevel: Config.logLevel,
                   version: {
                       this: Config.thisVersion,
                       latest: "Error"
                   }
               },
               assistant: {
                   id: false,
                   secret: false,
                   token: false
               },
               device: {
                   autoConnect: Config.autoConnect,
                   reconnectTimeout: Config.reconnectTimeout
               }
           };
           Promise.all([
               Config.getLatestVersion().catch(()=>{return "Error"}),
               AssistantSetup.checkSetup().catch(()=>{return {id: false, secret: false, token: false}})
           ])
               .then(values => {
                   config.api.version.latest = values[0];
                   config.assistant = values[1];
                   resolve(config);
               })
               .catch(error=>{
                   console.log(error);
                   resolve(config);
               })
        });
    }

    static readConfig(key, def) {
        let config = Config.readFS();
        if (config.hasOwnProperty(key)) return config[key]
        else return def;
    }

    static readFS() {
        let file = Config.getAbsolutePath()+'/config/config.json';
        try { return jsonfile.readFileSync(file); }
        catch (e) { return {}; }
    }

    static writeFS(object) {
        let file = Config.getAbsolutePath()+'/config/config.json';
        jsonfile.writeFileSync(file, object, err => {
            //TODO: log err
        });
    }

    static writeConfig(key, value) {
        let config = Config.readFS();
        config[key] = value;
        this.writeFS(config);
    }

    static getAbsolutePath(){
        let path = (require.resolve('../../api.js').substring(0, ( require.resolve('../../api.js').length -7 ) )); //TODO: fix this
        // console.log(path);
        return path;
    }
}

module.exports = Config;