const http = require('http');
const CastBrowser = require('../mdns-cast-browser/cast-browser');
const url = require('url');
const debug = require('debug')('cast-web-api');
const args = require('minimist')(process.argv.slice(2));
const fetch = require('node-fetch');
const os = require('os');
const pkg = require('./package.json');
const util = require('util');
const querystring = require('querystring');
const chalk = require('chalk');
const CastDevice = require('./cast-device');

var hostname = '127.0.0.1';
var port = 3000;
var reconnectInterval = 300000; //TODO: params!
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
	
	var browser = new CastBrowser();
	browser.discover();

	browser.on('deviceUp', device => {
		console.log('deviceUp');
		var newDevice = new CastDevice(device.id, device.address, device.name);
		devices.push(newDevice);
	});

	browser.on('deviceDown', device => {
		var targetDevice = getDevice(device.id);

		if (targetDevice) {
			targetDevice.disconnect();
		}
	});

	browser.on('deviceChange', change => {
		var targetDevice = getDevice(change.id);

		if (targetDevice) {
			if (change.kind == 'name') {
				targetDevice.name = change.value;
			}
			if (change.kind == 'address') {
				targetDevice.setAddress(change.value); //TODO: implement .setAdress();
			}
		}
	});

	browser.on('groupsUp', groups => {
		console.log('groupsUp: '+JSON.stringify(groups));
		var targetDevice = getDevice(groups.id);

		if (targetDevice) {
			if (groups.groups) {
				groups.groups.forEach(function(group) {
					var groupDevice = getDevice(group);
					if (groupDevice) {
						targetDevice.setGroups(groupDevice);
					}
				});
			}
		}
	});

	browser.on('groupsDown', groups => {
		console.log('groupsDown: '+JSON.stringify(groups));
		var targetDevice = getDevice(groups.id);

		if (targetDevice) {
			if (groups.groups) {
				groups.groups.forEach(function(group) {
					targetDevice.removeGroups(group);
				});
			}
		}
	});

	createWebServer();
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
	if (args.reconnectInterval) {
		reconnectInterval = args.reconnectInterval;
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
					res.end( JSON.stringify( { timeoutDiscovery: timeoutDiscovery, reconnectInterval: reconnectInterval, discoveryInterval: discoveryInterval, groupManagement: groupManagement, discoveryRuns: discoveryRuns } ) );
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

function connectGroups(castDevice) {
	log('info', 'connectGroups()', '', castDevice.id);
	if (castDevice.groups) {
		castDevice.groups.forEach(function(groupId) {
			var group = getDevice(groupId);

			if (group) {
				if (group.link == 'disconnected') {
					group.connect();
				}
			}
		});
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