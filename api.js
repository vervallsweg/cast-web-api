const Express = require('express');
const bodyParser = require('body-parser');
const Path = require('path');
const Fs = require('./lib/config/fs');


const configDir = getConfigDir();
Fs.init(configDir);

const configuration = require("./lib/config/config.js");
configuration.init();


const assistant = require("./lib/assistant");
const callback = require("./lib/callback");
const device = require("./lib/device");
const config = require("./lib/config");
const deviceId = require("./lib/device/id");
const swagger = require("./lib/swagger");

startApi();

function startApi() {
	console.log('cast-web-api v'+configuration.thisVersion);
	createWebServer();
}

function createWebServer() {
	const webserver = Express();
	webserver.use(bodyParser.json());

	webserver.use(assistant);
	webserver.use(callback);
	webserver.use(device);
	webserver.use(deviceId);
	webserver.use(config);
	webserver.use(swagger);


	webserver.get('/', function (req, res) {
		res.json({castWebApi: `v${configuration.thisVersion}`});
	});

	webserver.listen(configuration.port, () => {
		console.log(`cast-web-api running at http://${configuration.hostname}:${configuration.port}`);
	});

	process.on('message', packet => {
		console.log(configuration.hostname);
		process.send({
			type : 'process:msg',
			data : {
				address : `${configuration.hostname}:${configuration.port}`
			}
		});
	});
}

function getConfigDir() {
	let configDir;

	if (process.argv[2] && process.argv[1]) {
		try {
			console.log(process.argv);
			configDir = Path.resolve(process.argv[2]);
		} catch (e) {
			console.error('Cannot parse config dir:', e);
		}
	}

	if (!configDir) {
		console.error('No valid config dir specified.');
		process.exit(1);
	}

	return configDir;
}