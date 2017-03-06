const http = require('http');
const Client = require('castv2').Client;
const mdns = require('mdns');
const url = require('url');
const queryString = require('querystring');
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
				if (devices!=null) {
					res.statusCode = 200;
					res.end(devices);
				} else {
					res.statusCode = 404;
					res.end('Error');
				}
			});
		}

		else if (parsedUrl['pathname']=="/getDeviceStatus") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address']!=null) {
				getDeviceStatus(parsedUrl['query']['address']).then(deviceStatus => {
					res.end(deviceStatus);
				});
			} else {
				res.end('Err no address');
			}
		}

		else if (parsedUrl['pathname']=="/setDeviceVolume") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address']!=null && parsedUrl['query']['volume']!=null) {
				setDeviceVolume(parsedUrl['query']['address'], parseFloat(parsedUrl['query']['volume'])).then(deviceStatus => {
					res.end(deviceStatus);
				});
			} else {
				res.end('Param err');
			}
		}

		else if (parsedUrl['pathname']=="/setDeviceMuted") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address']!=null && parsedUrl['query']['muted']!=null) {
				setDeviceMuted(parsedUrl['query']['address'], (parsedUrl['query']['muted']=="true")).then(deviceStatus => {
					res.end(deviceStatus);
				});
			} else {
				res.end('Param err');
			}
		}

		else if (parsedUrl['pathname']=="/getMediaStatus") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address']!=null||parsedUrl['query']['sessionId']!=null) {
				getMediaStatus(parsedUrl['query']['address'], parsedUrl['query']['sessionId']).then(mediaStatus => {
					res.end(mediaStatus);
				});
			} else {
				res.end('Param err');
			}
		}

		else if (parsedUrl['pathname']=="/setMediaPlaybackPause") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address']!=null||parsedUrl['query']['sessionId']!=null||parsedUrl['query']['mediaSessionId']!=null) {
				setMediaPlaybackPause(parsedUrl['query']['address'], parsedUrl['query']['sessionId'], parsedUrl['query']['mediaSessionId']).then(mediaStatus => {
					res.end(mediaStatus);
				});
			} else {
				res.end('Param err');
			}
		}

		else if (parsedUrl['pathname']=="/setMediaPlaybackPlay") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address']!=null||parsedUrl['query']['sessionId']!=null||parsedUrl['query']['mediaSessionId']!=null) {
				setMediaPlaybackPlay(parsedUrl['query']['address'], parsedUrl['query']['sessionId'], parsedUrl['query']['mediaSessionId']).then(mediaStatus => {
					res.end(mediaStatus);
				});
			} else {
				res.end('Param err');
			}
		}

		else if (parsedUrl['pathname']=="/setDevicePlaybackStop") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['address']!=null||parsedUrl['query']['sessionId']!=null) {
				setDevicePlaybackStop(parsedUrl['query']['address'], parsedUrl['query']['sessionId']).then(mediaStatus => {
					res.end(mediaStatus);
				});
			} else {
				res.end('Param err');
			}
		}

		else if (parsedUrl['pathname']=="/setConfig") {
			res.statusCode = 200;
			res.setHeader('Content-Type', 'application/json');
			if (parsedUrl['query']['timeOut']!=null) {
				timeOutDelay = parsedUrl['query']['timeOut'];
				res.end('OK: timeOut set to: '+parsedUrl['query']['timeOut']);
			} else {
				res.end('Param err');
			}
		}

		else {
			res.statusCode = 404;
			res.end("Not found");
		}
	});

	server.listen(port, hostname, () => {
	 	console.log(`Server running at http://${hostname}:${port}/`);
	});

	server.on('request', (req, res) => {
		console.log('Request to: '+ req.url);
	});
}

//GOOGLE CAST FUNCTIONS
function getDevices() {
	var devices=[];
	var browser = mdns.createBrowser(mdns.tcp('googlecast'));

	browser.on('serviceUp', function(service) {
		var currentDevice = [service.name, service.addresses[0], service.port];
  		console.log('found device ' + currentDevice.toString());
  		devices.push(currentDevice);
	});

	browser.start();

	return new Promise(resolve => {
		setTimeout(() => {
			browser.stop();
			if (devices!=null) {
				resolve(JSON.stringify(devices));
			} else {
				resolve(devices);
			}
	    
	  	}, timeOutDelay);
	});
}

function getDeviceStatus(address) {
	var deviceStatus, connection, receiver;
	var client = new Client();

 	client.connect(address, function() {
	    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
	    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

	    connection.send({ type: 'CONNECT' });
		receiver.send({ type: 'GET_STATUS', requestId: 1 });
	    
	    receiver.on('message', function(data, broadcast) {
		  	if(data.type == 'RECEIVER_STATUS') {
		  		deviceStatus = data.status;
		  		console.log(deviceStatus);
		 	}
	   	});
  	});

  	return new Promise(resolve => {
		setTimeout(() => {
			connection.send({ type: 'CLOSE' });
			client.close();
	    	resolve(JSON.stringify(deviceStatus));
	  	}, timeOutDelay);
	});
}

function setDeviceVolume(address, volume) {
	var deviceStatus, connection, receiver;
	var client = new Client();
	console.log(volume);

 	client.connect(address, function() {
	    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
	    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

	    connection.send({ type: 'CONNECT' });
		receiver.send({ type: 'SET_VOLUME', volume: { level: volume }, requestId: 1 });
	    
	    receiver.on('message', function(data, broadcast) {
		  	if(data.type == 'RECEIVER_STATUS') {
		  		deviceStatus = data.status;
		  		console.log(deviceStatus);
		 	}
	   	});
  	});

  	return new Promise(resolve => {
		setTimeout(() => {
			connection.send({ type: 'CLOSE' });
			client.close();
	    	resolve(JSON.stringify(deviceStatus));
	  	}, timeOutDelay);
	});
}

function setDeviceMuted(address, muted) {
	var deviceStatus, connection, receiver;
	var client = new Client();
	console.log(muted);

 	client.connect(address, function() {
	    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
	    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

	    connection.send({ type: 'CONNECT' });
		receiver.send({ type: 'SET_VOLUME', volume: { muted: muted }, requestId: 1 });
	    
	    receiver.on('message', function(data, broadcast) {
		  	if(data.type == 'RECEIVER_STATUS') {
		  		deviceStatus = data.status;
		  		console.log(deviceStatus);
		 	}
	   	});
  	});

  	return new Promise(resolve => {
		setTimeout(() => {
			connection.send({ type: 'CLOSE' });
			client.close();
	    	resolve(JSON.stringify(deviceStatus));
	  	}, timeOutDelay);
	});
}

// JAVA ref code
/*public MediaStatus play(String destinationId, String sessionId, long mediaSessionId) throws IOException {
        this.startSession(destinationId);
        su.litvak.chromecast.api.v2.StandardResponse.MediaStatus status = (su.litvak.chromecast.api.v2.StandardResponse.MediaStatus)this.sendStandard("urn:x-cast:com.google.cast.media", StandardRequest.play(sessionId, mediaSessionId), destinationId);
        return status != null && status.statuses.length != 0?status.statuses[0]:null;
    } */

function getMediaStatus(address, sessionId) {
	var mediaStatus, connection, receiver, media;
	var client = new Client();

 	client.connect(address, function() {
	    connection = client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
	    media = client.createChannel('sender-0', sessionId, 'urn:x-cast:com.google.cast.media', 'JSON');

	    connection.send({ type: 'CONNECT', origin: {} });
	    media.send({ type: 'GET_STATUS', requestId: 1 });
 
	    media.on('message', function(data, broadcast) {
	    	console.log(data);
		  	if(data.type == 'MEDIA_STATUS') {
		  		mediaStatus = data.status;
		  		console.log(mediaStatus);
		 	}
	   	});
  	});

  	return new Promise(resolve => {
		setTimeout(() => {
			connection.send({ type: 'CLOSE' });
			client.close();
	    	resolve(JSON.stringify(mediaStatus));
	  	}, timeOutDelay);
	});
}

function setMediaPlaybackPause(address, sId, mediaSId) {
	var mediaStatus, connection, receiver, media;
	var client = new Client();

 	client.connect(address, function() {
	    connection = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
	    media = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.media', 'JSON');

	    connection.send({ type: 'CONNECT', origin: {} });
	    media.send({ type: 'PAUSE', requestId: 1, mediaSessionId: mediaSId, sessionId: sId });
	    //{"type":"PAUSE","requestId":3,"mediaSessionId":2,"sessionId":"142cb092-6d30-442e-b893-3ee058a41141"}
 
	    media.on('message', function(data, broadcast) {
	    	console.log(data);
		  	if(data.type == 'MEDIA_STATUS') {
		  		mediaStatus = data.status;
		  		console.log(mediaStatus);
		 	}
	   	});
  	});

  	return new Promise(resolve => {
		setTimeout(() => {
			connection.send({ type: 'CLOSE' });
			client.close();
	    	resolve(JSON.stringify(mediaStatus));
	  	}, timeOutDelay);
	});
}

function setMediaPlaybackPlay(address, sId, mediaSId) {
	var mediaStatus, connection, receiver, media;
	var client = new Client();

 	client.connect(address, function() {
	    connection = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
	    media = client.createChannel('sender-0', sId, 'urn:x-cast:com.google.cast.media', 'JSON');

	    connection.send({ type: 'CONNECT', origin: {} });
	    media.send({ type: 'PLAY', requestId: 1, mediaSessionId: mediaSId, sessionId: sId });
	    //{"type":"PAUSE","requestId":3,"mediaSessionId":2,"sessionId":"142cb092-6d30-442e-b893-3ee058a41141"}
 
	    media.on('message', function(data, broadcast) {
	    	console.log(data);
		  	if(data.type == 'MEDIA_STATUS') {
		  		mediaStatus = data.status;
		  		console.log(mediaStatus);
		 	}
	   	});
  	});

  	return new Promise(resolve => {
		setTimeout(() => {
			connection.send({ type: 'CLOSE' });
			client.close();
	    	resolve(JSON.stringify(mediaStatus));
	  	}, timeOutDelay);
	});
}

function setDevicePlaybackStop(address, sId) {
	var deviceStatus, connection, receiver;
	var client = new Client();

 	client.connect(address, function() {
	    connection = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
	    receiver   = client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

	    connection.send({ type: 'CONNECT' });
	    receiver.send({ type: 'STOP', sessionId: sId, requestId: 1 });

	    receiver.on('message', function(data, broadcast) {
	    	console.log(data);
		  	if(data.type == 'RECEIVER_STATUS') {
		  		deviceStatus = data.status;
		  		console.log(deviceStatus);
		 	}
	   	});
  	});

  	return new Promise(resolve => {
		setTimeout(() => {
			connection.send({ type: 'CLOSE' });
			client.close();
	    	resolve(JSON.stringify(deviceStatus));
	  	}, timeOutDelay);
	});
}