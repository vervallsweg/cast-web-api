const http = require('http');
const Client = require('castv2').Client;
const mdns = require('mdns');
const url = require('url');
const debug = require('debug')('cast-web-api');
var timeOutDelay = 2000;

createWebServer();

//WEBSERVER
function createWebServer() {
	const hostname = '127.0.0.1';
	const port = 3000;

	const server = http.createServer((req, res) => {
		var parsedUrl = url.parse(req.url, true);

		if (parsedUrl['pathname']=="/getDevices") {
			res.setHeader('Content-Type', 'application/json');
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
						res.setHeader('Content-Type', 'application/json');
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
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address'] && parsedUrl['query']['volume']) {
				setDeviceVolume(parsedUrl['query']['address'], parseFloat(parsedUrl['query']['volume'])).then(deviceStatus => {
					if (deviceStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json');
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
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address'] && parsedUrl['query']['muted']) {
				setDeviceMuted(parsedUrl['query']['address'], (parsedUrl['query']['muted']=="true")).then(deviceStatus => {
					if (deviceStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json');
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
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address'] && parsedUrl['query']['sessionId']) {
				getMediaStatus(parsedUrl['query']['address'], parsedUrl['query']['sessionId']).then(mediaStatus => {
					if (mediaStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json');
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
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address'] && parsedUrl['query']['sessionId'] && parsedUrl['query']['mediaSessionId']) {
				setMediaPlaybackPause(parsedUrl['query']['address'], parsedUrl['query']['sessionId'], parsedUrl['query']['mediaSessionId']).then(mediaStatus => {
					if (mediaStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json');
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
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address'] && parsedUrl['query']['sessionId'] && parsedUrl['query']['mediaSessionId']) {
				setMediaPlaybackPlay(parsedUrl['query']['address'], parsedUrl['query']['sessionId'], parsedUrl['query']['mediaSessionId']).then(mediaStatus => {
					if (mediaStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json');
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
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address'] && parsedUrl['query']['sessionId']) {
				setDevicePlaybackStop(parsedUrl['query']['address'], parsedUrl['query']['sessionId']).then(mediaStatus => {
					if (mediaStatus) {
						res.statusCode = 200;
						res.setHeader('Content-Type', 'application/json');
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
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['timeOut']) {
				timeOutDelay = parsedUrl['query']['timeOut'];
				res.end('OK: timeOut set to: '+parsedUrl['query']['timeOut']);
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
		browser.on('serviceUp', function(service) {
			var currentDevice = [service.name, service.addresses[0], service.port];
	  		debug('getDevices found: %s', currentDevice.toString());
	  		devices.push(currentDevice);
		});
		
		browser.start();
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
	  	}, timeOutDelay);
	});
}

function getDeviceStatus(address) {
	var deviceStatus, connection, receiver, exception;
	var client = new Client();

	try {
		debug('getDeviceStatus addr: %a', address);
	 	client.connect(address, function() {
		    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
		    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

		    connection.send({ type: 'CONNECT' });
			receiver.send({ type: 'GET_STATUS', requestId: 1 });
		    
		    receiver.on('message', function(data, broadcast) {
			  	if(data.type == 'RECEIVER_STATUS') {
			  		deviceStatus = data.status;
			  		debug('getDeviceStatus recv: %s', JSON.stringify(deviceStatus));
			 	}
		   	});
	  	});
	  	client.on('error', function(err) {
		 	console.error('Error thrown', err);
		 	exception = err;
		});
	 } catch (e) {
	 	console.error('Exception caught: ' + e);
		exception = e;
	 } 
	

  	return new Promise(resolve => {
		setTimeout(() => {
			try {connection.send({ type: 'CLOSE' }); client.close();}
			catch (e) {console.error('Exception caught: '+e); exception=e;}
			
			if (!exception) {
				resolve(JSON.stringify(deviceStatus));
			}
	    	resolve(null);
	  	}, timeOutDelay);
	});
}

function setDeviceVolume(address, volume) {
	var deviceStatus, connection, receiver, exception;
	var client = new Client();
	
	debug('setDeviceVolume addr: %s', address, 'volu:', volume);
 	try {
 		client.connect(address, function() {
		    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
		    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

		    connection.send({ type: 'CONNECT' });
			receiver.send({ type: 'SET_VOLUME', volume: { level: volume }, requestId: 1 });
		    
		    receiver.on('message', function(data, broadcast) {
			  	if(data.type == 'RECEIVER_STATUS') {
			  		deviceStatus = data.status;
			  		debug('setDeviceVolume recv: %s', JSON.stringify(deviceStatus));
			 	}
		   	});
	  	});

	  	client.on('error', function(err) {
			console.error('Error thrown', err);
		 	exception = err;
		});
	} catch (e) {
	 	console.error('Exception caught: ' + e);
		exception = e;
	}

  	return new Promise(resolve => {
		setTimeout(() => {
			try {connection.send({ type: 'CLOSE' }); client.close();}
			catch (e) {console.error('Exception caught: '+e); exception=e;}

			if (!exception) {
				resolve(JSON.stringify(deviceStatus));
			}
	    	resolve(null);
	  	}, timeOutDelay);
	});
}

function setDeviceMuted(address, muted) { //TODO: Add param error if not boolean
	var deviceStatus, connection, receiver, exception;
	var client = new Client();

	debug('setDeviceMuted addr: %s', address, 'muted:', muted);
 	try {
 		client.connect(address, function() {
		    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
		    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

		    connection.send({ type: 'CONNECT' });
			receiver.send({ type: 'SET_VOLUME', volume: { muted: muted }, requestId: 1 });
		    
		    receiver.on('message', function(data, broadcast) {
			  	if(data.type == 'RECEIVER_STATUS') {
			  		deviceStatus = data.status;
			  		debug('setDeviceMuted recv: %s', JSON.stringify(deviceStatus));
			 	}
		   	});
	  	});

	  	client.on('error', function(err) {
		 	console.error('Error thrown', err);
		 	exception = err;
		});
 	} catch (e) {
	 	console.error('Exception caught: ' + e);
		exception = e;
	}

  	return new Promise(resolve => {
		setTimeout(() => {
			try{connection.send({ type: 'CLOSE' }); client.close();}
			catch (e) {console.error('Exception caught: '+e); exception=e;}
			
			if (!exception) {
				resolve(JSON.stringify(deviceStatus));
			}
	    	resolve(null);
	  	}, timeOutDelay);
	});
}

function getMediaStatus(address, sessionId) {
	var mediaStatus, connection, receiver, media, exception;
	var client = new Client();

	debug('getMediaStatus addr: %s', address, 'seId:', sessionId);
	try {
		client.connect(address, function() {
		    connection = client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
		    media = client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.media', 'JSON');

		    connection.send({ type: 'CONNECT', origin: {} });
		    media.send({ type: 'GET_STATUS', requestId: 1 });
	 
		    media.on('message', function(data, broadcast) {
			  	if(data.type == 'MEDIA_STATUS') {
			  		mediaStatus = data.status;
			  		debug('getMediaStatus recv: %s', JSON.stringify(mediaStatus));
			 	}
		   	});
	  	});

	 	client.on('error', function(err) {
		 	console.error('Error thrown', err);
		 	exception = err;
		});
	} catch (e) {
	 	console.error('Exception caught: ' + e);
		exception = e;
	}

  	return new Promise(resolve => {
		setTimeout(() => {
			try{connection.send({ type: 'CLOSE' }); client.close();}
			catch (e) {console.error('Exception caught: '+e); exception=e;}
			
			if (!exception) {
				resolve(JSON.stringify(mediaStatus));
			}
	    	resolve(null);
	  	}, timeOutDelay);
	});
}

function setMediaPlaybackPause(address, sId, mediaSId) {
	var mediaStatus, connection, receiver, media, exception;
	var client = new Client();

	debug('setMediaPlaybackPause addr: %s', address, 'seId:', sId, 'mSId:', mediaSId);
 	try {
 		client.connect(address, function() {
		    connection = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
		    media = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.media', 'JSON');

		    connection.send({ type: 'CONNECT', origin: {} });
		    media.send({ type: 'PAUSE', requestId: 1, mediaSessionId: mediaSId, sessionId: sId });
		    
		    media.on('message', function(data, broadcast) {
			  	if(data.type == 'MEDIA_STATUS') {
			  		mediaStatus = data.status;
			  		debug('setMediaPlaybackPause recv: %s', JSON.stringify(mediaStatus));
			 	}
		   	});
	  	});

	  	client.on('error', function(err) {
		 	console.error('Error thrown', err);
		 	exception = err;
		});
	  } catch (e) {
	 	console.error('Exception caught: ' + e);
		exception = e;
	}

  	return new Promise(resolve => {
		setTimeout(() => {
			try {connection.send({ type: 'CLOSE' }); client.close();}
			catch (e) {console.error('Exception caught: '+e); exception=e;}

			if (!exception) {
				resolve(JSON.stringify(mediaStatus));
			}
	    	resolve(null);
	  	}, timeOutDelay);
	});
}

function setMediaPlaybackPlay(address, sId, mediaSId) {
	var mediaStatus, connection, receiver, media, exception;
	var client = new Client();

	debug('setMediaPlaybackPlay addr: %s', address, 'seId:', sId, 'mSId:', mediaSId);
 	try {
 		client.connect(address, function() {
		    connection = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
		    media = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.media', 'JSON');

		    connection.send({ type: 'CONNECT', origin: {} });
		    media.send({ type: 'PLAY', requestId: 1, mediaSessionId: mediaSId, sessionId: sId });
		    
		    media.on('message', function(data, broadcast) {
			  	if(data.type == 'MEDIA_STATUS') {
			  		mediaStatus = data.status;
			  		debug('setMediaPlaybackPlay recv: %s', JSON.stringify(mediaStatus));
			 	}
		   	});
	  	});

	 	client.on('error', function(err) {
		 	console.error('Error thrown', err);
		 	exception = err;
		});
	 } catch (e) {
	 	console.error('Exception caught: ' + e);
		exception = e;
	}

  	return new Promise(resolve => {
		setTimeout(() => {
			try{connection.send({ type: 'CLOSE' }); client.close();}
			catch (e) {console.error('Exception caught: '+e); exception=e;}

			if (!exception) {
				resolve(JSON.stringify(mediaStatus));
			}
	    	resolve(null);
	  	}, timeOutDelay);
	});
}

function setDevicePlaybackStop(address, sId) {
	var deviceStatus, connection, receiver, exception;
	var client = new Client();

	debug('setDevicePlaybackStop addr: %s', address, 'seId:', sId);
	try {
		client.connect(address, function() {
		    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
		    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

		    connection.send({ type: 'CONNECT' });
		    receiver.send({ type: 'STOP', sessionId: sId, requestId: 1 });

		    receiver.on('message', function(data, broadcast) {
			  	if(data.type == 'RECEIVER_STATUS') {
			  		deviceStatus = data.status;
			  		debug('setDevicePlaybackStop recv: %s', JSON.stringify(deviceStatus));
			 	}
		   	});
	  	});

	  	client.on('error', function(err) {
		 	console.error('Error thrown', err);
		 	exception = err;
		});
	} catch (e) {
	 	console.error('Exception caught: ' + e);
		exception = e;
	}

  	return new Promise(resolve => {
		setTimeout(() => {
			try{connection.send({ type: 'CLOSE' }); client.close();}
			catch (e) {console.error('Exception caught: '+e); exception=e;}

			if (!exception) {
				resolve(JSON.stringify(deviceStatus));
			}
	    	resolve(null);
	  	}, timeOutDelay);
	});
}