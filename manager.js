const pm2 = require('pm2');

class Manager {
    static start(argument) {
        return new Promise((resolve, reject) => {
            Manager.isReady().then(ready => {
                pm2.start({
                    script: 'api.js',
                    name: 'cast-web-api',
                    args: argument,
                }, (err, proc) => {
                    pm2.disconnect();
                    if (err) {
                        reject(err);
                    } else {
                        Manager.status()
                            .then(status => resolve(status))
                            .catch(err => resolve(proc));
                    }
                });
            });
        });
    }

    static stop() {
        return new Promise((resolve, reject) => {
            Manager.isReady().then(ready => {
                pm2.stop('cast-web-api', (err, proc) => {
                    pm2.disconnect(); //TODO: better solution
                    if (err) {
                        reject(err);
                    }

                    resolve(proc);
                });
            });
        });
    }

    static status() {
        return new Promise(resolve => {
            let promises = [];
            Manager.getProcessDescriptionList()
                .then(processDescriptionList => {
                    processDescriptionList.forEach(pd => promises.push(Manager.sendToProcessDesc(pd)));

                    Promise.all(promises)
                        .then(addresses => {
                            resolve(addresses);
                            pm2.disconnect();
                        });
                })
                .catch(err => {
                    console.error(err);
                    pm2.disconnect();
                    resolve([]);
                });
        });
    }

    static getProcessDescriptionList() {
        return new Promise((resolve, reject) => {
            Manager.isReady().then(ready => {
                pm2.describe('cast-web-api', (err, processDescriptionList) => {
                    // pm2.disconnect(); //TODO: better solution
                    if (err) {
                        reject(err);
                    }
                    resolve(processDescriptionList);
                });
            });
        });
    }

    static sendToProcessDesc(processDescription) {
        return new Promise(resolve => {
            if (processDescription.pm2_env.status === 'online') {
                try {
                    pm2.sendDataToProcessId(processDescription.pm_id, {
                        type : 'process:msg',
                        data : {
                            some : 'data',
                            hello : true
                        },
                        topic: 'some topic'
                    }, function(err, res) {
                        if (err) {
                            console.error(err);
                            resolve(false);
                        }
                    });
                } catch (e) {
                    console.error(e);
                    resolve(false);
                }

                pm2.launchBus((err, bus) => {
                    bus.on('process:msg', (packet) => {
                        processDescription.address = packet.data.address;
                        resolve(processDescription);
                    });
                });
            } else {
                resolve(false);
            }
        })
    }

    static isReady() {
        return new Promise((resolve, reject) => {
            pm2.connect(err => {
                if (err) {
                    reject(err); //TODO: do sth with the error
                    process.exit(2);
                }
                resolve(true);
            });
        });
    }
}

module.exports = Manager;