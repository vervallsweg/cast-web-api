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
var timeoutDiscovery = 5000;
var reconnectInterval = 300000;
var discoveryInterval = 60000;
var discoveryRuns = 2;
var groupManagement = true;
var windows = false;
var thisVersion = pkg.version;

var devices = [];

interpretArguments();
if (!windows) {
	startApi();
} else {
	console.log( process.argv[1].substring(0, process.argv[1].length - 17) );
}

function startApi() {
	console.log('cast-web-api v'+thisVersion);
	console.log('Discovering devices, please wait...');
	discoverZones()
	.then(devices => {
		console.log('... done!');
		setInterval(function() {
			discoverZones();
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
	if (args.discoveryRuns) {
		discoveryRuns = args.discoveryRuns;
	}
	if (args.groupManagement) {
		groupManagement = (args.groupManagement == 'true');
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

			if (path[1]=="device") {
				if (path[2]) {
					if (path[2] == 'discover') {
						discoverZones();
						res.end( JSON.stringify( {response: 'ok'} ) );
					}
					if (path[2] == 'connected') {
						res.statusCode = 200;
						res.end( JSON.stringify( getDevices('connected') ) );
					}
					if (path[2] == 'disconnected') {
						res.statusCode = 200;
						res.end( JSON.stringify( getDevices('disconnected') ) );
					} else {
						getDeviceConnected(path[2])
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
								if (path[3]=='muted') {
									if (path[4]) {
										if (path[4]=='true') {
											result = getDevice(path[2]).muted(true);
										}
										if (path[4]=='false') {
											result = getDevice(path[2]).muted(false);
										}
									} else {
										result = {response:'error', error:'true/false unknown'};
									}
								}
								if (path[3]=='volume') {
									if (path[4]) {
										if ( parseInt(path[4])>=0 && parseInt(path[4])<=100) {
											if (path[5]) {
												if (path[5]=='group') {
													setGroupLevel( getDevice(path[2]), (parseInt(path[4])/100) );
													result = {response:'ok'};
												}
											} else {
												log('debug-server', 'path[4] targetLevel', (parseInt(path[4])/100) );
												result = getDevice(path[2]).volume( (parseInt(path[4])/100) );
											}
										} else {
											result = {response:'error', error:'level unknown'};
										}
									} else {
										result = {response:'error', error:'level unknown'};
									}
								}
								if (path[3]=='image') {
									if ( getDevice(path[2]).status.image == '' ) {
										var imgUrl = 'http://lh3.googleusercontent.com/LB5CRdhftEGo2emsHOyHz6NWSfLVD5NC45y6auOqYoyrv7BC5mdDm66vPDCEAJjcDA=w360';
									} else {
										var imgUrl = getDevice(path[2]).status.image;
									}
									var query = url.parse(imgUrl);

									var options = {
										hostname: query.hostname,
										path: query.path
									};

									log('info', '/image/', 'options: '+ JSON.stringify(options) );
									
									result = {response: 'wait'};

									var callback = function(response) {
										if (response.statusCode === 200) {
											res.setHeader('Content-Type', response.headers['content-type']);
											res.statusCode = 200;
											response.pipe(res);
										} else {
											res.statusCode = 500;
											res.end( JSON.stringify( {response:'error', error:'cannot proxy image'} ) );
										}
									};
									http.request(options, callback).end();
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
									log('info', 'playMedia()', 'requestData: '+ requestData );
									if (requestData) {
										try {
											var media = JSON.parse(requestData);
											result = getDevice(path[2]).playMedia(media);
											//result = getDevice(path[2]).playMedia();
										} catch (e) {
											result = {response:'error', error: e};
										}
									} else {
										result = {response:'error', error: 'post media unknown'};
									}
								}
								if (path[3]=='playMediaGet') {
									log('info', 'playMediaGet()', 'path: '+ path );
									if ( getRestOfPathArray(path, 4) ) {
										log('info', 'playMediaGet()', 'getRestOfPathArray: '+ decodeURI(getRestOfPathArray(path, 4)) );

										try {
											var media = JSON.parse( decodeURI(getRestOfPathArray(path, 4)) );
											result = getDevice(path[2]).playMedia(media);
										} catch (e) {
											result = {response:'error', error: e};
										}
									} else {
										result = {response:'error', error: 'post media unknown'};
									}
								}
								if (path[3]=='disconnect') {
									getDevice(path[2]).disconnect();
									result = { response:'ok' };
								}
								if (path[3]=='remove') {
									removeDevice(path[2]);
									result = { response:'ok' };
								}
								if (result.response != 'wait' ) {
									if (result.response == 'ok') {
										res.statusCode = 200;
									} else {
										res.statusCode = 500;
									}
									res.end( JSON.stringify( result ) );
								}
							} else {
								res.statusCode = 200;
								res.end( JSON.stringify( device.toString() ) );
							}
						})
						.catch(errorMessage => {
							res.statusCode = 404;
							res.end( JSON.stringify( {response: 'error', error: errorMessage} ) );
						})
					}
				} else {
					res.statusCode = 200;
					res.end( JSON.stringify( getDevices('all') ) );
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
						res.end( JSON.stringify( { timeoutDiscovery: timeoutDiscovery } ) );
					}
					if (path[2]=="reconnectInterval") {
						if (path[3]) {
							if ( parseInt(path[3]) ) {
								reconnectInterval = parseInt(path[3]);
							}
						}
						res.end( JSON.stringify( { reconnectInterval: reconnectInterval } ) );
					}
					if (path[2]=="discoveryInterval") {
						if (path[3]) {
							if ( parseInt(path[3]) ) {
								discoveryInterval = parseInt(path[3]);
							}
						}
						res.end( JSON.stringify( { discoveryInterval: discoveryInterval } ) );
					}
					if (path[2]=="discoveryRuns") {
						if (path[3]) {
							if ( parseInt(path[3]) ) {
								discoveryRuns = parseInt(path[3]);
							}
						}
						res.end( JSON.stringify( { discoveryRuns: discoveryRuns } ) );
					}
					if (path[2]=="groupManagement") {
						if (path[3]) {
							groupManagement = (path[3] == 'true');
						}
						res.end( JSON.stringify( { groupManagement: groupManagement } ) );
					}
					if (path[2]=="version") {
						if (path[3]=="this") {
							res.end( JSON.stringify( { version: thisVersion } ) );
						}
						if (path[3]=="latest") {
							getLatestVersion()
							.then(version => {
								res.end( JSON.stringify( { version: version } ) );
							})
							.catch(errorMessage => {
								res.statusCode = 500;
								res.end( JSON.stringify( { response: error, error: errorMessage } ) );
							})
						} else {
							getLatestVersion()
							.then(version => {
								res.end( JSON.stringify( { this: thisVersion, latest: version } ) );
							})
							.catch(errorMessage => {
								res.statusCode = 500;
								res.end( JSON.stringify( { response: error, error: errorMessage } ) );
							})
						}
					}
				} else {
					res.end( JSON.stringify( { timeoutDiscovery: timeoutDiscovery, reconnectInterval: reconnectInterval, discoveryInterval: discoveryInterval, groupManagement: groupManagement } ) );
				}
			}

			if (path[1]=="memdump") {
				res.statusCode = 200;
				log( 'server', 'memory dump', util.inspect(devices) );
				res.end('ok');
			}

			if (path[1]=="") {
				res.statusCode = 200;
				res.end('{ "cast-web-api" : "v' + thisVersion + '" }')
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

	server.on('clientError', (err, socket) => {
		socket.end('HTTP/1.1 500 Internal Server Error\r\n\r\n');
	});
}

function deviceExists(id) {
	var exists = false;
	devices.forEach(function(element) {
		if (element.id == id) {
			exists = true;
		}
	});
	return exists;
}

function getDevice(id) {
	var returnElement = null;
	devices.forEach(function(element) {
		if (element.id == id) {
			returnElement = element;
		}
	});
	return returnElement;
}

function getDevices(connection) {
	var allDevices = [];
	devices.forEach(function(element) {
		if (connection == 'all') {
			allDevices.push( element.toString() );
		} else {
			if (element.link == connection) {
				allDevices.push( element.toString() );
			}
		}
	});
	return allDevices;
}

function getDeviceConnected(id){
	return new Promise( function(resolve, reject) {
		if ( getDevice(id) ) {
			if ( getDevice(id).link == 'connected' ) {
				resolve( getDevice(id) );
			} else {
				getDevice(id).connect();

				getDevice(id).event.once('linkChanged', function() {
					log('debug', 'getDeviceConnected()', 'once linkChanged: ' + getDevice(id).link, id);
					resolve( getDevice(id) );
				});

				setTimeout(function() {
					resolve( getDevice(id) );
				}, 5000);
				//TODO: better solution
			}
			
		} else {
			reject("Device doesn't exist");
		}
	});
}

function removeDevice(id) {
	log('info', 'removeDevice()', '', id);
	if ( deviceExists(id) ) {
		var targetIndex = null;

		getDevice(id).disconnect();

		devices.forEach(function(element, index) {
			if (element.id == id) {
				targetIndex = index;
			}
		});
	
		if (targetIndex!=null) {
			devices.splice(targetIndex, 1)
		}
	}
}

function CastDevice(id, address, name) {
	this.id = id;
	this.address = address;
	this.name = name;
	this.event = new events.EventEmitter();
	this.link = 'disconnected';
	this.reconnectInterval;
	this.castConnectionReceiver;
	this.castConnectionMedia;
	this.status = {
		volume: 0,
		muted: false,
		application: '',
		status: '',
		title: '',
		subtitle: '',
		image: ''
	}

	this.connect = function() {
		connectReceiverCastDevice(this);
		if (groupManagement) {
			connectGroupMembers(this);
		}
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
			name: this.name,
			connection: this.link,
			address: this.address,
			status: this.status,
			groups: this.groups,
			members: this.members
		}
	}

	this.volume = function(targetLevel) {
		log('info', 'CastDevice.volume()', targetLevel, this.id);
		if (this.castConnectionReceiver.receiver && this.link == 'connected') {
			this.castConnectionReceiver.receiver.send({ type: 'SET_VOLUME', volume: { level: targetLevel }, requestId: getNewRequestId() });
			return {response:'ok'};
		} else {
			return {response:'error', error:'disconnected'};
		}
	}

	this.muted = function(isMuted) {
		log('info', 'CastDevice.muted()', isMuted, this.id);
		if (this.castConnectionReceiver.receiver && this.link == 'connected') {
			this.castConnectionReceiver.receiver.send({ type: 'SET_VOLUME', volume: { muted: isMuted }, requestId: getNewRequestId() });
			return {response:'ok'};
		} else {
			return {response:'error', error:'disconnected'};
		}
	}

	this.play = function() {
		log('info', 'CastDevice.play()', '', this.id);
		if (this.castConnectionMedia && this.link == 'connected') {
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
		if (this.castConnectionMedia && this.link == 'connected') {
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
		if (this.castConnectionReceiver.sessionId && this.link == 'connected') {
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
		log('info', 'CastDevice.removeSubscription()', '', this.id);
		//this.event.removeAllListeners('statusChange'); //Breaks group man
		//this.event.removeAllListeners('linkChanged'); //Breaks reconnect man
		delete this.callback;
		return {response:'ok'};
	}

	this.setStatus = function(key, value) {
		if (key=='volume' || key=='muted' || key=='application' || key=='status' || key=='title' || key=='subtitle' || key=='image' || key=='groupPlayback') {
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

	this.setZones = function(zones) {
		setZonesCastDevice(this, zones);
	}

	reconnectionManagementInit(this);
	subscriptionInit(this);
	connectGroupMembersInit(this);
}

function connectReceiverCastDevice(castDevice) {
	try {
		log('info', 'CastDevice.connect()', 'host: ' + castDevice.address.host + ', port: ' + castDevice.address.port, castDevice.id );
		castDevice.link = 'connecting';
		castDevice.castConnectionReceiver = new Object();
		castDevice.castConnectionReceiver.client = new Client();

		castDevice.castConnectionReceiver.client.connect(castDevice.address, function() {
			try {
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

			   	castDevice.castConnectionReceiver.receiver.on('error', function(error) {
			   		log('error', 'CastDevice.connect()', 'castDevice.castConnectionReceiver.receiver error: '+error, castDevice.id);
					castDevice.disconnect();
			   	});

			   	castDevice.castConnectionReceiver.connection.on('error', function(error) {
			   		log('error', 'CastDevice.connect()', 'castDevice.castConnectionReceiver.connection error: '+error, castDevice.id);
					castDevice.disconnect();
			   	});

			   	castDevice.castConnectionReceiver.heartBeatIntervall = setInterval(function() {
					if (castDevice.castConnectionReceiver) {
						try {
							castDevice.castConnectionReceiver.heartbeat.send({ type: 'PING' });
						} catch (e) {
							log('error', 'CastDevice.connect() castConnectionReceiver.heartBeatIntervall', 'exception: '+e, castDevice.id);
							castDevice.disconnect(); //TODO:
						}
						
					}
				}, 5000);
			} catch (e) {
				log('error', 'CastDevice.connect()', 'exception: '+e, castDevice.id);
				castDevice.disconnect();
			}
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
			//castDevice.castConnectionReceiver = null;
		}
	} catch (e) {
		//castDevice.castConnectionReceiver = null;
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
	if (castDevice.link=='disconnected') {
		if (castDevice.reconnectInterval==null) {
			log('debug', 'reconnectionManagement()', 'starting interval', castDevice.id);
			castDevice.reconnectInterval = setInterval(function() {
				log('debug', 'reconnectionManagement()', 'reconnect evaluating', castDevice.id);
				if (castDevice.link!='connected') {
					log('info', 'reconnectionManagement()', 'reconnecting', castDevice.id);
					castDevice.connect();
				}
			}, reconnectInterval);
		}
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
			try {
				castDevice.castConnectionMedia.connection = castDevice.castConnectionMedia.client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
				castDevice.castConnectionMedia.heartbeat = castDevice.castConnectionMedia.client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.tp.heartbeat', 'JSON');
				castDevice.castConnectionMedia.media = castDevice.castConnectionMedia.client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.media', 'JSON');

				castDevice.castConnectionMedia.connection.send({ type: 'CONNECT' });
				castDevice.castConnectionMedia.media.send({ type: 'GET_STATUS', requestId: getNewRequestId() });

				castDevice.castConnectionMedia.media.on('message', function(data, broadcast) {
					parseMediaStatusCastDevice(castDevice, data);
					castDevice.castConnectionMedia.link = 'connected';
				});

				castDevice.castConnectionMedia.media.on('error', function(error) {
					log('error', 'CastDevice.connectMedia()', 'castDevice.castConnectionMedia.media error: '+error, castDevice.id);
					castDevice.disconnectMedia();
				});

				castDevice.castConnectionMedia.connection.on('error', function(error) {
					log('error', 'CastDevice.connectMedia()', 'castDevice.castConnectionMedia.connection error: '+error, castDevice.id);
					castDevice.disconnectMedia();
				})

				castDevice.castConnectionMedia.heartBeatIntervall = setInterval(function() {
					try {
						if (castDevice.castConnectionMedia && castDevice.link=='connected') {
							castDevice.castConnectionMedia.heartbeat.send({ type: 'PING' });
						}
					} catch(e) {
						log('error', 'CastDevice.connectMedia()', 'heartbeat exception: '+e, castDevice.id);
						castDevice.disconnectMedia();
					}
				}, 5000);
			} catch(e) {
				log('error', 'CastDevice.connectMedia()', 'exception: '+e, castDevice.id);
				castDevice.disconnectMedia();
			}
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
			castDevice.status.image = '';
			castDevice.event.emit('statusChange');
			//castDevice.castConnectionMedia = null;
		}
	} catch(e) {
		log('error', 'CastDevice.disconnectMedia()', 'exception: '+e, castDevice.id); //TODO: Notify subscriber
		//castDevice.castConnectionMedia = null;
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
						if (metadataType>=0 && metadataType<4) {
							if (mediaStatus.status[0].media.metadata.images) {
								if (mediaStatus.status[0].media.metadata.images[0]) {
									castDevice.setStatus('image', mediaStatus.status[0].media.metadata.images[0].url);
								}
							}
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
		var mediaList = [];

		media.forEach(function(element, index) {
			var mediaElement =  {
				autoplay : true,
				preloadTime : 5,
				activeTrackIds : [],
				//playbackDuration: 4,
				//startTime : 1,
				media: {
					contentId: element.mediaUrl,
					contentType: element.mediaType,
					streamType: element.mediaStreamType,
					metadata: {
						type: 0,
						metadataType: 0,
						title: element.mediaTitle,
						subtitle: element.mediaSubtitle,
						images: [ { url: element.mediaImageUrl } ]
					}
				}
			};
			log('info', 'CastDevice.playMedia()', 'mediaElement: ' + JSON.stringify(mediaElement), castDevice.id);
			mediaList.push(mediaElement);
		});

		log('info', 'CastDevice.playMedia()', 'mediaList: ' + JSON.stringify(mediaList), castDevice.id);
		
	  	castv2Client.connect(castDevice.address, function() {
			castv2Client.launch(DefaultMediaReceiver, function(err, player) {
				player.queueLoad(mediaList, {startIndex:0, repeatMode: "REPEAT_OFF"}, function(err, status) {
					log('info', 'CastDevice.playMedia()', 'loaded queue: ' + status, castDevice.id);
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

function subscriptionInit(castDevice) {
	log('debug', 'CastDevice.subscriptionInit()', '', castDevice.id);
	castDevice.event.on('statusChange', function() {
		if (castDevice.callback) {
			//log('info', 'CastDevice.subscriptionInit()', 'castDevice.toString(): '+JSON.stringify( castDevice.toString() )+', '+JSON.stringify( castDevice.callback ), castDevice.id);
			sendCallBack( castDevice.toString(), castDevice.callback );
		}
	});

	castDevice.event.on('linkChanged', function() {
		if (castDevice.callback) {
			//log('info', 'CastDevice.subscriptionInit()', 'castDevice.toString(): '+JSON.stringify( castDevice.toString() )+', '+JSON.stringify( castDevice.callback ), castDevice.id);
			sendCallBack( castDevice.toString(), castDevice.callback );
		}
	});
}

function createSubscription(castDevice, callback) {
	castDevice.removeSubscription();

	try {
		castDevice.callback = url.parse('http://'+callback);
	} catch(e) {
		delete castDevice.callback;
	}
	
	log('info', 'CastDevice.createSubscription()', 'callback: '+ JSON.stringify(castDevice.callback), castDevice.id);
	if (castDevice.callback) {
		sendCallBack( castDevice.toString(), castDevice.callback );
	}
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

		req.on('error', function(error) {
			log('error', 'sendCallBack()', 'cannot send callback: ' + JSON.stringify(callback) + ', error: ' + error, status.id);
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

function discoverZones() {
	return new Promise( function(resolve, reject) {
		if ( getNetworkIp() ) {
			discoverTimes(discoveryRuns, [])
			.then(zoneResults => {
				var merged = [];
				zoneResults.forEach(function(zoneResult) {
					zoneResult.zones.forEach(function(zone) {
						var exists = false;

						merged.forEach(function(mergedZone) {
							if (mergedZone.id == zone.id) {
								exists = true;
								if (zone.groups) {
									zone.groups.forEach(function(groupId) {
										if (mergedZone.groups.indexOf(groupId) < 0) {
											mergedZone.groups.push(groupId);
										}
									});
								}
							}
						});
						
						if (!exists) {
							merged.push(zone);
							log('debug', 'discoverZones()', 'doesnt exist, pushing: ' + zone.id);
						} else {
							log('debug', 'discoverZones()', 'exists, pushed already: ' + zone.id);
						}
					});
				});
				createGoogleZones(merged);
				resolve(merged);			
			})
			.catch(errorMessage => {
				log('error', 'discoverZones()', 'failed: ' + errorMessage);
				reject(errorMessage);
			})
		} else {
			resolve({});
		}
	});
}

function discoverTimes(times, zoneResults) {
	return new Promise( function(resolve, reject) {
		discover('googlezone')
		.then(devices => {
			log('debug', 'discoverTimes()', 'discover("googlezone") done times: '+times+', zoneResults: '+zoneResults+', typeof: '+ typeof zoneResults);
			zoneResults.push({ zones: devices });
			if (times>1) {
				log( 'debug', "discoverTimes()", 'newZoneResults: '+zoneResults+', new times: '+(times-1) );
				resolve( discoverTimes( (times-1), zoneResults ) );
			} else {
				discover('googlecast')
				.then(devices => {
					resolve( zoneResults );
				})
				.catch(errorMessage => {
					log('error', 'discoverTimes()', 'discover("googlecast") failed: ' + errorMessage);
					resolve( zoneResults );
				})
			}
		})
		.catch(errorMessage => {
			log('error', 'discoverTimes()', 'discover("googlezone") failed: ' + errorMessage);
			reject(errorMessage);
		})
	});
}

function existsInMerged(merged, id) {
	var exists = false;
	merged.forEach(function(zone) {
		if (zone.id == id) {
			exists = true;
		}
	});
	return exists;
}

//GOOGLE CAST FUNCTIONS 'googlecast' 'googlezone'
function discover(target) {
	var both = false;
	if (!target) {
		target = 'googlecast';
		both = true;
	}
	return new Promise( function(resolve, reject) {
		var updateCounter=0;
		var discovered = [];
		try {
			if (getNetworkIp) {
				var browser = mdns.createBrowser(mdns.tcp(target));
				var exception;

				browser.on('error', function(error) {
					log('debug', 'discover()', 'mdns browser error: ' + error);
				})

				browser.on('ready', function(){
					browser.discover();
				});

				browser.on('update', function(service){
					try {
						updateCounter++;
						log('debug', 'discover()', 'update received, service: ' + JSON.stringify(service));
						if (target=='googlecast' && service.type[0].name==target) {
							var currentDevice = {
								id: getId(service.txt[0]),
								name: getFriendlyName(service.txt),
									address: {
										host: service.addresses[0],
										port: service.port
								}
							}
					  		if (!duplicateDevice(discovered, currentDevice) && currentDevice.name!=null ) {
					  			log('debug', 'discover()', 'found device: '+ JSON.stringify(currentDevice));
					  			discovered.push(currentDevice);
					  			updateExistingCastDeviceAddress(currentDevice);

					  			if ( !deviceExists(currentDevice.id) ) {
					  				log('info', 'discover()', 'added device name: '+ currentDevice.name +', address: '+ JSON.stringify(currentDevice.address), currentDevice.id);
					  				devices.push( new CastDevice( currentDevice.id, currentDevice.address, currentDevice.name ) ); //TODO: addDevice
					  			}
					  		} else {
					  			log('debug', 'discover()', 'duplicate, googlezone device or empy name: ' + JSON.stringify(currentDevice));
					  		}
						}
						if (target=='googlezone' && service.type[0].name==target) {
							var currentGroupMembership = {
								id: getId(service.txt[0]).replace(/-/g, ''),
								groups: getGroupIds(service.txt)
							}
							log('debug', 'discover()', 'found googlezone: ' + JSON.stringify(currentGroupMembership) );
							discovered.push(currentGroupMembership);
						}
				  	} catch (e) {
						log('error', 'discover()', 'exception while prcessing service: '+e);
					}
				});
			}
		} catch (e) {
			reject('Exception caught: ' + e);
		}

		setTimeout(() => {
			try{
				browser.stop();
			} catch (e) {
				//reject('Exception caught: ' + e)
			}
			log('debug', 'discover()', 'updateCounter: ' + updateCounter);
			resolve(discovered);
	  	}, timeoutDiscovery);
	});
}

function updateExistingCastDeviceAddress(discoveredDevice) {
	log('debug', 'updateExistingCastDeviceAddress()', 'discoveredDevice: ' + JSON.stringify(discoveredDevice), discoveredDevice.id );
	if ( deviceExists(discoveredDevice.id) ) {
		var castDevice = getDevice(discoveredDevice.id);
		log('debug', 'updateExistingCastDeviceAddress()', 'exists', discoveredDevice.id);
		castDevice.name = discoveredDevice.name;
		if (discoveredDevice.address.host && discoveredDevice.address.port) {
			if (castDevice.address.host != discoveredDevice.address.host || castDevice.address.port != discoveredDevice.address.port) {
				log('info', 'updateExistingCastDeviceAddress()', 'updating address from: '+castDevice.address.host+':'+castDevice.address.port+' to: '+discoveredDevice.address.host+':'+discoveredDevice.address.port, discoveredDevice.id);

				if (castDevice.link == 'connected') {
					castDevice.disconnect();
					castDevice.event.once('linkChanged', function() {
						log('info', 'updateExistingCastDeviceAddress()', 'once linkChanged: ' + castDevice.link, castDevice.id);
						castDevice.address = {
							host: discoveredDevice.address.host,
							port: discoveredDevice.address.port
						};
					});
				} else {
					castDevice.address = {
						host: discoveredDevice.address.host,
						port: discoveredDevice.address.port
					};
				}
			}
		}
	}
}

function createGoogleZones(discoveredZones) {
	log( 'debug', 'createGoogleZones()', 'discoveredZones: ' + JSON.stringify(discoveredZones) );
	var zones = discoveredZones;

	discoveredZones.forEach(function(device) {
		if (device.groups) {
			device.groups.forEach(function(groupId) {
				var groupExists = false;
				zones.forEach(function(element) {
					if (element.id == groupId) {
						groupExists = element;
					}
				});
				if (groupExists) {
					log( 'debug', 'createGoogleZones()', 'groupExists: ' + JSON.stringify(groupExists) );
					groupExists.members.push(device.id);
				} else {
					log( 'debug', 'createGoogleZones()', 'group doesnt exist: ' + groupExists );
					zones.push({
						id: groupId,
						members: [ device.id ]
					});
				}
			});
		}
	});

	log( 'debug', 'createGoogleZones()', 'done! zones: ' + JSON.stringify(zones) );
	devices.forEach(function(device) {
		var zone = { id: device.id };
		
		zones.forEach(function(element) {
			if (element.id == device.id) {
				zone = element;
			}
		});

		device.setZones(zone);
	})
}

function setZonesCastDevice(castDevice, zones) {
	log( 'debug', 'setZonesCastDevice()', 'zones: ' + JSON.stringify(zones), castDevice.id );
	
	if (zones.members) {
		if (castDevice.members) {
			zones.members.forEach(function(memberId) {
				if ( castDevice.members.indexOf(memberId) < 0 ) {
					//log( 'info', 'setZonesCastDevice()', 'added ('+ castDevice.name +') group member: ' + memberId, castDevice.id );
					castDevice.event.emit('groupChange', 'add', { id: castDevice.id, members: [memberId] });
				}
			});
			castDevice.members.forEach(function(memberId) {
				if ( zones.members.indexOf(memberId) < 0 ) {
					//log( 'error', 'setZonesCastDevice()', 'removed ('+ castDevice.name +') group member: ' + memberId, castDevice.id );
					castDevice.event.emit('groupChange', 'remove', { id: castDevice.id, members: [memberId] });
				}
			});
		} else {
			//log( 'info', 'setZonesCastDevice()', 'added ('+ castDevice.name +') group members: ' + zones.members, castDevice.id );
			castDevice.event.emit('groupChange', 'add', { id: castDevice.id, members: zones.members });
		}
		castDevice.members = zones.members;
	} else {
		if (castDevice.members) {
			//log( 'error', 'setZonesCastDevice()', 'removed ('+ castDevice.name +') group members: ' + castDevice.members, castDevice.id );
			castDevice.event.emit('groupChange', 'remove', { id: castDevice.id, members: castDevice.members });
		}
		delete castDevice.members;
	}

	if (zones.groups) {
		if (castDevice.groups) {
			zones.groups.forEach(function(groupId) {
				if ( castDevice.groups.indexOf(groupId) < 0 ) {
					//log( 'info', 'setZonesCastDevice()', 'added ('+ castDevice.name +') group: ' + groupId, castDevice.id );
					castDevice.event.emit('groupChange', 'add', { id: castDevice.id, groups: [groupId] });
				}
			});
			castDevice.groups.forEach(function(groupId) {
				if ( zones.groups.indexOf(groupId) < 0 ) {
					//log( 'info', 'setZonesCastDevice()', 'removed ('+ castDevice.name +') group: ' + groupId, castDevice.id );
					castDevice.event.emit('groupChange', 'remove', { id: castDevice.id, groups: [groupId] });
				}
			});
		} else {
			//log( 'info', 'setZonesCastDevice()', 'added ('+ castDevice.name +') groups: ' + zones.groups, castDevice.id );
			castDevice.event.emit('groupChange', 'add', { id: castDevice.id, groups: zones.groups });
		}
		castDevice.groups = zones.groups;
	} else {
		if (castDevice.groups) {
			//log( 'error', 'setZonesCastDevice()', 'removed ('+ castDevice.name +') groups: ' + castDevice.groups, castDevice.id );
			castDevice.event.emit('groupChange', 'remove', { id: castDevice.id, groups: castDevice.groups });
		}
		delete castDevice.groups;
	}

}

function connectGroupMembersInit(castDevice) {
	castDevice.event.on('statusChange', function() {
		if (castDevice.members) {
			if (castDevice.status.application) {
				if (castDevice.status.application!='Backdrop' && castDevice.status.application!='') { //TODO: use isIdleScreen
					syncGroupMemberStatus(castDevice.status, castDevice.members, castDevice.id, true);
				} else {
					syncGroupMemberStatus({ application: '', status: '', title: '', subtitle: '', image: '' }, castDevice.members, castDevice.id, false);
				}
			} else {
				syncGroupMemberStatus({ application: '', status: '', title: '', subtitle: '', image: '' }, castDevice.members, castDevice.id, false);
			}
		}
	});

	castDevice.event.on('groupChange', function(operation, zone) {
		var level = 'info';

		if (operation == 'remove') {
			level = 'error';
		}

		if (zone.members) {
			log( level, 'on groupChange()', operation+' members: ' + zone.members, zone.id );
			if (operation == 'remove') {
				zone.members.forEach(function(memberId) {
					if ( deviceExists(memberId) ) {
						var member = getDevice(memberId);
						if (member.groupPlayback) {
							log( level, 'on groupChange()', 'resetting groupPlayback for member: ' + memberId, zone.id );
							syncGroupMemberStatus({ application: '', status: '', title: '', subtitle: '', image: '' }, [memberId], zone.id, false);
						}
					}
				});
			}
			if (operation == 'add') {
				if ( deviceExists(zone.id) ) {
					var group = getDevice(zone.id);
					log( level, 'on groupChange()', 'evaluating groupPlayback for new members: ' + zone.members, zone.id );
					group.event.emit('statusChange'); //maybe delay, coz event call before actual castDevice change
				}
			}
		}

		if (zone.groups) {
			log( level, 'on groupChange()', operation+' groups: ' + zone.groups, zone.id );
		}
	});
}

function connectGroupMembers(castDevice) {
	if (castDevice.members) {
		castDevice.members.forEach(function(member) {
			if ( deviceExists(member) && member && member!='' ) {
				var castDeviceMember = getDevice(member);
				if (castDeviceMember.link=='disconnected') {
					log( 'info', 'connectGroupMembers()', 'connecting member: ' + castDeviceMember.id + ', castDeviceMember.link: '+castDeviceMember.link, castDevice.id );
					//castDeviceMember.link = 'connecting';
					castDeviceMember.connect();
				}
			}
		});
	}

	if (castDevice.groups) {
		castDevice.groups.forEach(function(group) {
			if ( group && group!='' && deviceExists(group) ) {
				var castDeviceGroup = getDevice(group);
				if (castDeviceGroup.link=='disconnected') {
					log( 'info', 'connectGroupMembers()', 'connecting group: ' + group + ', castDeviceGroup.link: '+castDeviceGroup.link, castDevice.id );
					//castDeviceGroup.link = 'connecting';
					castDeviceGroup.connect();
				}
			}
		});
	}
}

function syncGroupMemberStatus(status, members, id, groupPlayback) {
	log( 'info', 'syncGroupMemberStatus('+groupPlayback+')', 'to members: '+ members +', new status: '+ JSON.stringify(status), id);

	members.forEach(function(member) {
		if ( deviceExists(member) || member || member!='' ) {
			var castDeviceMember = getDevice(member);
			castDeviceMember.status.groupPlayback = groupPlayback;
			for (var key in status) {
				if (key != 'volume' && key != 'muted') {
					castDeviceMember.setStatus(key, status[key]);
				}
			}
		}
	});
}

function setGroupLevel(castDevice, level) {
	log('info', 'setGroupLevel()', 'target level: '+ level, castDevice.id);
	if (castDevice.members) {
		castDevice.members.forEach(function(member) {
			if ( deviceExists(member) || member || member!='' ) {
				getDevice(member).volume(level);
			}
		});
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

function getGroupIds(serviceTxt) {
	var groupIds = [];
	serviceTxt.forEach(function(element) {
		try {
			if (!element.includes('id') && !element.includes('__common_time__')) {
				var groupId = element.split('|', 1)[0].split('=', 1)[0]
				log( 'debug', 'getGroupIds()', 'memberId: ' +  groupId);
				if (groupId && groupId != '') {
					groupIds.push(groupId);
				}
			}
		} catch (e) {
			log( 'error', 'getGroupIds()', 'cannot get member, error: ' + e );
		}
	});
	return groupIds;
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