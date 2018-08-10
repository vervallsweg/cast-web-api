var GoogleAssistant = null;
const Events = require('events');
const path = require('path');
try {
	GoogleAssistant = require('google-assistant');	
} catch (e) {
	console.log('GoogleAssistant require error: '+e);
}

const config = {
	auth: {
		keyFilePath: path.resolve(__dirname, './client_secret.json'),
		savedTokensPath: path.resolve(__dirname, './tokens.json'), // where you want the tokens to be saved
	},
	conversation: {
		lang: 'en-US', // defaults to en-US, but try other ones, it's fun!
	}
};

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
		// setup the conversation
		conversation.on('response', text => console.log('Assistant Response:', text));
			// if we've requested a volume level change, get the percentage of the new level
		conversation.on('volume-percent', percent => console.log('New Volume Percent:', percent));
			// the device needs to complete an action
		conversation.on('device-action', action => console.log('Device Action:', action));
			// once the conversation is ended, see if we need to follow up
		conversation.on('ended', (error, continueConversation) => {
			if (error) {
				console.log('Conversation Ended Error:', error);
			} else {
				console.log('Conversation Complete');
				conversation.end();
			}
		});
		// catch any errors
		conversation.on('error', (error) => {
			console.log('Conversation Error:', error);
		});
	};

	broadcast(message) {
		if (this.ready) {
			config.conversation.textQuery = 'Broadcast '+message;
			this.assistant.start(config.conversation, this.startConversation);
		} else {
			this.emit('error', 'Assistant is not ready.');
		}
	};

	command(command) {
		if (this.ready) {
			config.conversation.textQuery = ''+command;
			this.assistant.start(config.conversation, this.startConversation);
		} else {
			this.emit('error', 'Assistant is not ready.');
		}
	};
}

module.exports = Assistant;