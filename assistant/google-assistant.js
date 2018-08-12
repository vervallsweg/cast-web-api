var GoogleAssistant = null;
const Events = require('events');
const path = require('path');
const util = require('util');
const config = {
	auth: {
		keyFilePath: path.resolve(__dirname, './client_secret.json'),
		savedTokensPath: path.resolve(__dirname, './tokens.json'),
	},
	conversation: {
		lang: 'en-US',
	}
};
//console.log('config: '+JSON.stringify(config));
try {
	GoogleAssistant = require('google-assistant');	
} catch (e) {
	console.log('GoogleAssistant require error: '+e);
}

class Assistant extends Events {
	constructor() {
		super();
		this.assistant = false;
		this.ready = false;

		if (GoogleAssistant) {
			try {
				this.assistant = new GoogleAssistant(config.auth);
				this.ready = false;
				var that = this;

				this.assistant.on('ready', function() {
					that.ready = true;
					that.emit('ready');
				});
				this.assistant.on('error', error => {
					that.emit('error', 'Assistant Error: '+error);
					//console.log('Assistant on error: '+error);
					that.ready = false; // Correct???
				});
			} catch (e) {
				//console.log('Assistant exception: '+e);
				this.emit('error', 'Assistant exception: '+e);
			}
		} else {
			this.emit('error', 'google-assistant package is not installed');
			console.log('NO GOOGLE Assistant!!!!!');
		}
	}

	startConversation(conversation){
		
			// if we've requested a volume level change, get the percentage of the new level
		conversation.on('volume-percent', percent => console.log('New Volume Percent:', percent));
			// the device needs to complete an action
		conversation.on('device-action', action => console.log('Device Action:', action));
			// once the conversation is ended, see if we need to follow up
	};

	broadcast(message) {
		var that = this;
		return new Promise( function(resolve, reject) {
			if (that.ready) {
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
			} else {
				that.emit('error', 'Assistant is not ready.'); //y?
				reject('Error: Assistant is not ready.');
			}
		});
	};

	command(command) {
		var that = this;
		return new Promise( function(resolve, reject) {
			if (that.ready) {
				config.conversation.textQuery = command;
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
			} else {
				that.emit('error', 'Assistant is not ready.'); //y?
				reject('Error: Assistant is not ready.');
			}
		});
	};
}

module.exports = Assistant;