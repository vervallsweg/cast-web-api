const OAuth2 = new (require('google-auth-library'))().OAuth2;
const Fs = require('./fs.js');

class AssistantSetup {

    //dynamic

    static checkSetup() {
        return new Promise(resolve => {
            resolve({
                id: AssistantSetup.clientId,
                secret: AssistantSetup.clientSecret,
                token: AssistantSetup.token
            });
        });
    }

    static generateTokenUrl() {
        return new Promise((resolve, reject) => {
            let oAuthClient = AssistantSetup.getOAuthClient();

            try {
                let url = oAuthClient.generateAuthUrl({
                    access_type: 'offline',
                    scope: ['https://www.googleapis.com/auth/assistant-sdk-prototype'],
                });

                resolve(url);
            } catch(e) {
                reject('generateTokenUrl exception: '+e);
            }
        });
    }

    static getOAuthClient() {
        let client = AssistantSetup.getClient().installed || {};
        if (client.client_id && client.client_secret && client.redirect_uris) {
            try {
                const oAuthClient = new OAuth2(client.client_id, client.client_secret, client.redirect_uris[0]);
                return oAuthClient;
            } catch (e) {
                // reject('setToken exception: '+e); TODO
            }
        } else {
            //reject('setToken missing clientID / clientSecret'); TODO
        }
    }

    //fs

    //internal
    static getClient() {
        return Fs.readFS('client_secret.json').installed || {};
    }

    //external
    static get clientId() {
        return Boolean(AssistantSetup.getClient().client_id);
    }

    static set clientId(clientId) {
        Fs.writeFS('client_secret.json', {
            installed: Object.assign(AssistantSetup.getClient(), { client_id: clientId } ),
            redirect_uris: ["urn:ietf:wg:oauth:2.0:oob"]
        });
    }

    static get clientSecret() {
        return Boolean(AssistantSetup.getClient().client_secret);
    }

    static set clientSecret(clientSecret) {
        Fs.writeFS('client_secret.json', {
            installed: Object.assign(AssistantSetup.getClient(), { client_secret: clientSecret } ),
            redirect_uris: ["urn:ietf:wg:oauth:2.0:oob"]
        });
    }

    static get token() {
        return Boolean(Fs.readFS('tokens.json').access_token);
    }

    static set token(oAuthCode) {
        let oAuthClient = AssistantSetup.getOAuthClient();
        console.log('oAuthCode: '+oAuthCode);

        if (oAuthClient) {
            oAuthClient.getToken(oAuthCode, (error, tokens) => {
                if (error) {
                    // reject('Couldnot get tokens, error: '+error); TODO
                }
                console.log("tokens: "+tokens);
                Fs.writeFS('tokens.json', tokens);
                // resolve({response: 'ok'});
            });
        } else {
            // reject('setToken exception: '+e); TODO
        }
    }
}

module.exports = AssistantSetup;