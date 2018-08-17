const http = require('http');
const CastBrowser = require('mdns-cast-browser');
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
const Assistant = require('./assistant/google-assistant');
const jsonfile = require('jsonfile');
const OAuth2 = new (require('google-auth-library'))().OAuth2;
const setup = require('./assistant/setup');

var hostname = '127.0.0.1';
var port = 3000;
var windows = false;
var thisVersion = pkg.version;

var devices = [];
var assistant = false;

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
		console.log('deviceUp: '+JSON.stringify(device));
		if (!deviceExists(device.id)) {
			var newDevice = new CastDevice(device.id, device.address, device.name);
			devices.push(newDevice);
		}
	});

	browser.on('deviceDown', device => {
		console.log('deviceDown: '+JSON.stringify(device));
		var targetDevice = getDevice(device.id);

		if (targetDevice) {
			//targetDevice.disconnect(); //Keep device connected since this is desired behaviour, recon man will deal with it
		}
	});

	browser.on('deviceChange', change => {
		console.log('deviceChange: '+JSON.stringify(change));
		var targetDevice = getDevice(change.id);

		if (targetDevice) {
			if (change.kind == 'name') {
				targetDevice.name = change.value;
			}
			if (change.kind == 'address') {
				targetDevice.setAddress(change.value);	//TODO: deviceChange address can first change port > 20sec later host: disconnect and reconnect in recon man timeout. Make sure to not double recon man
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
						targetDevice.setGroup(groupDevice);
						groupDevice.setMember(targetDevice);
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
					targetDevice.removeGroup(group);
					var groupDevice = getDevice(group);
					if (groupDevice) {
						groupDevice.removeMember(targetDevice.id);
					}
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

			if (path[1]=="device") {
				res.setHeader('Content-Type', 'application/json; charset=utf-8');

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
								if (path[3]=='seek') {
									if (path[4]) {
										result = getDevice(path[2]).seek( path[4] );
									} else {
										result = {response:'error', error:'no seek to time provided'};
									}
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
													result = getDevice(path[2]).volumeGroup( (parseInt(path[4])/100) );
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
				res.setHeader('Content-Type', 'application/json; charset=utf-8');

				if (path[2]) {
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
					getLatestVersion()
					.then(version => {
						res.end( JSON.stringify( { version: {this: thisVersion, latest: version} } ) );
					})
					.catch(errorMessage => {
						res.statusCode = 500;
						res.end( JSON.stringify( { response: error, error: errorMessage } ) );
					})
					
				}
			}

			if (path[1]=="assistant") {
				if (path[2]) {
					if (path[2]=="setup") {
						if (path[3]=="id") {
							res.setHeader('Content-Type', 'application/json; charset=utf-8');

							if (path[4]) {
								setClientID(path[4]);
								res.statusCode = 200;
								res.end( JSON.stringify( {response:'ok'} ) );
							}
						}
						else if (path[3]=="secret") {
							res.setHeader('Content-Type', 'application/json; charset=utf-8');

							if (path[4]) {
								setClientSecret(path[4]);
								res.statusCode = 200;
								res.end( JSON.stringify( {response:'ok'} ) );
							}
						}
						else if (path[3]=="token") {
							res.setHeader('Content-Type', 'application/json; charset=utf-8');

							if (path[4]) {
								setToken(getRestOfPathArray(path, 4))
								.then(response => {
									res.statusCode = 200;
									res.end( JSON.stringify( response ) );
								})
								.catch(error =>{
									res.statusCode = 500;
									res.end( JSON.stringify( { response: 'error', error: error } ) );
								})
							}
						}
						else if (path[3]=="getTokenUrl") {
							res.setHeader('Content-Type', 'application/json; charset=utf-8');

							generateTokenUrl()
							.then(url => {
								res.statusCode = 200;
								res.end(JSON.stringify( { response: 'ok', url:url } ));
							})
							.catch(error =>{
								res.statusCode = 500;
								res.end( JSON.stringify( { response: 'error', error: error } ) );
							})
						} else {
							res.setHeader('Content-Type', 'text/html; charset=utf-8');
							res.statusCode = 200;

							if (path[3]==1) {
								res.end( setup.step1 );
							}
							if (path[3]==2) {
								res.end( setup.step2 );
							}
							if (path[3]==3) {
								res.end( setup.step3 );
							} else {
								res.end( setup.step1 );
							}
							
							//console.log('setup: '+JSON.stringify(setup) );
							
						}
					} else {
						getAssistantReady()
						.then(ready => {
							if (path[2]=="broadcast") {
								if (path[3]) {
									assistant.broadcast( decodeURI(path[3]) );
									res.setHeader('Content-Type', 'application/json; charset=utf-8');
									res.statusCode = 200;
									res.end( JSON.stringify( { response: 'ok' } ) );
								}
							}
							if (path[2]=="command") {
								if (path[3]) {
									assistant.command( decodeURI(path[3]) );
									res.setHeader('Content-Type', 'application/json; charset=utf-8');
									res.statusCode = 200;
									res.end( JSON.stringify( { response: 'ok' } ) );
								}
							}
						})
						.catch(errorMessage => {
							res.statusCode = 500;
							res.end( JSON.stringify( { response: 'error', error: errorMessage } ) );
						});
					}
				} else {
					res.setHeader('Content-Type', 'application/json; charset=utf-8');
					if (assistant) {
						res.statusCode = 200;
						res.end(JSON.stringify( { assistant:true, ready:assistant.ready } ));
					} else {
						res.statusCode = 200;
						res.end(JSON.stringify( { assistant:false, ready:false } ));
					}
				}
			}

			if (path[1]=="memdump") {
				res.setHeader('Content-Type', 'application/json; charset=utf-8');
				res.statusCode = 200;
				log( 'server', 'memory dump', util.inspect(devices) );
				res.end('ok');
			}

			if (path[1]=="") {
				res.setHeader('Content-Type', 'application/json; charset=utf-8');
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

function getAssistantReady() {
	return new Promise( function(resolve, reject) {
		console.log('getAssistantReady()');
		try {
			if (!assistant) {
				console.log('no assistant, creating new Assistant');
				assistant = new Assistant();

				assistant.on('ready', function() {
					console.log('googleAssistant on ready');
					resolve('ready');
				});

				assistant.on('error', error => {
					console.log('googleAssistant on error');
					reject(error);
				});
			} else {
				console.log('assistant exists');
				if (assistant.ready) {
					console.log('assistant ready');
					resolve('ready');
				} else {
					console.log('assistant not ready');
					reject('not ready');
				}
			}

			setTimeout(function() {
				//console.log('timeout');
				reject('Timeout while accessing Google Assistant.');
			}, 5000);
		} catch (e) {
			console.log('exception: '+e);
			reject(e);
		}
	});
}

function setClientID(clientID) {
	readClientSecretJSON()
	.then(existing =>{
		existing.installed.client_id = clientID;
		existing.installed.redirect_uris = ["urn:ietf:wg:oauth:2.0:oob"];
		writeClientSecretJSON(existing);
	})
	.catch(error =>{
		console.log('setClientID error: '+error);
	})
}

function setClientSecret(clientSecret) {
	readClientSecretJSON()
	.then(existing =>{
		existing.installed.client_secret = clientSecret;
		existing.installed.redirect_uris = ["urn:ietf:wg:oauth:2.0:oob"];
		writeClientSecretJSON(existing);
	})
	.catch(error =>{
		console.log('setClientSecret error: '+error);
	})
}

function writeClientSecretJSON(object) {
	var file = getAbsoulutePath()+'/client_secret.json';

	jsonfile.writeFile(file, object, function (err) {
		console.error(err)
	})
}

function readClientSecretJSON() {
	return new Promise( function(resolve, reject) {
		var file = getAbsoulutePath()+'/client_secret.json';

		jsonfile.readFile(file, function(err, obj) {
			if (obj) {
				resolve(obj);
			}
			if (err) {
				console.log('readClientSecretJSON error: '+err);
				resolve({ installed:{} });
			}
		});
	});
}

function setToken(oAuthCode) {
	return new Promise( function(resolve, reject) {
		readClientSecretJSON()
		.then(existing =>{
			if (existing.installed.client_id && existing.installed.client_secret && existing.installed.redirect_uris) {
				try {
					const oauthClient = new OAuth2(existing.installed.client_id, existing.installed.client_secret, existing.installed.redirect_uris[0]);
					console.log('oAuthCode: '+oAuthCode);

					oauthClient.getToken(oAuthCode, (error, tokens) => {
						if (error) {
							reject('Couldnot get tokens, error: '+error);
						}

						console.log("tokens: "+tokens);
						writeToken(tokens);
						resolve({response: 'ok'});
					});
				} catch (e) {
					reject('setToken exception: '+e);
				}
			} else {
				reject('setToken missing clientID / clientSecret');
			}
		})
		.catch(error =>{
			reject('setToken error: '+error);
		})
	});
}

function writeToken(token) {
	var file = getAbsoulutePath()+'/tokens.json';
	console.log('writeToken: '+JSON.stringify(token));

	jsonfile.writeFile(file, token, function(err) {
		console.log('writeToken error: '+err);
	})
}

function generateTokenUrl() {
	return new Promise( function(resolve, reject) {
		readClientSecretJSON()
		.then(existing =>{
			if (existing.installed.client_id && existing.installed.client_secret && existing.installed.redirect_uris) {
				try {
					const oauthClient = new OAuth2(existing.installed.client_id, existing.installed.client_secret, existing.installed.redirect_uris[0]);

					var url = oauthClient.generateAuthUrl({
						access_type: 'offline',
						scope: ['https://www.googleapis.com/auth/assistant-sdk-prototype'],
					});

					resolve(url);
				} catch(e) {
					reject('generateTokenUrl exception: '+e);
				}
				
			} else {
				reject('generateToken missing clientID / clientSecret');
			}

		})
		.catch(error =>{
			console.log('generateTokenUrl error: '+error);
			reject(error);
		})
	});
}

function getAbsoulutePath(){
	return (require.resolve('./assistant/google-assistant').substring(0, ( require.resolve('./assistant/google-assistant').length -20 ) ));
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