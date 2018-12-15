var GoogleAssistant = null;
try {
	GoogleAssistant = require('google-assistant');
} catch (e) {
	console.log('GoogleAssistant require error: '+e);
}

const Events = require('events');
const path = require('path');
const config = {
	auth: {
		keyFilePath: path.resolve(__dirname, './client_secret.json'),
		savedTokensPath: path.resolve(__dirname, './tokens.json'),
	},
	conversation: {
		lang: 'en-US',
	}
};


class Assistant extends Events {
	constructor() {
		super(); //TODO: necessary?
		this.assistant = false;
		this.ready = false;
	}

	getAssistantReady() {
		let that = this;
		return new Promise(function (resolve, reject) {
			if (GoogleAssistant) {
				if (that.ready) {
					resolve(that.assistant);
				} else {
					try {
						that.assistant = new GoogleAssistant(config.auth);
						that.ready = false;

						that.assistant.on('ready', function() {
							that.ready = true;
							resolve(that.assistant);
						});

						that.assistant.on('error', error => {
							that.ready = false; // Correct???
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

	startConversation(conversation){
			// if we've requested a volume level change, get the percentage of the new level
		conversation.on('volume-percent', percent => console.log('New Volume Percent:', percent));
			// the device needs to complete an action
		conversation.on('device-action', action => console.log('Device Action:', action));
			// once the conversation is ended, see if we need to follow up
	};

	broadcast(message) {
		let that = this;
		return new Promise( function(resolve, reject) {
			that.getAssistantReady()
				.then(assistant => {
					config.conversation.textQuery = 'Broadcast '+message;
					that.assistant.start(config.conversation);

					that.assistant.on('started', conversation => {
						conversation.on('response', text => {
							//console.log('response: '+text);
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
							//console.log('error:'+error);
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
		return new Promise( function(resolve, reject) {
			that.getAssistantReady()
				.then(assistant => {
					config.conversation.textQuery = command;
					that.assistant.start(config.conversation);

					that.assistant.on('started', conversation => {
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

	status() {
		return { assistant:this.assistant, ready:this.ready } ;
	};
}

module.exports = Assistant;