const http = require('http');
const Client = require('castv2').Client;
var mdns = require('mdns-js');
const url = require('url');
const debug = require('debug')('cast-web-api');
const args = require('minimist')(process.argv.slice(2));
var hostname = '127.0.0.1';
var port = 3000;
var currentRequestId = 1;
var networkTimeout = 2000; //Maybe to little time?
var appLoadTimeout = 6000;

interpretArguments();
createWebServer();

//HANDLE ARGUMENTS
function interpretArguments() {
	debug('Args: %s', JSON.stringify(args));
	if (args.hostname) {
		hostname = args.hostname;
	}
	if (args.port) {
		port = args.port;
	}
	if (args.networkTimeout) {
		networkTimeout = args.networkTimeout;
	}
	if (args.appLoadTimeout) {
		appLoadTimeout = args.appLoadTimeout;
	}
	if (args.currentRequestId) {
		currentRequestId = args.currentRequestId;
	}
}

//WEBSERVER
function createWebServer() {
	const server = http.createServer((req, res) => {
		var parsedUrl = url.parse(req.url, true);

		if (parsedUrl['pathname']=="/getDevices") {
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			getDevices().then(devices => {
				if (devices) {
					res.statusCode = 200;
					res.end(devices);
				} else {
					res.statusCode = 500;
					res.end();
				}
			});
		}

		else if (parsedUrl['pathname']=="/getDeviceStatus") {
			if (parsedUrl['query']['address']) {
				getDeviceStatus(parsedUrl['query']['address']).then(deviceStatus => {
					if (deviceStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json; charset=utf-8');
						res.end(deviceStatus);
					} else {
						res.statusCode = 500;
						res.end();
					}
				});
			} else {
				res.statusCode = 400;
				res.end('Parameter error');
			}
		}

		else if (parsedUrl['pathname']=="/setDeviceVolume") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			if (parsedUrl['query']['address'] && parsedUrl['query']['volume']) {
				setDeviceVolume(parsedUrl['query']['address'], parseFloat(parsedUrl['query']['volume'])).then(deviceStatus => {
					if (deviceStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json; charset=utf-8');
						res.end(deviceStatus);
					} else {
						res.statusCode = 500;
						res.end();
					}
				});
			} else {
				res.statusCode = 400;
				res.end('Parameter error');
			}
		}

		else if (parsedUrl['pathname']=="/setDeviceMuted") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			if (parsedUrl['query']['address'] && parsedUrl['query']['muted']) {
				setDeviceMuted(parsedUrl['query']['address'], (parsedUrl['query']['muted']=="true")).then(deviceStatus => {
					if (deviceStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json; charset=utf-8');
						res.end(deviceStatus);
					} else {
						res.statusCode = 500;
						res.end();
					}
				});
			} else {
				res.statusCode = 400;
				res.end('Parameter error');
			}
		}

		else if (parsedUrl['pathname']=="/getMediaStatus") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			if (parsedUrl['query']['address'] && parsedUrl['query']['sessionId']) {
				getMediaStatus(parsedUrl['query']['address'], parsedUrl['query']['sessionId']).then(mediaStatus => {
					if (mediaStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json; charset=utf-8');
						res.end(mediaStatus);
					} else {
						res.statusCode = 500;
						res.end();
					}
				});
			} else {
				res.statusCode = 400;
				res.end('Parameter error');
			}
		}

		else if (parsedUrl['pathname']=="/setMediaPlaybackPause") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			if (parsedUrl['query']['address'] && parsedUrl['query']['sessionId'] && parsedUrl['query']['mediaSessionId']) {
				setMediaPlaybackPause(parsedUrl['query']['address'], parsedUrl['query']['sessionId'], parsedUrl['query']['mediaSessionId']).then(mediaStatus => {
					if (mediaStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json; charset=utf-8');
						res.end(mediaStatus);
					} else {
						res.statusCode = 500;
						res.end();
					}
				});
			} else {
				res.statusCode = 400;
				res.end('Parameter error');
			}
		}

		else if (parsedUrl['pathname']=="/setMediaPlaybackPlay") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			if (parsedUrl['query']['address'] && parsedUrl['query']['sessionId'] && parsedUrl['query']['mediaSessionId']) {
				setMediaPlaybackPlay(parsedUrl['query']['address'], parsedUrl['query']['sessionId'], parsedUrl['query']['mediaSessionId']).then(mediaStatus => {
					if (mediaStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json; charset=utf-8');
						res.end(mediaStatus);
					} else {
						res.statusCode = 500;
						res.end();
					}
				});
			} else {
				res.statusCode = 400;
				res.end('Parameter error');
			}
		}

		else if (parsedUrl['pathname']=="/setDevicePlaybackStop") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			if (parsedUrl['query']['address'] && parsedUrl['query']['sessionId']) {
				setDevicePlaybackStop(parsedUrl['query']['address'], parsedUrl['query']['sessionId']).then(mediaStatus => {
					if (mediaStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json; charset=utf-8');
						res.end(mediaStatus);
					} else {
						res.statusCode = 500;
						res.end();
					}
				});
			} else {
				res.statusCode = 400;
				res.end('Parameter error');
			}
		}

		else if (parsedUrl['pathname']=="/setMediaPlayback") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			if (parsedUrl['query']['address'] && parsedUrl['query']['mediaType'] && parsedUrl['query']['mediaUrl'] && parsedUrl['query']['mediaStreamType'] && parsedUrl['query']['mediaTitle'] && parsedUrl['query']['mediaSubtitle'] && parsedUrl['query']['mediaImageUrl']) {
				setMediaPlayback(parsedUrl['query']['address'], parsedUrl['query']['mediaType'], parsedUrl['query']['mediaUrl'], parsedUrl['query']['mediaStreamType'], parsedUrl['query']['mediaTitle'], parsedUrl['query']['mediaSubtitle'], parsedUrl['query']['mediaImageUrl']).then(mediaStatus => {
					if (mediaStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json; charset=utf-8');
						res.end(mediaStatus);
					} else {
						res.statusCode = 500;
						res.end();
					}
				});
			} else {
				res.statusCode = 400;
				res.end('Parameter error');
			}
		}

		else if (parsedUrl['pathname']=="/setConfig") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			if (parsedUrl['query']['networkTimeout']) {
				networkTimeout = parsedUrl['query']['networkTimeout'];
				res.end('{"response": "ok", "networkTimeout": '+networkTimeout+'}');
			} else if (parsedUrl['query']['currentRequestId']) {
				currentRequestId = parsedUrl['query']['currentRequestId']
				res.end('{"response": "ok", "currentRequestId": '+currentRequestId+'}');
			} else if (parsedUrl['query']['appLoadTimeout']) {
				appLoadTimeout = parsedUrl['query']['appLoadTimeout']
				res.end('{"response": "ok", "appLoadTimeout": '+appLoadTimeout+'}');
			} else {
				res.statusCode = 400;
				res.end('Parameter error');
			}
		}

		else if (parsedUrl['pathname']=="/getConfig") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			//console.log("parsedUrl.searchParams: "+ parsedUrl.searchParams);
			
			if (parsedUrl['query']['networkTimeout']) {
				res.end('{"networkTimeout": '+networkTimeout+'}');
			} else if (parsedUrl['query']['currentRequestId']) {
				res.end('{"currentRequestId": '+currentRequestId+'}');
			} else if (parsedUrl['query']['appLoadTimeout']) {
				res.end('{"appLoadTimeout": '+appLoadTimeout+'}');
			} else {
				res.statusCode = 400;
				res.end('Parameter error');
			}
		}

		else {
			res.statusCode = 404;
			res.end('Not found');
		}
	});

	server.listen(port, hostname, () => {
	 	console.log(`Server running at http://${hostname}:${port}/`);
	});

	server.on('request', (req, res) => {
		console.info('Request to: '+ req.url);
	});
}

//GOOGLE CAST FUNCTIONS
function getDevices() {
	var devices = [];
	var browser = mdns.createBrowser(mdns.tcp('googlecast'));
	var exception;

	try {
		browser.on('ready', function(){
			browser.discover();
		});

		browser.on('update', function(service){
			console.log('update received, service: ' + JSON.stringify(service));
			var currentDevice = {
				deviceName: getId(service.txt[0]),
				deviceFriendlyName: getFriendlyName(service.txt[6]),
				deviceAddress: service.addresses[0],
				devicePort: service.port
			}
	  		debug('getDevices found: %s', currentDevice.toString());
	  		//TODO: Check for duplicate entry
	  		devices.push(currentDevice);
		});
	} catch (e) {
		console.error('Exception caught: ' + e);
		exception = e;
	}

	return new Promise(resolve => {
		setTimeout(() => {
			try{browser.stop();} catch (e) {console.error('Exception caught: ' + e); exception=e;}
			if (!exception) {
				if (devices.length>0) {
					debug('devices.length>0');
					resolve(JSON.stringify(devices));
				}
			}
			resolve(null);
	  	}, networkTimeout);
	});
}

function getDeviceStatus(address) {
  	return new Promise(resolve => {
		var deviceStatus, connection, receiver, exception;
		var client = new Client();
		var corrRequestId = getNewRequestId();

		try {
			debug('getDeviceStatus addr: %a', address);
		 	client.connect(parseAddress(address), function() {
			    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
			    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

			    connection.send({ type: 'CONNECT' });
				receiver.send({ type: 'GET_STATUS', requestId: corrRequestId });
			    
			    receiver.on('message', function(data, broadcast) {
				  	if(data.type == 'RECEIVER_STATUS') {
				  		if (data.requestId==corrRequestId) {
				  			deviceStatus = data;
				  			debug('getDeviceStatus recv: %s', JSON.stringify(deviceStatus));
				  			resolve(JSON.stringify(deviceStatus));
				  		}
				 	}
			   	});
		  	});
		  	client.on('error', function(err) {
			 	handleException(err);
			 	closeClientConnection(client, connection);
			 	resolve(null);
			});
		} catch (e) {
			handleException(e);
			closeClientConnection(client, connection);
			resolve(null);
		}

		setTimeout(() => {
			closeClientConnection(client, connection);
			resolve(null);
	  	}, networkTimeout);
	});
}

function setDeviceVolume(address, volume) {
	return new Promise(resolve => {
		var deviceStatus, connection, receiver, exception;
		var client = new Client();
		var corrRequestId = getNewRequestId();
		
		debug('setDeviceVolume addr: %s', address, 'volu:', volume);
	 	try {
	 		client.connect(parseAddress(address), function() {
			    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
			    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

			    connection.send({ type: 'CONNECT' });
				receiver.send({ type: 'SET_VOLUME', volume: { level: volume }, requestId: corrRequestId });
			    
			    receiver.on('message', function(data, broadcast) {
			    	if (data.requestId==corrRequestId) {
					  	if(data.type == 'RECEIVER_STATUS') {
					  		deviceStatus = data;
					  		debug('setDeviceVolume recv: %s', JSON.stringify(deviceStatus));
					  		resolve(JSON.stringify(deviceStatus));
					 	}
					}
			   	});
		  	});

		  	client.on('error', function(err) {
				handleException(err);
				closeClientConnection(client, connection);
			 	resolve(null);
			});
		} catch (e) {
		 	handleException(err);
			closeClientConnection(client, connection);
			resolve(null);
		}

		setTimeout(() => {
			closeClientConnection(client, connection);
			resolve(null);
	  	}, networkTimeout);
	});
}

function setDeviceMuted(address, muted) { //TODO: Add param error if not boolean
	return new Promise(resolve => {
		var deviceStatus, connection, receiver, exception;
		var client = new Client();
		var corrRequestId = getNewRequestId();

		debug('setDeviceMuted addr: %s', address, 'muted:', muted);
	 	try {
	 		client.connect(parseAddress(address), function() {
			    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
			    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

			    connection.send({ type: 'CONNECT' });
				receiver.send({ type: 'SET_VOLUME', volume: { muted: muted }, requestId: corrRequestId });
			    
			    receiver.on('message', function(data, broadcast) {
				  	if(data.type == 'RECEIVER_STATUS') {
				  		if (data.requestId==corrRequestId) {
					  		deviceStatus = data;
					  		debug('setDeviceMuted recv: %s', JSON.stringify(deviceStatus));
					  		resolve(JSON.stringify(deviceStatus));
					  	}
				 	}
			   	});
		  	});
		  	client.on('error', function(err) {
			 	handleException(err);
				closeClientConnection(client, connection);
				resolve(null);
			});
	 	} catch (e) {
		 	handleException(err);
			closeClientConnection(client, connection);
			resolve(null);
		}

	  	setTimeout(() => {
			closeClientConnection(client, connection);
			resolve(null);
	  	}, networkTimeout);	
	});
}

function getMediaStatus(address, sessionId) {
	return new Promise(resolve => {
		var mediaStatus, connection, receiver, media, exception;
		var client = new Client();
		var corrRequestId = getNewRequestId();

		debug('getMediaStatus addr: %s', address, 'seId:', sessionId);
		try {
			client.connect(parseAddress(address), function() {
			    connection = client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
			    media = client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.media', 'JSON');

			    connection.send({ type: 'CONNECT', origin: {} });
			    media.send({ type: 'GET_STATUS', requestId: corrRequestId });
		 
			    media.on('message', function(data, broadcast) {
				  	if(data.type == 'MEDIA_STATUS') {
				  		if (data.requestId==corrRequestId) {
					  		mediaStatus = data;
					  		debug('getMediaStatus recv: %s', JSON.stringify(mediaStatus));
					  		resolve(JSON.stringify(mediaStatus));
					  	}
				 	}
			   	});
		  	});

		 	client.on('error', function(err) {
			 	handleException(err);
				closeClient(client);
				resolve(null);
			});
		} catch (e) {
		 	handleException(err);
			closeClient(client);
			resolve(null);
		}

		setTimeout(() => {
			closeClient(client);
			resolve(null);
	  	}, networkTimeout);
	});
}

function setMediaPlaybackPause(address, sId, mediaSId) {
	return new Promise(resolve => {
		var mediaStatus, connection, receiver, media, exception;
		var client = new Client();
		var corrRequestId = getNewRequestId();

		debug('setMediaPlaybackPause addr: %s', address, 'seId:', sId, 'mSId:', mediaSId);
	 	try {
	 		client.connect(parseAddress(address), function() {
			    connection = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
			    media = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.media', 'JSON');

			    connection.send({ type: 'CONNECT', origin: {} });
			    media.send({ type: 'PAUSE', requestId: corrRequestId, mediaSessionId: mediaSId, sessionId: sId });
			    
			    media.on('message', function(data, broadcast) {
				  	if(data.type == 'MEDIA_STATUS') {
				  		if (data.requestId==corrRequestId||data.requestId==0) {
				  			if (data.status[0].playerState=="PAUSED") {
				  				mediaStatus = data;
					  			debug('setMediaPlaybackPause recv: %s', JSON.stringify(mediaStatus));
					  			resolve(JSON.stringify(mediaStatus));
				  			}
					  	}
				 	}
			   	});
		  	});

		  	client.on('error', function(err) {
			 	handleException(err);
				closeClient(client);
				resolve(null);
			});
		  } catch (e) {
		 	handleException(err);
			closeClient(client);
			resolve(null);
		}
		setTimeout(() => {
			closeClient(client);
			resolve(null);
	  	}, networkTimeout);
	});
}

function setMediaPlaybackPlay(address, sId, mediaSId) {
	return new Promise(resolve => {
		var mediaStatus, connection, receiver, media, exception;
		var client = new Client();
		var corrRequestId = getNewRequestId();

		debug('setMediaPlaybackPlay addr: %s', address, 'seId:', sId, 'mSId:', mediaSId);
	 	try {
	 		client.connect(parseAddress(address), function() {
			    connection = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
			    media = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.media', 'JSON');

			    connection.send({ type: 'CONNECT', origin: {} });
			    media.send({ type: 'PLAY', requestId: corrRequestId, mediaSessionId: mediaSId, sessionId: sId });
			    
			    media.on('message', function(data, broadcast) {
				  	if(data.type == 'MEDIA_STATUS') {
				  		if (data.requestId==corrRequestId||data.requestId==0) { //FIX for TuneIn's broken receiver app which always returns with requestId 0
				  			if (data.status[0].playerState=="PLAYING") {
						  		mediaStatus = data;
						  		debug('setMediaPlaybackPlay recv: %s', JSON.stringify(mediaStatus));
						  		resolve(JSON.stringify(mediaStatus));
						  	}
					  	}
				 	}
			   	});
		  	});

		 	client.on('error', function(err) {
			 	handleException(err);
				closeClient(client);
				resolve(null);
			});
		 } catch (e) {
		 	handleException(err);
			closeClient(client);
			resolve(null);
		}
		setTimeout(() => {
			closeClient(client);
			resolve(null);
	  	}, networkTimeout);
	});
}

function setDevicePlaybackStop(address, sId) {
	return new Promise(resolve => {
		var deviceStatus, connection, receiver, exception;
		var client = new Client();
		var corrRequestId = getNewRequestId();

		debug('setDevicePlaybackStop addr: %s', address, 'seId:', sId);
		try {
			client.connect(parseAddress(address), function() {
			    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
			    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

			    connection.send({ type: 'CONNECT' });
			    receiver.send({ type: 'STOP', sessionId: sId, requestId: corrRequestId });

			    receiver.on('message', function(data, broadcast) {
				  	if(data.type == 'RECEIVER_STATUS') {
				  		if (data.requestId==corrRequestId) {
					  		deviceStatus = data;
					  		debug('setDevicePlaybackStop recv: %s', JSON.stringify(deviceStatus));
					  		resolve(JSON.stringify(deviceStatus));
					  	}
				 	}
			   	});
		  	});

		  	client.on('error', function(err) {
			 	handleException(err);
				closeClientConnection(client, connection);
				resolve(null);
			});
		} catch (e) {
		 	handleException(err);
			closeClientConnection(client, connection);
			resolve(null);
		}
		setTimeout(() => {
			closeClientConnection(client, connection);
			resolve(null);
	  	}, networkTimeout);
	});
}

function setMediaPlayback(address, mediaType, mediaUrl, mediaStreamType, mediaTitle, mediaSubtitle, mediaImageUrl) {
	return new Promise(resolve => {
		var Client = require('castv2-client').Client;
		var DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
		var client = new Client();

	  	client.connect(parseAddress(address), function() {
			client.launch(DefaultMediaReceiver, function(err, player) {
		 		var media = {
					contentId: mediaUrl,
			        contentType: mediaType,
			        streamType: mediaStreamType,

			        metadata: {
			         	type: 0,
			          	metadataType: 0,
			          	title: mediaTitle,
			          	subtitle: mediaSubtitle,
			          	images: [
			            	{ url: mediaImageUrl }
			          	]
			        }        
			   	};

			  	player.load(media, { autoplay: true }, function(err, status) {
			      	try{debug('Media loaded playerState: ', status.playerState);}
			      	catch(e){
			      		handleException(e);
			      		try{player.close();}catch(e){handleException(e);}
			      	}
			    });

			    player.on('status', function(status) {
			        debug('status.playerState: ', status.playerState);
			        if (status.playerState=='PLAYING') {
			        	debug('status.playerState is PLAYING');
			        	if (player.session.sessionId) {
					  		console.log('Player has sessionId: ', player.session.sessionId);

					  		getMediaStatus(address, player.session.sessionId).then(mediaStatus => {
					    		debug('getMediaStatus return value: ', mediaStatus);
					    		resolve(mediaStatus);
							});
					  	}
			        }
			   	});
			
			    setTimeout(() => {
			    	closeClient(client);
			    	resolve(null);
			  	}, appLoadTimeout);
		    });
	 	});

	  	client.on('error', function(err) {
	  		handleException(err);
	  		try{client.close();}catch(e){handleException(e);}
	  		resolve(null);
	  	});
	});
}

function getFriendlyName(fn) {
	if (fn&&fn!=null&&fn.match(/fn=*/)!=null) {
		debug('Is friendly name: ' + fn);
		return (fn.replace(/fn=*/, ''));
	} else {
		debug('Is not friendly name: ' + fn);
	}
}

function getId(id) {
	if (id&&id!=null&&id.match(/id=*/)!=null) {
		debug('Is is: ' + id);
		return (id.replace(/id=*/, ''));
	} else {
		debug('Is not id: ' + id);
	}
}

function parseAddress(address){
	ip=address.split(':')[0];
	port=address.split(':')[1];

	if (!port) {
		port = 8009;
	}

	debug('IP: '+ip+' port: '+port);

	return {
      host: ip,
      port: port
    };
}

function getNewRequestId(){
	if(currentRequestId > 9998){
		currentRequestId=1;
		debug("Rest currentRequestId");
	}
	debug("getNewRequestId: "+(currentRequestId+1))
	return currentRequestId++;
}

function closeClientConnection(client, connection) {
	closeConnection(connection);
	closeClient(client);
}

function closeConnection(connection) {
	debug('closing connection');
	try {
		connection.send({ type: 'CLOSE' });
	} catch (e) {
		handleException(e);
	}
}

function closeClient(client) {
	debug('closing client');
	try {
		client.close();
	} catch (e) {
		handleException(e);
	}
}

function handleException(e) {
	console.error('Exception caught: ' + e);
}