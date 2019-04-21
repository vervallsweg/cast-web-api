const googleTTS = require('google-tts-api');
const logger = require('../../log/logger');

class GoogleTTS {
    static init() {

    }

    static parseMediaList(mediaList) {
        return new Promise( (resolve, reject) => {
            //split messages
            let splitMediaList = GoogleTTS.splitMediaList(mediaList);
            //replace messages
            GoogleTTS.replace(splitMediaList)
                .then(replacedMediaList=>{
                    resolve(replacedMediaList);
                })
                .catch(err =>{
                    reject('Google TTS err: '+err);
                });

            setTimeout(() => {
                reject('Google TTS timeout.');
            }, 5000);
        });
    }

    static replace(mediaList) {
        return new Promise((resolve, reject) => {
            let promises = [];

            mediaList.forEach((mediaElement, index) => {
                if (mediaElement.googleTTS && mediaElement.googleTTS!=null) {
                    promises.push( GoogleTTS.getGoogleTTSUrl(mediaElement.media.metadata.title, mediaElement.googleTTS, index) );
                }
            });

            Promise.all(promises)
                .then(results => {
                    results.forEach(value => {
                        if (value.url) {
                            mediaList[value.index].media.contentId = value.url;
                            mediaList[value.index].media.mediaType = 'audio/mp3';
                            mediaList[value.index].media.mediaStreamType = 'BUFFERED';
                        } else {
                            logger.log('error', 'this.splitGoogleTTS()', 'googleTTS error: '+value.error);
                            mediaList.splice(value.index, 1);
                        }
                    });
                    resolve(mediaList);
                })
        })
    }

    static getGoogleTTSUrl(message, lang, index) {
        return new Promise((resolve) => {
            googleTTS(message, lang, 1)
                .then(value => {
                    resolve({index: index, url: value});
                })
                .catch(error => {
                    resolve({index: index, error: error});
                });
        })
    }

    static splitMediaList(mediaList) {
        mediaList.forEach((mediaElement, index) => {
            if (mediaElement.googleTTS && mediaElement.googleTTS!=null && mediaElement.media.metadata.title.length > 200) {
                let messageParts = GoogleTTS.splitMessage(mediaElement.media.metadata.title);

                messageParts.forEach(function(part, partIndex) {
                    let newMediaElement = JSON.parse(JSON.stringify(mediaElement));
                    newMediaElement.media.metadata.title = part;
                    logger.log('debug', 'that.splitGoogleTTS()', 'partIndex: '+partIndex+', part: '+ part + ', mediaList: '+JSON.stringify(mediaList));
                    if (partIndex === 0) {
                        mediaList.splice(index, 1, newMediaElement);
                    } else {
                        mediaList.splice(index+partIndex, 0, newMediaElement);
                    }
                });
            }
        });
        return mediaList;
    }

    static splitMessage(message) {
        let messageChunks = message.split(' ');
        let messagesIndex = 0;
        let messages = [];

        messageChunks.forEach(chunk => {
            let added = false;

            while(added === false) {
                if (messages[messagesIndex]) {
                    if (chunk.length > 200) {
                        messagesIndex++;
                        messages[messagesIndex] = chunk.substring(0, 200);
                        chunk = chunk.substring(200);
                    }
                    if (!messages[messagesIndex]) {
                        messages[messagesIndex] = '';
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
}

module.exports = GoogleTTS;