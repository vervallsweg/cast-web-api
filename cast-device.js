const Client = require('castv2').Client;
const Castv2Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const events = require('events');
const googleTTS = require('google-tts-api');
const chalk = require('chalk');
const debug = require('debug')('cast-web-api');
const url = require('url');
const http = require('http');

class CastDevice {
	constructor(id, address, name) {
		this.id = id;
		this.address = address;
		this.name = name;
		this.event = new events.EventEmitter();
		this.link = 'disconnected';
		this.currentRequestId = 1;
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

		var that = this;

		this.event.on('linkChanged', function() {
			//reconnectionManagementInit
			that.reconnectionManagement();

			//send callbacks
			if (that.callback) {
				//log('info', 'CastDevice.subscriptionInit()', 'castDevice.toString(): '+JSON.stringify( castDevice.toString() )+', '+JSON.stringify( castDevice.callback ), castDevice.id);
				that.sendCallBack( that.toString() );
			}

			//auto connect groups
			if (that.link == 'connected' || that.link == 'connecting') {
				if (that.groups) {
					that.groups.forEach(function(group) {
						if (group.link != 'connected' || group.link != 'connecting') {
							group.connect();
						}
					});
				}
			}
		});
		
		//subscriptionInit;
		this.event.on('statusChange', function() {
			//send callbacks
			if (that.callback) {
				//log('info', 'CastDevice.subscriptionInit()', 'castDevice.toString(): '+JSON.stringify( castDevice.toString() )+', '+JSON.stringify( castDevice.callback ), castDevice.id);
				that.sendCallBack( that.toString() );
			}

			//sync group content
			if (that.groups) {
				//now in .setGroups()
			}
		});
	}

	setAddress(newAddress, originalLink) {
		if (this.link != 'disconnected') {
			this.disconnect();
			var that = this;
			this.event.once('linkChanged', function(){
				that.setAddress(newAddress, 'connected');
			});
		} else {
			this.address = newAddress;
			if (originalLink == 'connected') {
				this.connect();
			}
		}
	}

	connect() {
		try {
			log('info', 'CastDevice.connect()', 'host: ' + this.address.host + ', port: ' + this.address.port, this.id );
			var that = this;
			this.link = 'connecting';
			this.castConnectionReceiver = new Object();
			this.castConnectionReceiver.client = new Client();

			this.castConnectionReceiver.client.connect(this.address, function() {
				try {
					that.castConnectionReceiver.connection = that.castConnectionReceiver.client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
				    that.castConnectionReceiver.heartbeat = that.castConnectionReceiver.client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.tp.heartbeat', 'JSON');
				    that.castConnectionReceiver.receiver = that.castConnectionReceiver.client.createChannel('sender-0', 'receiver-0', 'urn:x-cast:com.google.cast.receiver', 'JSON');

					that.castConnectionReceiver.connection.send({ type: 'CONNECT' });
					that.castConnectionReceiver.receiver.send({ type: 'GET_STATUS', requestId: that.getNewRequestId() });

				    that.castConnectionReceiver.receiver.on('message', function(data, broadcast) {
				    	that.parseReceiverStatus(data);
				    	if (that.link != 'connected') {
							that.link = 'connected';
							that.event.emit('linkChanged');
				    	}
				   	});

				   	that.castConnectionReceiver.receiver.on('error', function(error) {
				   		log('error', 'CastDevice.connect()', 'castDevice.castConnectionReceiver.receiver error: '+error, that.id);
						that.disconnect();
				   	});

				   	that.castConnectionReceiver.connection.on('error', function(error) {
				   		log('error', 'CastDevice.connect()', 'castDevice.castConnectionReceiver.connection error: '+error, that.id);
						that.disconnect();
				   	});

				   	that.castConnectionReceiver.heartBeatIntervall = setInterval(function() {
						if (that.castConnectionReceiver) {
							try {
								that.castConnectionReceiver.heartbeat.send({ type: 'PING' });
							} catch (e) {
								log('error', 'CastDevice.connect() castConnectionReceiver.heartBeatIntervall', 'exception: '+e, that.id);
								that.disconnect();
							}
						}
					}, 5000);
				} catch (e) {
					log('error', 'CastDevice.connect()', 'exception: '+e, that.id);
					that.disconnect();
				}
			});
			this.castConnectionReceiver.client.on('error', function(err) {
			 	log('error', 'CastDevice.connect()', 'castDevice.castConnectionReceiver.client error: '+err, that.id);
			 	that.disconnect();
			});
		} catch (e) {
			log('error', 'CastDevice.connect()', 'exception: '+e, this.id);
			this.disconnect();
		}
		// if (groupManagement) {
		// 	connectGroupMembers(this);
		// }
	};

    disconnect() {
		log('info', 'CastDevice.disconnect()', 'host: ' + this.address.host + ', port: ' + this.address.port, this.id );
		try {
			if (this.link != 'disconnected') {
				this.link = 'disconnected';
				this.event.emit('linkChanged');
				clearInterval(this.castConnectionReceiver.heartBeatIntervall);
				//castDevice.castConnectionReceiver.connection.send({ type: 'CLOSE' });
				this.castConnectionReceiver.client.close();
				//castDevice.castConnectionReceiver = null;
			}
		} catch (e) {
			//castDevice.castConnectionReceiver = null;
			log('error', 'CastDevice.disconnect()', 'exception: '+e, this.id);
		}
		this.disconnectMedia();
	};

	connectMedia() {
		if (this.castConnectionReceiver.sessionId) {
			try {
				log('info', 'CastDevice.connectMedia()', 'host: ' + this.address.host + ', port: ' + this.address.port + ', sessionId: ' + this.castConnectionReceiver.sessionId, this.id);
				var that = this;
				this.castConnectionMedia = new Object();
				this.castConnectionMedia.client = new Client();

				this.castConnectionMedia.client.connect(this.address, function() {
					try {
						that.castConnectionMedia.connection = that.castConnectionMedia.client.createChannel('sender-0', that.castConnectionReceiver.sessionId, 'urn:x-cast:com.google.cast.tp.connection', 'JSON');
						that.castConnectionMedia.heartbeat = that.castConnectionMedia.client.createChannel('sender-0', that.castConnectionReceiver.sessionId, 'urn:x-cast:com.google.cast.tp.heartbeat', 'JSON');
						that.castConnectionMedia.media = that.castConnectionMedia.client.createChannel('sender-0', that.castConnectionReceiver.sessionId, 'urn:x-cast:com.google.cast.media', 'JSON');

						that.castConnectionMedia.connection.send({ type: 'CONNECT' });
						that.castConnectionMedia.media.send({ type: 'GET_STATUS', requestId: that.getNewRequestId() });

						that.castConnectionMedia.media.on('message', function(data, broadcast) {
							that.parseMediaStatus(data);
							that.castConnectionMedia.link = 'connected';
						});

						that.castConnectionMedia.media.on('error', function(error) {
							log('error', 'CastDevice.connectMedia()', 'castDevice.castConnectionMedia.media error: '+error, that.id);
							that.disconnectMedia();
						});

						that.castConnectionMedia.connection.on('error', function(error) {
							log('error', 'CastDevice.connectMedia()', 'castDevice.castConnectionMedia.connection error: '+error, that.id);
							that.disconnectMedia();
						})

						that.castConnectionMedia.heartBeatIntervall = setInterval(function() {
							try {
								if (that.castConnectionMedia && that.link=='connected') {
									that.castConnectionMedia.heartbeat.send({ type: 'PING' });
								}
							} catch(e) {
								log('error', 'CastDevice.connectMedia()', 'heartbeat exception: '+e, that.id);
								that.disconnectMedia();
							}
						}, 5000);
					} catch(e) {
						log('error', 'CastDevice.connectMedia()', 'exception: '+e, that.id);
						that.disconnectMedia();
					}
				});
				this.castConnectionMedia.client.on('error', function(err) {
					log('error','CastDevice.connectMedia()', 'castDevice.castConnectionMedia.client error: '+err, this.id);
					that.disconnectMedia();
				});
			} catch(e) {
				log('error', 'CastDevice.connectMedia()', 'exception: '+e, this.id);
				this.disconnectMedia();
			}
		}
	};

	disconnectMedia() {
		if (this.castConnectionMedia) {
			log('info', 'CastDevice.disconnectMedia()', 'host: ' + this.address.host + ', port: ' + this.address.port, this.id);
			try {
				if (this.castConnectionMedia!=null) {
					clearInterval(this.castConnectionMedia.heartBeatIntervall);
					//castDevice.castConnectionMedia.connection.send({ type: 'CLOSE' });
					this.castConnectionMedia.client.close();
					this.castConnectionMedia.link = 'disconnected';
					this.status.status = '';
					this.status.title = '';
					this.status.subtitle = '';
					this.status.image = '';
					this.event.emit('statusChange');
					//castDevice.castConnectionMedia = null;
				}
			} catch(e) {
				log('error', 'CastDevice.disconnectMedia()', 'exception: '+e, this.id);
				//castDevice.castConnectionMedia = null;
			}
		}
	};

	parseReceiverStatus(receiverStatus) {
		try {
			log('debug', 'parseReceiverStatusCastDevice()', 'receiverStatus: ' + JSON.stringify(receiverStatus), this.id );

			if (receiverStatus.type == 'RECEIVER_STATUS') {
				if (receiverStatus.status.applications) {
					if ( receiverStatus.status.applications[0].sessionId != this.castConnectionReceiver.sessionId) {
						log('debug', 'parseReceiverStatusCastDevice()', 'sessionId changed', this.id);
						if (receiverStatus.status.applications[0].isIdleScreen!=true) {
							log('debug', 'parseReceiverStatusCastDevice()', 'isIdleScreen: '+receiverStatus.status.applications[0].isIdleScreen+', sessionId changed to: '+receiverStatus.status.applications[0].sessionId+', from: '+this.castConnectionReceiver.sessionId, this.id);
							this.castConnectionReceiver.sessionId = receiverStatus.status.applications[0].sessionId;
							this.connectMedia();
						}
					}
					if ( receiverStatus.status.applications[0].displayName ) {
						this.setStatus('application', receiverStatus.status.applications[0].displayName);
					}
				} else {
					this.castConnectionReceiver.sessionId = null;
					this.status.application = '';
					this.disconnectMedia();
				}
				if (receiverStatus.status.volume) {
					this.setStatus( 'volume', Math.round(receiverStatus.status.volume.level*100) );
					this.setStatus('muted', receiverStatus.status.volume.muted);
				}
			}
		} catch(e) {
			log('error', 'parseReceiverStatusCastDevice()', 'exception: '+e, this.id);
		}
	}

	parseMediaStatus(mediaStatus) {
		try {
			log('debug', 'parseMediaStatusCastDevice()', 'mediaStatus: ' + JSON.stringify(mediaStatus), this.id );

			if (mediaStatus.type == 'MEDIA_STATUS') {
				if (mediaStatus.status[0]) {
					if (mediaStatus.status[0].media) {
						if (mediaStatus.status[0].media.metadata) {
							var metadataType = mediaStatus.status[0].media.metadata.metadataType;
							if(metadataType<=1) {
								this.setStatus('title', mediaStatus.status[0].media.metadata.title);
								this.setStatus('subtitle', mediaStatus.status[0].media.metadata.subtitle);
							} 
							if(metadataType==2) {
								this.setStatus('title', mediaStatus.status[0].media.metadata.seriesTitle);
								this.setStatus('subtitle', mediaStatus.status[0].media.metadata.subtitle);
							} 
							if(metadataType>=3 && metadataType<=4) {
								this.setStatus('title', mediaStatus.status[0].media.metadata.title);
								this.setStatus('subtitle', mediaStatus.status[0].media.metadata.artist);
							}
							if (metadataType>=0 && metadataType<4) {
								if (mediaStatus.status[0].media.metadata.images) {
									if (mediaStatus.status[0].media.metadata.images[0]) {
										this.setStatus('image', mediaStatus.status[0].media.metadata.images[0].url);
									}
								}
							}
						}
					}

					if (mediaStatus.status[0].mediaSessionId) {
						this.castConnectionMedia.mediaSessionId = mediaStatus.status[0].mediaSessionId;
					}

					if (mediaStatus.status[0].playerState) {
						this.setStatus('status', mediaStatus.status[0].playerState);
					}
				}
			}
		} catch(e) {
			log('error', 'parseMediaStatusCastDevice()', 'exception: '+e, this.id);
		}
	}

	toString() {
		return {
			id: this.id,
			name: this.name,
			connection: this.link,
			address: this.address,
			status: this.status,
			groups: this.getGroups(),
			members: this.members
		}
	}

	getStatusGroup() {
		var status = this.toString().status;
		return [
			{ 'key': 'application', 'value': status.application },
			{ 'key': 'status', 'value': status.status },
			{ 'key': 'title', 'value': status.title },
			{ 'key': 'subtitle', 'value': status.subtitle },
			{ 'key': 'image', 'value': status.image },
		];
	}

	setGroups(group) {
		var that = this;
		group.event.on('statusChange', function() {
			if (group.castConnectionReceiver) {
				if (group.castConnectionReceiver.sessionId) {
					that.setStatus('groupPlayback', group.id);
					that.setStatusArray( group.getStatusGroup() );
				} else {
					if (that.status.groupPlayback == group.id) {
						that.setStatus('groupPlayback', false);
					} else {
						console.log('not removing groupPlayback on:'+that.id);
					}
				}
			}
		});

		//checking for playback
		group.event.emit('statusChange');

		if (!this.groups) {
			this.groups = [];
		}
		if (this.link == 'connected' || this.link == 'connecting') {
			group.connect();
		}
		this.groups.push(group);
	}

	getGroups() {
		var ids = [];
		if (this.groups) {
			this.groups.forEach(function(group){
				ids.push(group.id);
			});
		}
		return ids;
	}

	removeGroups(groupToRemove) {
		var that = this;
		if (this.status.groupPlayback == groupToRemove) {
			//groupToRemove offline > remvoing group playback for this member
			this.setStatus('groupPlayback', false);
		}

		if (this.groups) {
			this.groups.forEach(function(group, index) {
				if (group.id == groupToRemove) {
					this.groups.splice(index, 1); //TODO: better solution for parallel access
					console.log(this.id+' ::: removed group: '+groupToRemove);
				}
			});
		}
	}

	volume(targetLevel) {
		log('info', 'CastDevice.volume()', targetLevel, this.id);
		if (this.castConnectionReceiver.receiver && this.link == 'connected') {
			this.castConnectionReceiver.receiver.send({ type: 'SET_VOLUME', volume: { level: targetLevel }, requestId: this.getNewRequestId() });
			return {response:'ok'};
		} else {
			return {response:'error', error:'disconnected'};
		}
	}

	muted(isMuted) {
		log('info', 'CastDevice.muted()', isMuted, this.id);
		if (this.castConnectionReceiver.receiver && this.link == 'connected') {
			this.castConnectionReceiver.receiver.send({ type: 'SET_VOLUME', volume: { muted: isMuted }, requestId: this.getNewRequestId() });
			return {response:'ok'};
		} else {
			return {response:'error', error:'disconnected'};
		}
	}

	play () {
		log('info', 'CastDevice.play()', '', this.id);
		if (this.castConnectionMedia && this.link == 'connected') {
			if (this.castConnectionMedia.media && this.castConnectionReceiver.sessionId && this.castConnectionMedia.mediaSessionId) {
				this.castConnectionMedia.media.send({ type: 'PLAY', requestId: this.getNewRequestId(), mediaSessionId: this.castConnectionMedia.mediaSessionId, sessionId: this.castConnectionReceiver.sessionId });
				return {response:'ok'};
			} else {
				return {response:'error', error:'nothing playing'};
			}
		} else {
			return {response:'error', error:'nothing playing'};
		}
	}

	pause () {
		log('info', 'CastDevice.pause()', '', this.id);
		if (this.castConnectionMedia && this.link == 'connected') {
			if (this.castConnectionMedia.media && this.castConnectionReceiver.sessionId && this.castConnectionMedia.mediaSessionId) {
				this.castConnectionMedia.media.send({ type: 'PAUSE', requestId: this.getNewRequestId(), mediaSessionId: this.castConnectionMedia.mediaSessionId, sessionId: this.castConnectionReceiver.sessionId });
				return {response:'ok'};
			} else {
				return {response:'error', error:'nothing playing'};
			}
		} else {
			return {response:'error', error:'nothing playing'};
		}
	}

	stop () {
		log('info', 'CastDevice.stop()', '', this.id);
		if (this.castConnectionReceiver.sessionId && this.link == 'connected') {
			this.castConnectionReceiver.receiver.send({ type: 'STOP', sessionId: this.castConnectionReceiver.sessionId, requestId: this.getNewRequestId() });
			return {response:'ok'};
		} else {
			return {response:'error', error:'nothing playing'};
		}
	}

	setStatus (key, value) {
		if (key=='volume' || key=='muted' || key=='application' || key=='status' || key=='title' || key=='subtitle' || key=='image' || key=='groupPlayback') {
			if (value == null) { value = '' };
			if (this.status[key] != value) {
				this.status[key] = value;
				this.event.emit('statusChange');
			}
		}
	}

	setStatusArray(values) {
		var that = this;
		values.forEach(function(value) {
			that.setStatus(value.key, value.value);
		});
	}

	playMedia(media) {
		try {
			log('info', 'CastDevice.playMedia()', 'media: ' + JSON.stringify(media), this.id);

			var castv2Client = new Castv2Client();
			var mediaList = [];
			var that = this;

			media.forEach(function(element, index) {
				var mediaElement =  {
					autoplay : true,
					preloadTime : 5,
					activeTrackIds : [],
					googleTTS: element.googleTTS,
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
				log('info', 'CastDevice.playMedia()', 'mediaElement: ' + JSON.stringify(mediaElement), that.id);
				mediaList.push(mediaElement);
			});

			this.replaceGoogleTts(mediaList)
			.then(newMediaList => {
				log('info', 'CastDevice.playMedia()', 'newMediaList: ' + JSON.stringify(newMediaList), that.id);
			
			  	castv2Client.connect(that.address, function() {
					castv2Client.launch(DefaultMediaReceiver, function(err, player) {
						player.queueLoad(newMediaList, {startIndex:0, repeatMode: "REPEAT_OFF"}, function(err, status) {
							log('info', 'CastDevice.playMedia()', 'loaded queue: ' + status, that.id);
						});
				    });
			 	});

			 	setTimeout(() => {
					try{ castv2Client.close(); } catch(e) { log('error', 'CastDevice.playMedia()', 'castv2Client.close() exception: '+e, that.id ); }
				}, 5000);
			})
			.catch(error => {
				log('error', 'CastDevice.playMedia()', 'replaceGoogleTts error: '+error, that.id );
			})

			return {response:'ok'};
		} catch(e) {
			log('error', 'CastDevice.playMedia()', 'exception: '+e, this.id );
		}
	}

	replaceGoogleTts(mediaList) {
		return new Promise( function(resolve, reject) {
			function splitGoogleTTS(message) {
				var messageChunks = message.split(' ');
				var messagesIndex = 0;
				var messages = [];

				messageChunks.forEach(function(chunk) {
					var added = false;

					while(added == false) {
						if (messages[messagesIndex]) {
							if (chunk.length > 200) {
								messagesIndex++;
								messages[messagesIndex] = chunk.substring(0, 200);
								chunk = chunk.substring(200);
							}
							if (messages[messagesIndex].length+1+chunk.length <= 200) {
								messages[messagesIndex] = messages[messagesIndex]+' '+chunk;
								added = true;
							} else {
								messagesIndex++;
							}
						} else {
							if (chunk.length > 200) {
								messages[messagesIndex] = chunk.substring(0, 200);
								chunk = chunk.substring(200);
								messagesIndex++;
							}
							messages[messagesIndex] = chunk;
							added = true;
						}
					}
				});

				return messages;
			};

			var googleTTSPromised = 0;
			var googleTTSResolved = 0;

			mediaList.forEach(function(mediaElement, index){
				if (mediaElement.googleTTS && mediaElement.googleTTS!=null) {
					if (mediaElement.media.metadata.title.length > 200) {
						var messageParts = splitGoogleTTS(mediaElement.media.metadata.title);

						messageParts.forEach(function(part, partIndex) {
							var newMediaElement = JSON.parse(JSON.stringify(mediaElement));
							newMediaElement.media.metadata.title = part;
							console.log('partIndex: '+partIndex+', part: '+ part + ', mediaList: '+JSON.stringify(mediaList));
							if (partIndex == 0) {
								mediaList.splice(index, 1, newMediaElement);
							} else {
								mediaList.splice(index+1, 0, newMediaElement);
							}
							
						});
					}
				}
			});

			mediaList.forEach(function(mediaElement){
				if (mediaElement.googleTTS && mediaElement.googleTTS!=null) {
					googleTTSPromised++;
				} else {
					delete mediaElement.googleTTS
				}
			});

			mediaList.forEach(function(mediaElement, index){
				if (mediaElement.googleTTS && mediaElement.googleTTS!=null) {
					googleTTS(mediaElement.media.metadata.title, mediaElement.googleTTS, 1)
					.then(function (url) {
						mediaElement.media.contentId = url;
						mediaElement.media.mediaType = 'audio/mp3';
						mediaElement.media.mediaStreamType = 'BUFFERED';
						googleTTSResolved++;
						if (googleTTSResolved == googleTTSPromised) {
							resolve(mediaList);
						}
					})
					.catch(function (err) {
						log('error', 'replaceGoogleTts()', 'googleTTS error: '+err);
						mediaList.splice(index, 1);
						googleTTSPromised--;
						if (googleTTSResolved == googleTTSPromised) {
							resolve(mediaList);
						}
					})
				}
			});

			if (googleTTSResolved == googleTTSPromised) {
				resolve(mediaList);
			}

			setTimeout(function() {
				reject('Google TTS timeout.');
			}, 5000);
		});
	}

	getNewRequestId() {
		if(this.currentRequestId > 9998){
			this.currentRequestId=1;
			log('debug', 'getNewRequestId()', 'reset');
		}
		log('debug', 'getNewRequestId()', this.currentRequestId+1);
		return this.currentRequestId++;
	}

	reconnectionManagement() {
		log('debug', 'reconnectionManagement()', 'link changed to: ' + this.link + ', reconnectInterval: ' + this.reconnectInterval, this.id);
		var that = this;

		if (this.link=='disconnected') {
			if (this.reconnectInterval==null) {
				log('debug', 'reconnectionManagement()', 'starting interval', this.id);
				this.reconnectInterval = setInterval(function() {
					log('debug', 'reconnectionManagement()', 'reconnect evaluating', that.id);
					if (that.link!='connected') {
						log('info', 'reconnectionManagement()', 'reconnecting', that.id);
						that.connect();
					}
				}, 300000); //TODO: params!
			}
		} else {
			log('debug', 'reconnectionManagement()', 'interval evaluating', this.id);
			if (this.reconnectInterval!=null) {
				log('debug', 'reconnectionManagement()', 'interval remove', this.id);
				clearInterval(this.reconnectInterval);
				this.reconnectInterval = null;
			}
		}
	}

	createSubscription(callback) {
		this.removeSubscription();

		log('debug', 'CastDevice.createSubscription()', 'callback: '+ JSON.stringify(callback), this.id);

		try {
			this.callback = url.parse('http://'+callback);
		} catch(e) {
			delete this.callback;
		}
		
		log('info', 'CastDevice.createSubscription()', 'callback: '+ JSON.stringify(this.callback), this.id);
		if (this.callback) {
			this.sendCallBack( this.toString() );
		}

		return {response:'ok'};
	}

	removeSubscription() {
		log('info', 'CastDevice.removeSubscription()', '', this.id);
		//this.event.removeAllListeners('statusChange'); //Breaks group man
		//this.event.removeAllListeners('linkChanged'); //Breaks reconnect man
		delete this.callback;
		return {response:'ok'};
	}

	sendCallBack(status) {
		log( 'debug', 'sendCallBack()', 'to: '+ JSON.stringify(this.callback) +', status: ' + JSON.stringify(status), this.id );

		try{
			var data = JSON.stringify(status);
			var that = this;

			var options = {
				hostname: this.callback.hostname,
				port: this.callback.port,
				path: this.callback.path,
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
				log('error', 'sendCallBack()', 'cannot send callback: ' + JSON.stringify(that.callback) + ', error: ' + error, that.id);
			});

			req.write(data);
			req.end();
		} catch (e) {
			log('error', 'sendCallBack()', 'cannot send callback: ' + JSON.stringify(this.callback) + ', error: ' + e, this.id);
		}
	}
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

module.exports = CastDevice;