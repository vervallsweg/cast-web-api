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

var hostname = '127.0.0.1';
var port = 3000;
var currentRequestId = 1;
var timeoutDiscovery = 4000;
var thisVersion = pkg.version;

var devicesDiscoverd = [];
var devicesSubscribed = [];

startApi();

function startApi() {
	interpretArguments();
	console.log('Discovering devices, please wait...');
	getDevices()
	.then(devices => {
		console.log('... done!');
		createWebServer();
	})
	.catch(errorMessage => {
		console.log('Cannot discover devices, shutting down. Error message: '+ errorMessage);
	})
}

//HANDLE ARGUMENTS
function interpretArguments() {
	debug('Args: %s', JSON.stringify(args));
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

	debug('getNetworkIp, addresses: ' + addresses);
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
			debug(requestData);

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
							console.log('PATH 3: ' + path[3]);
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
										console.log( 'settingLevel to: ' + (parseInt(path[4])/100) );
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
									console.log( 'subscribe to: ' + getRestOfPathArray(path, 4) );
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
								console.log('requestData: '+requestData);
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

			if (path[1]=="") {
				res.statusCode = 200;
				res.end('cast-web-api version ' + thisVersion)
			}
		});
	});

	server.listen(port, hostname, () => {
	 	console.log(`Server running at http://${hostname}:${port}/`);
	});

	server.on('request', (req, res) => {
		console.info('Request to: '+ req.url);
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
		console.log('getDeviceAddress(), id: '+ id);
		if ( getDeviceAddressDevicesDiscoverd(id) ) {
			console.log('getDeviceAddress(), found on try 1 id: '+ id);
			resolve( getDeviceAddressDevicesDiscoverd(id) );
		} else {
			console.log('getDeviceAddress(), RETRY id: '+ id);
			getDevices()
			.then(devices => {
				if ( getDeviceAddressDevicesDiscoverd(id) ) {
					console.log('getDeviceAddress(), found on try 2 id: '+ id);
					resolve( getDeviceAddressDevicesDiscoverd(id) );
				} else {
					console.log('getDeviceAddress(), NOT found on try 2 id: '+ id);
					reject('Device not found.');
				}
			})
			.catch(error => {
				console.log('getDeviceAddress(), error getDevices() '+ error);
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
			console.log('getDeviceAddressDevicesDiscoverd() found, id: '+ id + ', host: '+address.host + ', port: '+address.port);
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
					console.log('linkChanged: ' + getDevice(id).castConnectionReceiver.link);
					resolve( getDevice(id) );
				});
			})
			.catch(error => {
				reject(error);
			})
		}
	});
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
			connection: this.castConnectionReceiver.link,
			volume: this.status.volume,
			muted: this.status.muted,
			application: this.status.application,
			status: this.status.status,
			title: this.status.title,
			subtitle: this.status.subtitle
		}
	}

	this.volume = function(targetLevel) {
		if (this.castConnectionReceiver.receiver) {
			this.castConnectionReceiver.receiver.send({ type: 'SET_VOLUME', volume: { level: targetLevel }, requestId: getNewRequestId() });
			return {response:'ok'};
		} else {
			return {response:'error', error:'disconnected'};
		}
	}

	this.muted = function(isMuted) {
		if (this.castConnectionReceiver.receiver) {
			this.castConnectionReceiver.receiver.send({ type: 'SET_VOLUME', volume: { muted: isMuted }, requestId: getNewRequestId() });
			return {response:'ok'};
		} else {
			return {response:'error', error:'disconnected'};
		}
	}

	this.play = function() {
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
}

function connectReceiverCastDevice(castDevice) {
	try {
		console.log('CastDevice.connect() id: '+ castDevice.id + ', host: ' + castDevice.address.host + ', port: ' + castDevice.address.port );
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
		    	if (castDevice.castConnectionReceiver.link != 'connected') {
					castDevice.event.emit('linkChanged');
					castDevice.castConnectionReceiver.link = 'connected';
		    	}
		   	});

		   	castDevice.castConnectionReceiver.heartBeatIntervall = setInterval(function() {
				if (castDevice.castConnectionReceiver) {
					castDevice.castConnectionReceiver.heartbeat.send({ type: 'PING' });
				}
			}, 5000);
		});
		castDevice.castConnectionReceiver.client.on('error', function(err) {
		 	console.log('castDevice.castConnectionReceiver.client error: '+err);
		 	if (castDevice.castConnectionReceiver.link != 'disconnected') {
		 		castDevice.castConnectionReceiver.link = 'disconnected';
		 		castDevice.event.emit('linkChanged');
		 	}
		});
	} catch (e) {
		console.log('CastDevice.connect() exception: '+e);
		if (castDevice.castConnectionReceiver.link != 'disconnected') {
			castDevice.castConnectionReceiver.link = 'disconnected';
			castDevice.event.emit('linkChanged');
		}
	}
}

function disconnectReceiverCastDevice(castDevice) {
	console.log('castDevice.disconnect()');
	castDevice.castConnectionReceiver.connection.send({ type: 'CLOSE' });
	castDevice.castConnectionReceiver.client.close();
	castDevice.castConnectionReceiver.link = 'disconnected';
	castDevice.castConnectionReceiver = null;
}

function connectMediaCastDevice(castDevice, sessionId) {
	console.log('CastDevice.connectMedia() id: '+ castDevice.id + ', host: ' + castDevice.address.host + ', port: ' + castDevice.address.port + ', sessionId: ' + sessionId);
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
			if (castDevice.castConnectionMedia) {
				castDevice.castConnectionMedia.heartbeat.send({ type: 'PING' });
			}
		}, 5000);
	});
	castDevice.castConnectionMedia.client.on('error', function(err) {
		console.log('castConnectionMedia.client error: '+err);
	});
}

function disconnectMediaCastDevice(castDevice) {
	console.log('castDevice.disconnectMedia()');
	clearInterval(castDevice.castConnectionMedia.heartBeatIntervall);
	castDevice.castConnectionMedia.connection.send({ type: 'CLOSE' });
	castDevice.castConnectionMedia.client.close();
	castDevice.castConnectionMedia.link = 'disconnected';
	castDevice.castConnectionMedia = null;
	castDevice.status.status = '';
	castDevice.status.title = '';
	castDevice.status.subtitle = '';
	castDevice.event.emit('statusChange');
}

function parseReceiverStatusCastDevice(castDevice, receiverStatus) {
	debug( 'parseReceiverStatusCastDevice(), receiverStatus: ' + JSON.stringify(receiverStatus) );

	if (receiverStatus.type == 'RECEIVER_STATUS') {
		if (receiverStatus.status.applications) {
			if ( receiverStatus.status.applications[0].sessionId != castDevice.castConnectionReceiver.sessionId) {
				console.log('parseReceiverStatusCastDevice(), sessionId has changed');
				if (receiverStatus.status.applications[0].isIdleScreen!=true) {
					console.log('parseReceiverStatusCastDevice() isIdleScreen: '+receiverStatus.status.applications[0].isIdleScreen+', sessionId changed to: '+receiverStatus.status.applications[0].sessionId+', from: '+castDevice.castConnectionReceiver.sessionId);
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
}

function parseMediaStatusCastDevice(castDevice, mediaStatus) {
	debug( 'parseMediaStatusCastDevice() mediaStatus: ' + JSON.stringify(mediaStatus) );

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
}

function playMediaCastDevice(castDevice, media) {
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
			console.log('playMediaCastDevice castv2Client.close() error: '+ e );
		}
	}, 5000);
}

function createSubscription(castDevice, callback) {
	castDevice.removeSubscription();
	castDevice.callback = url.parse('http://'+callback);

	console.log('createSubscription(), for: ' + castDevice.id + ', callback: '+ JSON.stringify(castDevice.callback));

	castDevice.event.on('statusChange', function() {
		sendCallBack( castDevice.toString(), castDevice.callback );
	});

	castDevice.event.on('linkChanged', function() {
		sendCallBack( castDevice.toString(), castDevice.callback );
	});

	castDevice.event.emit('statusChange');
}

function sendCallBack(status, callback) {
	console.log( 'sendCallBack() to: '+ JSON.stringify(callback) +', status: ' + JSON.stringify(status) );
	
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
		console.log('sendCallBack(), cannot send to: ' + callback + ', error: ' + error);
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
					debug('update received, service: ' + JSON.stringify(service));
					var currentDevice = {
						id: getId(service.txt[0]),
						name: getFriendlyName(service.txt),
						ip: service.addresses[0],
						port: service.port
					}
			  		if (!duplicateDevice(devices, currentDevice)&&service.type[0].name!='googlezone') {
			  			devices.push(currentDevice);
			  			debug('Added device: '+ JSON.stringify(currentDevice));
			  		} else {
			  			debug('Duplicat or googlezone device: ' + JSON.stringify(currentDevice))
			  		}
			  	} catch (e) {
					console.error('Exception caught while prcessing service: ' + e);
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
			debug('updateCounter: ' + updateCounter);
			devicesDiscoverd = devices;
			resolve(JSON.stringify(devices));
	  	}, timeoutDiscovery);
	});
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
		debug('service.txt is missing');
		return;
	}
	var fns = serviceTxt.filter(function (txt) {
		return txt.match(/fn=*/)!=null;
	});
	if (fns.length>0) {
		var fn=fns[0];
		debug('Is friendly name: ' + fn);
		return (fn.replace(/fn=*/, ''));
	} else {
		debug('Is not friendly name: ' + fn);
	}
}

function getId(id) {
	if (id&&id!=null&&id.match(/id=*/)!=null) {
		debug('Is id: ' + id);
		return (id.replace(/id=*/, ''));
	} else {
		debug('Is not id: ' + id);
	}
}

function getNewRequestId(){
	if(currentRequestId > 9998){
		currentRequestId=1;
		debug("Rest currentRequestId");
	}
	debug("getNewRequestId: "+(currentRequestId+1))
	return currentRequestId++;
}

function getLatestVersion() {
	return new Promise( function(resolve, reject) {
		fetch('https://raw.githubusercontent.com/vervallsweg/cast-web-api/master/package.json')
			.then(function(res) {
				return res.json();
			}).then(function(json) {
				debug('getLatestVersion, json received: '+JSON.stringify(json));
				try {
					var version = json.version
					debug('getLatestVersion, version: ' + version);
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