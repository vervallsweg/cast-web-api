const jsonfile = require('jsonfile');
const OAuth2 = new (require('google-auth-library'))().OAuth2;

class AssistantSetup {
    static checkSetup() {
        return new Promise(function(resolve, reject) {
            var setup = {id: false, secret: false, token: false};
            AssistantSetup.readClientSecretJSON()
                .then(existing =>{
                    if (existing.installed) {
                        if (existing.installed.client_secret){
                            setup.secret = true;
                        }
                        if (existing.installed.client_id){
                            setup.id = true;
                        }
                    }

                    let file = AssistantSetup.getAbsolutePath()+'/tokens.json';
                    jsonfile.readFile(file, function(err, obj) {
                        if (obj) {
                            if (obj.access_token) {
                                setup.token = true;
                            }
                            resolve(setup);
                        }
                        if (err) {
                            console.log('read tokens.json, error: '+err);
                            resolve(setup);
                        }
                    });
                })
                .catch(error =>{
                    console.log('setClientSecret error: '+error);
                    resolve(setup);
                })
        });
    }

    static setClientID(clientID) {
        AssistantSetup.readClientSecretJSON()
            .then(existing =>{
                existing.installed.client_id = clientID;
                existing.installed.redirect_uris = ["urn:ietf:wg:oauth:2.0:oob"];
                // existing.installed.redirect_uris = ["http://127.0.0.1:3000/assistant/setup/token/auto/"];
                AssistantSetup.writeClientSecretJSON(existing);
            })
            .catch(error =>{
                console.log('setClientID error: '+error);
            })
    }

    static setClientSecret(clientSecret) {
        AssistantSetup.readClientSecretJSON()
            .then(existing =>{
                existing.installed.client_secret = clientSecret;
                existing.installed.redirect_uris = ["urn:ietf:wg:oauth:2.0:oob"];
                // existing.installed.redirect_uris = ["http://127.0.0.1:3000/assistant/setup/token/auto/"];
                AssistantSetup.writeClientSecretJSON(existing);
            })
            .catch(error =>{
                console.log('setClientSecret error: '+error);
            })
    }

    static writeClientSecretJSON(object) {
        let file = AssistantSetup.getAbsolutePath()+'/client_secret.json';

        jsonfile.writeFile(file, object, function (err) {
            if (err) {
                console.log('writeClientSecretJSON error: '+err)
            }
        })
    }

    static readClientSecretJSON() {
        return new Promise( function(resolve, reject) {
            let file = AssistantSetup.getAbsolutePath()+'/client_secret.json';

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

    static setToken(oAuthCode) {
        return new Promise( function(resolve, reject) {
            AssistantSetup.readClientSecretJSON()
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
                                AssistantSetup.writeToken(tokens);
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

    static writeToken(token) {
        let file = AssistantSetup.getAbsolutePath()+'/tokens.json';
        console.log('writeToken: '+JSON.stringify(token));

        jsonfile.writeFile(file, token, function(err) {
            console.log('writeToken error: '+err);
        })
    }

    static generateTokenUrl() {
        return new Promise( function(resolve, reject) {
            AssistantSetup.readClientSecretJSON()
                .then(existing =>{
                    if (existing.installed.client_id && existing.installed.client_secret && existing.installed.redirect_uris) {
                        try {
                            const oauthClient = new OAuth2(existing.installed.client_id, existing.installed.client_secret, existing.installed.redirect_uris[0]);

                            let url = oauthClient.generateAuthUrl({
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

    static getAbsolutePath(){
        return (require.resolve('./assistant/google-assistant').substring(0, ( require.resolve('./assistant/google-assistant').length -20 ) ));
    }
}

module.exports = AssistantSetup;