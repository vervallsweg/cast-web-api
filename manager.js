const pm2 = require('pm2');
const { exec } = require('child_process');

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

    static startup() {
        let windows = process.platform === "win32";
        if (windows) return Manager.startupWin();
        else return Manager.startupPm2();
    }

    static startupPm2() {
        return new Promise((resolve, reject) => {
            let cmd = require.resolve('pm2').replace('index.js', 'bin/pm2');
            exec(`${cmd} startup`, (error, stdout, stderr) => {
                if (error || stderr) {
                    reject({error: error, stdout: stdout, stderr: stderr});
                }
                resolve(stdout);
            });
        });
        // platform, opts, cb //TODO: documentation parameters (platform, errback) broke, this param hack works for now
        // pm2.startup(false, { args:[0, { name: function () { return "startup"; }}] }, (err, result) => {})
    }

    static startupWin() {
        return new Promise((resolve, reject) => {
            let cmd = require.resolve('pm2-windows-service').replace('src/index.js', 'bin/pm2-service-install');
            exec(`${cmd}`, (error, stdout, stderr) => {
                if (error || stderr) {
                    reject({error: error, stdout: stdout, stderr: stderr});
                }
                resolve(stdout);
            });
        });
    }

    static unstartup() {
        let windows = process.platform === "win32";
        if (windows) return Manager.unstartupWin();
        else return Manager.unstartupPm2();
    }

    static unstartupPm2() {
        return new Promise((resolve, reject) => {
            let cmd = require.resolve('pm2').replace('index.js', 'bin/pm2');
            exec(`${cmd} unstartup`, (error, stdout, stderr) => {
                if (error || stderr) {
                    reject({error: error, stdout: stdout, stderr: stderr});
                }
                resolve(stdout);
            });
        });
    }

    static unstartupWin() {
        return new Promise((resolve, reject) => {
            let cmd = require.resolve('pm2-windows-service').replace('src/index.js', 'bin/pm2-service-uninstall');
            exec(`${cmd}`, (error, stdout, stderr) => {
                if (error || stderr) {
                    reject({error: error, stdout: stdout, stderr: stderr});
                }
                resolve(stdout);
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