const events = require('events');
const logger = require('../../log/logger');
const Callback = require('../../callback/callback');
const CastReceiver = require('./connection/cast-receiver');
const CastMedia = require('./connection/cast-media');
const CastDefaultMediaReceiver = require('./connection/cast-default-media-receiver.js');
const CastGroup = require('./connection/cast-group');

class CastDevice extends events {
	constructor(id, address, name) {
		super();
		this.id = id;
		this._address = address;
		this._name = name;
		this._link = 'disconnected';
		this._castReceiver = new CastReceiver(this._address, this.id);
		this._castMedia =  new CastMedia(this._address, this.id);
		this.groups = [];
		this.members = new CastGroup(this);
		this.callback = null;
		this._dmr = new CastDefaultMediaReceiver(this._address, this.id);
		this._status = {
			groupPlayback: false,
			volume: 0,
			muted: false,
			application: '',
			status: '',
			title: '',
			subtitle: '',
			image: ''
		};

		this.setConnectionListeners();
		this.connect();
	}
	
	connect() {
		this._castReceiver.connect();
	}

	disconnect() {
		this._castReceiver.disconnect();
		this._castMedia.disconnect();
	}

	setConnectionListeners() {
		this._castReceiver.on('linkChanged', link => {
			this.link = link;
		});
		this._castReceiver.on('statusChanged', status => {
			this.status = status;
		});
		this._castReceiver.on('sessionIdChanged', sessionId => {
			console.log("sessionIdChanged: "+sessionId);

			if (sessionId) {
				this._castMedia.connect(sessionId);
			} else {
				this._castMedia.disconnect();
			}
		});
		this._castReceiver.on('error', error => {
			logger.log("error", "CastDevice._castReceiver", "error: "+error, this.id);
			//TODO:
		});

		this._castMedia.on('linkChanged', link => {
			//
		});
		this._castMedia.on('statusChanged', status => {
			this.status = status;
		});
		this._castMedia.on('error', error => {
			logger.log("error", "CastDevice._castMedia", "error: "+error, this.id);
			//TODO:
		});
	}
	
	setSelfListeners() { //TODO: replace in future
		this.on('linkChanged', () => {
			//send callbacks
			if (this.callback) {
				//logger.log('info', 'CastDevice.subscriptionInit()', 'castDevice.toString(): '+JSON.stringify( castDevice.toString() )+', '+JSON.stringify( castDevice.callback ), castDevice.id);
				this.callback.send( this.toString() );
			}
		});

		//subscriptionInit;
		this.on('statusChange', () => {
			//send callbacks
			if (this.callback) {
				//logger.log('info', 'CastDevice.subscriptionInit()', 'castDevice.toString(): '+JSON.stringify( castDevice.toString() )+', '+JSON.stringify( castDevice.callback ), castDevice.id);
				this.callback.send( this.toString() );
			}
		});
	}

	toObject() {
		return {
			id: this.id,
			name: this._name,
			connection: this.link,
			address: this.address,
			sessionId: this.sessionId,
			status: this.status,
			// groups: this.getGroups(),
			groups: this.groups,
			members: this.members.members
		}
	}

	volume(targetLevel) {
		logger.log('info', 'CastDevice.volume()', targetLevel, this.id);
		return this._castReceiver.volume(targetLevel);
	}

	volumeGroup(targetLevel) {
		logger.log('info', 'CastDevice.volumeGroup()', targetLevel, this.id);
		if (this.members) {
			this.members.forEach(function(member) {
				member.volume(targetLevel);
			});
			return {response:'ok'};
		} else {
			return {response:'error', error:'no members'};
		}
	}

	muted(isMuted) {
		logger.log('info', 'CastDevice.muted()', isMuted, this.id);
		return this._castReceiver.muted(isMuted);
	}

	play() {
		logger.log('info', 'CastDevice.play()', '', this.id);
		return this._castMedia.play();
	}

	pause() {
		logger.log('info', 'CastDevice.pause()', '', this.id);
		return this._castMedia.pause();
	}

	stop() {
		logger.log('info', 'CastDevice.stop()', '', this.id);
		return this._castReceiver.stop();
	}

	seek(to) {
		logger.log('info', 'CastDevice.seek()', 'to: '+to, this.id);
		return this._castMedia.seek(to);
	}

	playMedia(media) {
		this._dmr.play(media);
	}

	setStatusArray(values) {
		var that = this;
		values.forEach(function(value) {
			that.setStatus(value.key, value.value);
		});
	}

	subscribe(url) {
		if(this.callback != null) {
			this.unsubscribe();
		}
		this.callback = new Callback(url, this.toString());
	}

	unsubscribe() {
		if (this.callback != null) {
			this.callback.stop();
			this.callback = null;
		}
	}


	get address() {
		return this._address;
	}

	set address(value) {
		logger.log('info', 'CastDevice.set address(value)', 'value: ' + JSON.stringify(value), this.id );
		if (this._address != null && this._link !== 'disconnected') {
			if (this._address.host !== value.host && this._address.port !== value.port) {
				this.disconnect();
				this.event.once('linkChanged', link => {
					this._address = value; //TODO: maybe more checks to prevent 2x .connect() //maybe this is the weird bug causing outdated IPs
					this.connect();
				});
			}
		}

		this._address = value;
	}

	get status() {
		return this._status;
	}

	set status(status) {
		let changed = false;
		if (!status.hasOwnProperty('groupPlayback') && this.status.groupPlayback !== false) {
			console.log('set status: ownProp: '+status.hasOwnProperty('groupPlayback')+', this.status.groupPlayback: '+this.status.groupPlayback);
			return;
		}
		for (let key in status) {
			let value = status[key];
			if (this.status[key] !== value) {
				this.status[key] = value;
				changed = true;
			}
		}

		if (changed) {
			this.emit('statusChanged', this._status);
		}
	}

	set link(value) {
		if (value !== this.link) {
			this._link = value;
			this.emit('linkChanged', this.link);
		}
	}

	get link() {
		return this._link;
	}

	get sessionId() {
		return this._castReceiver.sessionId;
	}
}

module.exports = CastDevice;