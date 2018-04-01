const http = require('http');
const Client = require('castv2').Client;
const Castv2Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const mdns = require('mdns-js');
const url = require('url');
const debug = require('debug')('cast-web-api');
const args = require('minimist')(process.argv.slice(2));
const fetch = require('node-fetch');
const os = require('os');
const pkg = require('./package.json');
const util = require('util');
const events = require('events');
const querystring = require('querystring');
const chalk = require('chalk');

var hostname = '127.0.0.1';
var port = 3000;
var currentRequestId = 1;
var timeoutDiscovery = 4000;
var thisVersion = pkg.version;
var reconnectInterval = 300000;
var discoveryInterval = 60000;
var windows = false;

var devicesDiscoverd = [];
var devicesSubscribed = [];

interpretArguments();
if (!windows) {
	startApi();
} else {
	console.log( process.argv[1].substring(0, process.argv[1].length - 17) );
}

function startApi() {
	console.log('cast-web-api v'+thisVersion);
	console.log('Discovering devices, please wait...');
	getDevices()
	.then(devices => {
		console.log('... done!');
		setInterval(function() {
			getDevices();
		}, discoveryInterval);
		createWebServer();
	})
	.catch(errorMessage => {
		console.log('Cannot discover devices, shutting down. Error message: '+ errorMessage);
	})
}

//HANDLE ARGUMENTS
function interpretArguments() {
	log('debug', 'interpretArguments()', JSON.stringify(args));
	if (getNetworkIp()) {
		hostname = getNetworkIp();
	}
	if (args.hostname) {
		hostname = args.hostname;
	}
	if (args.port) {
		port = args.port;
	}
	if (args.timeoutDiscovery) {
		timeoutDiscovery = args.timeoutDiscovery;
	}
	if (args.reconnectInterval) {
		reconnectInterval = args.reconnectInterval;
	}
	if (args.discoveryInterval) {
		discoveryInterval = args.discoveryInterval;
	}
	if (args.windows) {
		windows = true;
	}
}

//GET NETWORK IP
function getNetworkIp() {
	var interfaces = os.networkInterfaces();
	var addresses = [];
	for (var k in interfaces) {
		for (var k2 in interfaces[k]) {
			var address = interfaces[k][k2];
			if (address.family === 'IPv4' && !address.internal) {
				addresses.push(address.address);
			}
		}
	}

	log('debug', 'getNetworkIp()', 'addresses: ' + addresses);
	return addresses[0];
}

//WEBSERVER
function createWebServer() {
	const server = http.createServer((req, res) => {
		var parsedUrl = url.parse(req.url, true);
		var path = parsedUrl['pathname'].split('/');
		var requestBuffer = '';
		var requestData = null;

		req.on('data', function (data) {
            requestBuffer += data;
        });

		req.on('end', function () {
			requestData = requestBuffer;
			log('debug-server', 'requestData', requestData);

			res.setHeader('Content-Type', 'application/json; charset=utf-8');

			if (path[1]=="discover") {
				getDevices()
				.then(devices => {
					res.statusCode = 200;
					res.end(devices);
				})
				.catch(errorMessage => {
					res.statusCode = 500;
					res.end( JSON.stringify( {response: 'error', error: errorMessage} ) );
				})
			}

			if (path[1]=="device") {
				if (path[2]) {
					getDeviceSafe(path[2])
					.then(device => {
						if (path[3]) {
							log('debug-server', 'path[3]', path[3]);
							var result = {response:'error', error:'command unknown'};
							if (path[3]=='play') {
								result = getDevice(path[2]).play();
							}
							if (path[3]=='pause') {
								result = getDevice(path[2]).pause();
							}
							if (path[3]=='stop') {
								result = getDevice(path[2]).stop();
							}
							if (path[3]=='mute') {
								result = getDevice(path[2]).muted(true);
							}
							if (path[3]=='unmute') {
								result = getDevice(path[2]).muted(false);
							}
							if (path[3]=='volume') {
								if (path[4]) {
									if ( parseInt(path[4])>=0 && parseInt(path[4])<=100) {
										log('debug-server', 'path[4] targetLevel', (parseInt(path[4])/100) );
										result = getDevice(path[2]).volume( (parseInt(path[4])/100) );
									} else {
										result = {response:'error', error:'level unknown'};
									}
								} else {
									result = {response:'error', error:'level unknown'};
								}
							}
							if (path[3]=='subscribe') {
								if (path[4]) {
									result = { response:'ok' };
									result = getDevice(path[2]).createSubscription( getRestOfPathArray(path, 4) );
								} else {
									result = {response:'error', error:'callback unknown'};
								}
							}
							if (path[3]=='unsubscribe') {
								result = getDevice(path[2]).removeSubscription();
							}
							if (path[3]=='playMedia') {
								if (requestData) {
									try {
										var media = JSON.parse(requestData);
										result = getDevice(path[2]).playMedia(media);
									} catch (e) {
										result = {response:'error', error: e};
									}
								} else {
									result = {response:'error', error: 'post media unknown'};
								}
							}
							if (path[3]=='remove') {
								removeDevice(path[2]);
								result = { response:'ok' };
							}
							if (result=={response: 'ok'}) {
								res.statusCode = 200;
							} else {
								res.statusCode = 500;
							}
							res.end( JSON.stringify( result ) );
						} else {
							res.statusCode = 200;
							res.end( JSON.stringify( device.toString() ) );
						}
					})
					.catch(errorMessage => {
						res.statusCode = 404;
						res.end( JSON.stringify( {response: 'error', error: errorMessage} ) );
					})
				} else {
					res.statusCode = 200;
					res.end( JSON.stringify( getAllDevices() ) );
				}
			}

			if (path[1]=="config") {
				if (path[2]) {
					if (path[2]=="timeoutDiscovery") {
						if (path[3]) {
							if ( parseInt(path[3]) ) {
								timeoutDiscovery = parseInt(path[3]);
							}
						}
						res.end( JSON.stringify( { timeoutDiscovery: timeoutDiscovery} ) );
					}
					if (path[2]=="reconnectInterval") {
						if (path[3]) {
							if ( parseInt(path[3]) ) {
								reconnectInterval = parseInt(path[3]);
							}
						}
						res.end( JSON.stringify( { reconnectInterval: reconnectInterval} ) );
					}
					if (path[2]=="discoveryInterval") {
						if (path[3]) {
							if ( parseInt(path[3]) ) {
								discoveryInterval = parseInt(path[3]);
							}
						}
						res.end( JSON.stringify( { discoveryInterval: discoveryInterval} ) );
					}
					if (path[2]=="version") {
						if (path[3]=="this") {
							res.end( JSON.stringify( { version: thisVersion} ) );
						}
						if (path[3]=="latest") {
							getLatestVersion()
							.then(version => {
								res.end( JSON.stringify( { version: version} ) );
							})
							.catch(errorMessage => {
								res.statusCode = 500;
								res.end( JSON.stringify( { response: error, error: errorMessage} ) );
							})
						}
					}
				}
			}

			if (path[1]=="dump") {
				res.statusCode = 200;
				log( 'server', 'memory dump', util.inspect(devicesSubscribed) );
				res.end('ok');
			}

			if (path[1]=="") {
				res.statusCode = 200;
				res.end('cast-web-api v' + thisVersion)
			}
		});
	});

	server.listen(port, hostname, () => {
	 	console.log('cast-web-api running at http://'+hostname+':'+port+'/');
	});

	server.on('request', (req, res) => {
		if (req.url!='/favicon.ico') {
			log('server', 'on("request")', req.url);
		}
	});
}

function createDevice(id) {
	return new Promise( function(resolve, reject) {
		if ( !deviceExists(id) ) {
			getDeviceAddress(id)
			.then(returnAddress => {
				var castDevice = new CastDevice(id, returnAddress);
				castDevice.connect();
				devicesSubscribed.push(castDevice);
				resolve(true);
			})
			.catch(error => {
				reject(error);
			})
		} else {
			resolve(true);
		}
	});
}

function getDeviceAddress(id) {
	return new Promise( function(resolve, reject) {

		log('debug', 'getDeviceAddress()', '', id);
		if ( getDeviceAddressDevicesDiscoverd(id) ) {
			log('debug', 'getDeviceAddress()', 'address found on try 1', id);
			resolve( getDeviceAddressDevicesDiscoverd(id) );
		} else {
			log('debug', 'getDeviceAddress()', 'retry', id);
			getDevices()
			.then(devices => {
				if ( getDeviceAddressDevicesDiscoverd(id) ) {
					log('debug', 'getDeviceAddress()', 'address found on try 2', id);
					resolve( getDeviceAddressDevicesDiscoverd(id) );
				} else {
					log('debug-warn', 'getDeviceAddress()', 'address NOT found on try 2', id);
					reject('Device not found.');
				}
			})
			.catch(error => {
				log('debug-error', 'getDeviceAddress()', 'getDevices() error: '+ error, id);
				reject(error);
			})
		}
	});
}

function getDeviceAddressDevicesDiscoverd(id) {
	var address = null;
	devicesDiscoverd.forEach(function(element) {
		if (element.id == id) {
			address = { host: element.ip, port: element.port };
			log('debug', 'getDeviceAddressDevicesDiscoverd()', 'found host: '+address.host + ', port: '+address.port, id);
		}
	});
	return address;
}

function deviceExists(id) {
	var exists = false;
	devicesSubscribed.forEach(function(element) {
		if (element.id == id) {
			exists = true;
		}
	});
	return exists;
}

function getDevice(id) {
	var returnElement = null;
	devicesSubscribed.forEach(function(element) {
		if (element.id == id) {
			returnElement = element;
		}
	});
	return returnElement;
}

function getDeviceSafe(id){
	return new Promise( function(resolve, reject) {
		if ( getDevice(id) ) {
			resolve( getDevice(id) );
		} else {
			createDevice(id)
			.then(created => {
				getDevice(id).event.once('linkChanged', function() {
					log('debug', 'createDevice()', 'once linkChanged: ' + getDevice(id).link, id);
					resolve( getDevice(id) );
				});
			})
			.catch(error => {
				reject(error);
			})
		}
	});
}

function removeDevice(id) {
	log('info', 'removeDevice()', '', id);
	if ( deviceExists(id) ) {
		var targetIndex = null;

		getDevice(id).disconnect();

		devicesSubscribed.forEach(function(element, index) {
			if (element.id == id) {
				targetIndex = index;
			}
		});
	
		if (targetIndex!=null) {
			devicesSubscribed.splice(targetIndex, 1)
		}
	}
}

function getAllDevices() {
	var devices = [];
	devicesSubscribed.forEach(function(element) {
		devices.push( element.toString() );
	});
	return devices;
}

function CastDevice(id, address) {
	this.id = id;
	this.address = address;
	this.event = new events.EventEmitter();
	this.link;
	this.reconnectInterval;
	this.castConnectionReceiver;
	this.castConnectionMedia;
	this.status = {
		volume: 0,
		muted: false,
		application: '',
		status: '',
		title: '',
		subtitle: ''
	}

	this.connect = function() {
		connectReceiverCastDevice(this);
	};

    this.disconnect = function() {
		disconnectReceiverCastDevice(this);
	};

	this.connectMedia = function() {
		if (this.castConnectionReceiver.sessionId) {
			connectMediaCastDevice(this, this.castConnectionReceiver.sessionId);
		}
	};

	this.disconnectMedia = function() {
		if (this.castConnectionMedia) {
			disconnectMediaCastDevice(this);
		}
	};

	this.toString = function() {
		return {
			id: this.id,
			connection: this.link,
			volume: this.status.volume,
			muted: this.status.muted,
			application: this.status.application,
			status: this.status.status,
			title: this.status.title,
			subtitle: this.status.subtitle
		}
	}

	this.volume = function(targetLevel) {
		log('info', 'CastDevice.volume()', targetLevel, this.id);
		if (this.castConnectionReceiver.receiver) {
			this.castConnectionReceiver.receiver.send({ type: 'SET_VOLUME', volume: { level: targetLevel }, requestId: getNewRequestId() });
			return {response:'ok'};
		} else {
			return {response:'error', error:'disconnected'};
		}
	}

	this.muted = function(isMuted) {
		log('info', 'CastDevice.muted()', isMuted, this.id);
		if (this.castConnectionReceiver.receiver) {
			this.castConnectionReceiver.receiver.send({ type: 'SET_VOLUME', volume: { muted: isMuted }, requestId: getNewRequestId() });
			return {response:'ok'};
		} else {
			return {response:'error', error:'disconnected'};
		}
	}

	this.play = function() {
		log('info', 'CastDevice.play()', '', this.id);
		if (this.castConnectionMedia) {
			if (this.castConnectionMedia.media && this.castConnectionReceiver.sessionId && this.castConnectionMedia.mediaSessionId) {
				this.castConnectionMedia.media.send({ type: 'PLAY', requestId: getNewRequestId(), mediaSessionId: this.castConnectionMedia.mediaSessionId, sessionId: this.castConnectionReceiver.sessionId });
				return {response:'ok'};
			} else {
				return {response:'error', error:'nothing playing'};
			}
		} else {
			return {response:'error', error:'nothing playing'};
		}
	}

	this.pause = function() {
		log('info', 'CastDevice.pause()', '', this.id);
		if (this.castConnectionMedia) {
			if (this.castConnectionMedia.media && this.castConnectionReceiver.sessionId && this.castConnectionMedia.mediaSessionId) {
				this.castConnectionMedia.media.send({ type: 'PAUSE', requestId: getNewRequestId(), mediaSessionId: this.castConnectionMedia.mediaSessionId, sessionId: this.castConnectionReceiver.sessionId });
				return {response:'ok'};
			} else {
				return {response:'error', error:'nothing playing'};
			}
		} else {
			return {response:'error', error:'nothing playing'};
		}
	}

	this.stop = function() {
		log('info', 'CastDevice.stop()', '', this.id);
		if (this.castConnectionReceiver.sessionId) {
			this.castConnectionReceiver.receiver.send({ type: 'STOP', sessionId: this.castConnectionReceiver.sessionId, requestId: getNewRequestId() });
			return {response:'ok'};
		} else {
			return {response:'error', error:'nothing playing'};
		}
	}

	this.createSubscription = function(callback) {
		createSubscription(this, callback);
		return {response:'ok'};
	}

	this.removeSubscription = function() {
		this.event.removeAllListeners('statusChange');
		this.event.removeAllListeners('linkChanged');
		this.callback = null;
		return {response:'ok'};
	}

	this.setStatus = function(key, value) {
		if (key=='volume' || key=='muted' || key=='application' || key=='status' || key=='title' || key=='subtitle') {
			if (value == null) { value = '' };
			if (this.status[key] != value) {
				this.status[key] = value;
				this.event.emit('statusChange');
			}
		}
	}

	this.playMedia = function(media) {
		playMediaCastDevice(this, media);
		return {response:'ok'};
	}

	reconnectionManagementInit(this);
}

function connectReceiverCastDevice(castDevice) {
	try {
		log('info', 'CastDevice.connect()', 'host: ' + castDevice.address.host + ', port: ' + castDevice.address.port, castDevice.id );
		castDevice.castConnectionReceiver = new Object();
		castDevice.castConnectionReceiver.client = new Client();

		castDevice.castConnectionReceiver.client.connect(castDevice.address, function() {
			castDevice.castConnectionReceiver.connection = castDevice.castConnectionReceiver.client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
		    castDevice.castConnectionReceiver.heartbeat = castDevice.castConnectionReceiver.client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.heartbeat', 'JSON');
		    castDevice.castConnectionReceiver.receiver = castDevice.castConnectionReceiver.client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

			castDevice.castConnectionReceiver.connection.send({ type: 'CONNECT' });
			castDevice.castConnectionReceiver.receiver.send({ type: 'GET_STATUS', requestId: getNewRequestId() });

		    castDevice.castConnectionReceiver.receiver.on('message', function(data, broadcast) {
		    	parseReceiverStatusCastDevice(castDevice, data);
		    	if (castDevice.link != 'connected') {
					castDevice.link = 'connected';
					castDevice.event.emit('linkChanged');
		    	}
		   	});

		   	castDevice.castConnectionReceiver.heartBeatIntervall = setInterval(function() {
				if (castDevice.castConnectionReceiver) {
					castDevice.castConnectionReceiver.heartbeat.send({ type: 'PING' });
				}
			}, 5000);
		});
		castDevice.castConnectionReceiver.client.on('error', function(err) {
		 	log('error', 'CastDevice.connect()', 'castDevice.castConnectionReceiver.client error: '+err, castDevice.id);
		 	castDevice.disconnect();
		});
	} catch (e) {
		log('error', 'CastDevice.connect()', 'exception: '+e, castDevice.id);
		castDevice.disconnect();
	}
}

function disconnectReceiverCastDevice(castDevice) {
	log('info', 'CastDevice.disconnect()', 'host: ' + castDevice.address.host + ', port: ' + castDevice.address.port, castDevice.id );
	try {
		if (castDevice.link != 'disconnected') {
			castDevice.link = 'disconnected';
			castDevice.event.emit('linkChanged');
			clearInterval(castDevice.castConnectionReceiver.heartBeatIntervall);
			//castDevice.castConnectionReceiver.connection.send({ type: 'CLOSE' });
			castDevice.castConnectionReceiver.client.close();
			castDevice.castConnectionReceiver = null;
		}
	} catch (e) {
		castDevice.castConnectionReceiver = null;
		log('error', 'CastDevice.disconnect()', 'exception: '+e, castDevice.id);
	}
	castDevice.disconnectMedia();
}

function reconnectionManagementInit(castDevice) {
	log('debug', 'reconnectionManagementInit()', '', castDevice.id);

	castDevice.event.on('linkChanged', function() {
		reconnectionManagement(castDevice);
	});
}

function reconnectionManagement(castDevice) {
	log('debug', 'reconnectionManagement()', 'link changed to: ' + castDevice.link + ', reconnectInterval: ' + castDevice.reconnectInterval, castDevice.id);
	if (castDevice.link!='connected') {
		log('debug', 'reconnectionManagement()', 'starting interval', castDevice.id);
		castDevice.reconnectInterval = setInterval(function() {
			log('debug', 'reconnectionManagement()', 'reconnect evaluating', castDevice.id);
			if (castDevice.link!='connected') {
				log('info', 'reconnectionManagement()', 'reconnecting', castDevice.id);
				castDevice.connect();
			}
		}, reconnectInterval);
	} else {
		log('debug', 'reconnectionManagement()', 'interval evaluating', castDevice.id);
		if (castDevice.reconnectInterval!=null) {
			log('debug', 'reconnectionManagement()', 'interval remove', castDevice.id);
			clearInterval(castDevice.reconnectInterval);
			castDevice.reconnectInterval = null;
		}
	}
}

function connectMediaCastDevice(castDevice, sessionId) {
	try {
		log('info', 'CastDevice.connectMedia()', 'host: ' + castDevice.address.host + ', port: ' + castDevice.address.port + ', sessionId: ' + sessionId, castDevice.id);
		castDevice.castConnectionMedia = new Object();
		castDevice.castConnectionMedia.client = new Client();

		castDevice.castConnectionMedia.client.connect(castDevice.address, function() {
			castDevice.castConnectionMedia.connection = castDevice.castConnectionMedia.client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
			castDevice.castConnectionMedia.heartbeat = castDevice.castConnectionMedia.client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.tp.heartbeat', 'JSON');
			castDevice.castConnectionMedia.media = castDevice.castConnectionMedia.client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.media', 'JSON');

			castDevice.castConnectionMedia.connection.send({ type: 'CONNECT' });
			castDevice.castConnectionMedia.media.send({ type: 'GET_STATUS', requestId: getNewRequestId() });

			castDevice.castConnectionMedia.media.on('message', function(data, broadcast) {
				parseMediaStatusCastDevice(castDevice, data);
				castDevice.castConnectionMedia.link = 'connected';
			});

			castDevice.castConnectionMedia.heartBeatIntervall = setInterval(function() {
				if (castDevice.castConnectionMedia && castDevice.link=='connected') {
					castDevice.castConnectionMedia.heartbeat.send({ type: 'PING' });
				}
			}, 5000);
		});
		castDevice.castConnectionMedia.client.on('error', function(err) {
			log('error','CastDevice.connectMedia()', 'castDevice.castConnectionMedia.client error: '+err, castDevice.id);
			castDevice.disconnectMedia();
		});
	} catch(e) {
		log('error', 'CastDevice.connectMedia()', 'exception: '+e, castDevice.id);
		castDevice.disconnectMedia();
	}
}

function disconnectMediaCastDevice(castDevice) {
	log('info', 'CastDevice.disconnectMedia()', 'host: ' + castDevice.address.host + ', port: ' + castDevice.address.port, castDevice.id);
	try {
		if (castDevice.castConnectionMedia!=null) {
			clearInterval(castDevice.castConnectionMedia.heartBeatIntervall);
			//castDevice.castConnectionMedia.connection.send({ type: 'CLOSE' });
			castDevice.castConnectionMedia.client.close();
			castDevice.castConnectionMedia.link = 'disconnected';
			castDevice.status.status = '';
			castDevice.status.title = '';
			castDevice.status.subtitle = '';
			castDevice.event.emit('statusChange');
			castDevice.castConnectionMedia = null;
		}
	} catch(e) {
		log('error', 'CastDevice.disconnectMedia()', 'exception: '+e, castDevice.id); //TODO: Notify subscriber
		castDevice.castConnectionMedia = null;
	}
}

function parseReceiverStatusCastDevice(castDevice, receiverStatus) {
	try {
		log('debug', 'parseReceiverStatusCastDevice()', 'receiverStatus: ' + JSON.stringify(receiverStatus), castDevice.id );

		if (receiverStatus.type == 'RECEIVER_STATUS') {
			if (receiverStatus.status.applications) {
				if ( receiverStatus.status.applications[0].sessionId != castDevice.castConnectionReceiver.sessionId) {
					log('debug', 'parseReceiverStatusCastDevice()', 'sessionId changed', castDevice.id);
					if (receiverStatus.status.applications[0].isIdleScreen!=true) {
						log('debug', 'parseReceiverStatusCastDevice()', 'isIdleScreen: '+receiverStatus.status.applications[0].isIdleScreen+', sessionId changed to: '+receiverStatus.status.applications[0].sessionId+', from: '+castDevice.castConnectionReceiver.sessionId, castDevice.id);
						castDevice.castConnectionReceiver.sessionId = receiverStatus.status.applications[0].sessionId;
						castDevice.connectMedia();
					}
				}
				if ( receiverStatus.status.applications[0].displayName ) {
					castDevice.setStatus('application', receiverStatus.status.applications[0].displayName);
				}
			} else {
				castDevice.castConnectionReceiver.sessionId = null;
				castDevice.status.application = '';
				castDevice.disconnectMedia();
			}
			if (receiverStatus.status.volume) {
				castDevice.setStatus( 'volume', Math.round(receiverStatus.status.volume.level*100) );
				castDevice.setStatus('muted', receiverStatus.status.volume.muted);
			}
		}
	} catch(e) {
		log('error', 'parseReceiverStatusCastDevice()', 'exception: '+e, castDevice.id);
	}
}

function parseMediaStatusCastDevice(castDevice, mediaStatus) {
	try {
		log('debug', 'parseMediaStatusCastDevice()', 'mediaStatus: ' + JSON.stringify(mediaStatus), castDevice.id );

		if (mediaStatus.type == 'MEDIA_STATUS') {
			if (mediaStatus.status[0]) {
				if (mediaStatus.status[0].media) {
					if (mediaStatus.status[0].media.metadata) {
						var metadataType = mediaStatus.status[0].media.metadata.metadataType;
						if(metadataType<=1) {
							castDevice.setStatus('title', mediaStatus.status[0].media.metadata.title);
							castDevice.setStatus('subtitle', mediaStatus.status[0].media.metadata.subtitle);
						} 
						if(metadataType==2) {
							castDevice.setStatus('title', mediaStatus.status[0].media.metadata.seriesTitle);
							castDevice.setStatus('subtitle', mediaStatus.status[0].media.metadata.subtitle);
						} 
						if(metadataType>=3 && metadataType<=4) {
							castDevice.setStatus('title', mediaStatus.status[0].media.metadata.title);
							castDevice.setStatus('subtitle', mediaStatus.status[0].media.metadata.artist);
						}
					}
				}

				if (mediaStatus.status[0].mediaSessionId) {
					castDevice.castConnectionMedia.mediaSessionId = mediaStatus.status[0].mediaSessionId;
				}

				if (mediaStatus.status[0].playerState) {
					castDevice.setStatus('status', mediaStatus.status[0].playerState);
				}
			}
		}
	} catch(e) {
		log('error', 'parseMediaStatusCastDevice()', 'exception: '+e, castDevice.id);
	}
}

function playMediaCastDevice(castDevice, media) {
	try {
		log('info', 'CastDevice.playMedia()', 'media: ' + JSON.stringify(media), castDevice.id);

		var castv2Client = new Castv2Client();
		var fullMedia = {
			contentId: media.mediaUrl,
			contentType: media.contentType,
			streamType: media.mediaStreamType,

			metadata: {
				type: 0,
				metadataType: 0,
				title: media.mediaTitle,
				subtitle: media.mediaSubtitle,
				images: [ { url: media.mediaImageUrl } ]
			}
		};
		
	  	castv2Client.connect(castDevice.address, function() {
			castv2Client.launch(DefaultMediaReceiver, function(err, player) {
				player.load(fullMedia, { autoplay: true }, function(err, status) {
					//body...
			    });
		    });
	 	});

	 	setTimeout(() => {
			try{
				castv2Client.close();
			} catch(e) {
				log('error', 'CastDevice.playMedia()', 'castv2Client.close() exception: '+e, castDevice.id );
			}
		}, 5000);
	} catch(e) {
		log('error', 'CastDevice.playMedia()', 'exception: '+e, castDevice.id );
	}
}

function createSubscription(castDevice, callback) {
	castDevice.removeSubscription();
	castDevice.callback = url.parse('http://'+callback);

	log('info', 'CastDevice.createSubscription()', 'callback: '+ JSON.stringify(castDevice.callback), castDevice.id);

	castDevice.event.on('statusChange', function() {
		sendCallBack( castDevice.toString(), castDevice.callback );
	});

	castDevice.event.on('linkChanged', function() {
		sendCallBack( castDevice.toString(), castDevice.callback );
	});

	castDevice.event.emit('statusChange');
}

function sendCallBack(status, callback) {
	log( 'debug', 'sendCallBack()', 'to: '+ JSON.stringify(callback) +', status: ' + JSON.stringify(status), status.id );

	try{
		var data = JSON.stringify(status);

		var options = {
			hostname: callback.hostname,
			port: callback.port,
			path: callback.path,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(data)
			}
		};

		var req = http.request(options, function(res) {
			res.setEncoding('utf8');
			/*res.on('data', function (chunk) {
				console.log("Answer: " + chunk);
			});*/
		});

		req.write(data);
		req.end();
	} catch (e) {
		log('error', 'sendCallBack()', 'cannot send callback: ' + JSON.stringify(callback) + ', error: ' + error, status.id);
	}
}

function getRestOfPathArray(pathArray, start) {
	var restOfPathArray = '';
	pathArray.forEach(function(element, index) {
		if (index >= start) {
			if (index != start) {
				restOfPathArray += '/';
			}
			restOfPathArray += element;
		}
	});
	if (restOfPathArray == '') {
		return null;
	} else {
		return restOfPathArray;
	}
}

//GOOGLE CAST FUNCTIONS
function getDevices() {
	return new Promise( function(resolve, reject) {
		var updateCounter=0;
		var devices = [];
		var browser = mdns.createBrowser(mdns.tcp('googlecast'));
		var exception;

		try {
			browser.on('ready', function(){
				browser.discover();
			});

			browser.on('update', function(service){
				try {
					updateCounter++;
					log('debug', 'getDevices()', 'update received, service: ' + JSON.stringify(service));
					var currentDevice = {
						id: getId(service.txt[0]),
						name: getFriendlyName(service.txt),
						ip: service.addresses[0],
						port: service.port
					}
			  		if (!duplicateDevice(devices, currentDevice)&&service.type[0].name!='googlezone') {
			  			devices.push(currentDevice);
			  			updateExistingCastDeviceAddress(currentDevice);
			  			log('debug', 'getDevices()', 'added device: '+ JSON.stringify(currentDevice));
			  		} else {
			  			log('debug', 'getDevices()', 'duplicat or googlezone device: ' + JSON.stringify(currentDevice));
			  		}
			  	} catch (e) {
					log('error', 'getDevices()', 'exception while prcessing service: '+e);
				}
			});
		} catch (e) {
			reject('Exception caught: ' + e);
		}

		setTimeout(() => {
			try{
				browser.stop();
			} catch (e) {
				reject('Exception caught: ' + e)
			}
			log('debug', 'getDevices()', 'updateCounter: ' + updateCounter);
			devicesDiscoverd = devices;
			resolve(JSON.stringify(devices));
	  	}, timeoutDiscovery);
	});
}

function updateExistingCastDeviceAddress(discoveredDevice) {
	log('debug', 'updateExistingCastDeviceAddress()', 'discoveredDevice: ' + JSON.stringify(discoveredDevice), discoveredDevice.id );
	if ( deviceExists(discoveredDevice.id) ) {
		var castDevice = getDevice(discoveredDevice.id);
		log('debug', 'updateExistingCastDeviceAddress()', 'exists', discoveredDevice.id);
		if ( castDevice.address.host != discoveredDevice.ip || castDevice.address.port != discoveredDevice.port ) {
			log('info', 'updateExistingCastDeviceAddress()', 'updating address from: '+castDevice.address.host+':'+castDevice.address.port+' to: '+discoveredDevice.ip+':'+discoveredDevice.port, discoveredDevice.id);
			castDevice.disconnect();

			castDevice.event.once('linkChanged', function() {
				log('info', 'updateExistingCastDeviceAddress()', 'once linkChanged: ' + castDevice.link, castDevice.id);
				castDevice.address.host = discoveredDevice.ip;
				castDevice.address.port = discoveredDevice.port;
			});
		}
	}
}

function duplicateDevice(devices, device) {
	if (device.id && device.id!=null && devices && devices!=null) {
		for (var i = 0; i < devices.length; i++) {
			if(devices[i].id == device.id) {
				return true;
			}
		}
	}
	return false;
}

function getFriendlyName(serviceTxt) {
	if (!serviceTxt) {
		log('debug-error', 'getFriendlyName()', 'service.txt is missing');
		return;
	}
	var fns = serviceTxt.filter(function (txt) {
		return txt.match(/fn=*/)!=null;
	});
	if (fns.length>0) {
		var fn=fns[0];
		log('debug', 'getFriendlyName()', 'is friendly name: ' + fn);
		return (fn.replace(/fn=*/, ''));
	} else {
		log('debug', 'getFriendlyName()', 'is not friendly name: ' + fn);
	}
}

function getId(id) {
	if (id&&id!=null&&id.match(/id=*/)!=null) {
		log('debug', 'getId()', 'is id: ' + id);
		return (id.replace(/id=*/, ''));
	} else {
		log('debug', 'getId()', 'is not id: ' + id);
	}
}

function getNewRequestId(){
	if(currentRequestId > 9998){
		currentRequestId=1;
		log('debug', 'getNewRequestId()', 'reset');
	}
	log('debug', 'getNewRequestId()', currentRequestId+1);
	return currentRequestId++;
}

function getLatestVersion() {
	return new Promise( function(resolve, reject) {
		fetch('https://raw.githubusercontent.com/vervallsweg/cast-web-api/master/package.json')
			.then(function(res) {
				return res.json();
			}).then(function(json) {
				log('debug', 'getLatestVersion()', 'JSON received: '+JSON.stringify(json));
				try {
					var version = json.version
					log('debug', 'getLatestVersion()', 'version: ' + version);
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

function buildMeta(functionName, message, id) {
	// {date+time}  {id_underline} {functionName}: {message}
	var date = new Date(); var time = date.toISOString(); if (id == null) { id=''; } else { time=time+' '; };
	return time + chalk.inverse(id) + ' ' + chalk.underline(functionName) + ': ' + message;
}

function log(type, functionName, message, id) {
	if (type=='info') {
		console.log( buildMeta(functionName, message, id) );
	}
	if (type=='error') {
		console.log( chalk.red( buildMeta(functionName, message, id) ) );
	}
	if (type=='debug') {
		debug( buildMeta(functionName, message, id) );
	}
	if (type=='debug-server') {
		debug( chalk.cyan( buildMeta(functionName, message, id) ) );
	}
	if (type=='debug-warn') {
		debug( chalk.yellow( buildMeta(functionName, message, id) ) );
	}
	if (type=='debug-error') {
		debug( chalk.red( buildMeta(functionName, message, id) ) );
	}
	if (type=='server') {
		console.log( chalk.cyan( buildMeta(functionName, message, id) ) );
	}
}