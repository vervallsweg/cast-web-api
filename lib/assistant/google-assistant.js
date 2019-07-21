let GoogleAssistant = null;
let GoogleAssistantRequireError;

try {
	GoogleAssistant = require('google-assistant');
} catch (e) {
	console.log(
		'\n\n\n',
		'*******************************************\n',
		'       GoogleAssistant not installed       \n',
		'*******************************************\n',
		'\n\n',
		'GoogleAssistant optional package cannot be loaded. Most likely it is not installed. Unless you want to',
		'use it, this is no problem.\n',
		'More infos:',
		'https://vervallsweg.github.io/cast-web/googleassistant-not-installed/',
		'\n\n',
		'Original error message:', e,
		'\n\n',
		'*******************************************\n',
		'*******************************************\n',
		'\n\n',
	);
}

const Fs = require('../config/fs');
const Events = require('events');
const path = require('path');
const config = {
	auth: {
		keyFilePath: path.join(Fs.configDir, 'client_secret.json'),
		savedTokensPath: path.join(Fs.configDir, 'tokens.json'),
	},
	conversation: {
		lang: 'en-US',
	}
};


class Assistant extends Events {
	constructor() {
		super();
		this.assistant = false;
		this._ready = false;
	}

	getAssistantReady() {
		let that = this;
		return new Promise(function (resolve, reject) {
			if (GoogleAssistant) {
				if (that._ready) {
					resolve(that.assistant);
				} else {
					try {
						that.assistant = new GoogleAssistant(config.auth);
						that._ready = false;

						that.assistant.on('ready', function() {
							that._ready = true;
							resolve(that.assistant);
						});

						that.assistant.on('error', error => {
							that._ready = false; // Correct???
							reject(error);
						});
					} catch (e) {
						reject('Assistant exception: '+e);
					}
				}
			} else {
				reject('google-assistant package is not installed');
			}
		})
	}

	broadcast(message) {
		return new Promise( (resolve, reject) => {
			this.getAssistantReady()
				.then(assistant => {
					config.conversation.textQuery = 'Broadcast '+message;
					assistant.start(config.conversation);

					assistant.on('started', conversation => {
						conversation.on('response', (text) => {
							console.log('response: '+text);
							resolve('Assistant response: ' + text);
						});

						conversation.on('ended', (error, continueConversation) => {
							console.log('ended error: ' + error + ', continueConversation: '+continueConversation);
							if (error) {
								reject('Conversation ended, error: ' + error);
							} else {
								conversation.end();
								resolve('Conversation complete, continueConversation: '+continueConversation);
							}
						});

						conversation.on('error', (error) => {
							console.log('error:'+error);
							reject('Conversation error: ' + error);
						});
					});
				})
				.catch(error => {
					reject(error);
				});
		});
	};

	command(command) {
		let that = this;
		return new Promise( (resolve, reject) => {
			that.getAssistantReady()
				.then(assistant => {
					config.conversation.textQuery = command;
					assistant.start(config.conversation);

					assistant.on('started', conversation => {
						conversation.on('response', text => {
							resolve('Assistant response: ' + text);
						});

						conversation.on('ended', (error, continueConversation) => {
							console.log('ended');
							if (error) {
								reject('Conversation ended, error: ' + error);
							} else {
								conversation.end();
								resolve('Conversation complete, continueConversation: '+continueConversation);
							}
						});

						conversation.on('error', (error) => {
							reject('Conversation error: ' + error);
						});
					});
				})
				.catch(error => {
					reject(error);
				});
		});
	};

	get status() {
		return { assistant:(this.assistant !== false), ready:this._ready } ;
	};

	get installed() {

	}
}

module.exports = Assistant;