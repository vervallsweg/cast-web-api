const fs = require('fs')
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
        return new Promise((resolve, reject) => {
            let windows = process.platform === "win32";
            Manager.save(windows)
                .then(() => {
                    if (windows) resolve(Manager.startupWin());
                    else resolve(Manager.startupPm2());
                })
                .catch(error => {
                    reject({error: {message: "Couldn't save pm2 processes"}, stdout: "", stderr: error});
                })
        })
    }

    static startupPm2() {
        return new Promise((resolve, reject) => {
            let cmd = require.resolve('pm2').replace('index.js', 'bin/pm2');
            exec(`${cmd} startup`, (error, stdout, stderr) => {
                if (error || stderr) {
                    if (stdout && stdout.includes("sudo env")) {
                        reject({error: {message:"Permissions required. To do this, just copy/paste and run this command: \n"}, stdout: stdout, stderr: stderr});
                    } else {
                        reject({error: error, stdout: stdout, stderr: stderr});
                    }
                }
                resolve(stdout);
            });
        });
        // platform, opts, cb //TODO: documentation parameters (platform, errback) broke, this param hack works for now
        // pm2.startup(false, { args:[0, { name: function () { return "startup"; }}] }, (err, result) => {})
    }

    static startupWin() {
        return new Promise((resolve, reject) => {
            let pm2WindowsStartupPath = require.resolve('pm2-windows-startup');
            Manager.fixWinResurrectBat(pm2WindowsStartupPath.replace('index.js', 'pm2_resurrect.cmd'))
                .then(()=>{
                    reject({error: {message: "Windows, to auto start, just copy/paste and run the command below: \n"}, stdout: `node ${pm2WindowsStartupPath} install`, stderr: ""});
                })
                .catch(error => {reject(error)});
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
                    if (stdout && stdout.includes("sudo env")) {
                        reject({error: {message:"Permissions required. To do this, just copy/paste and run this command: \n"}, stdout: stdout, stderr: stderr});
                    } else {
                        reject({error: error, stdout: stdout, stderr: stderr});
                    }
                }
                resolve(stdout);
            });
        });
    }

    static unstartupWin() {
        return new Promise((resolve, reject) => {
            let cmd = `${require.resolve('pm2-windows-startup')} uninstall`;
            reject({error: {message: "Windows, to stop auto start, just copy/paste and run the command below: \n"}, stdout: `node ${cmd}`, stderr: ""});
        });
    }

    static save(windows) {
        return new Promise((resolve, reject) => {
            let cmd = `${require.resolve('pm2').replace('index.js', 'bin/pm2')} save`;
            if (windows) cmd = `node ${require.resolve('pm2').replace('index.js', 'bin\\pm2')} save`;
            exec(cmd, (error, stdout, stderr) => {
                if (error || stderr) {
                    reject({error: error, stdout: stdout, stderr: stderr});
                }
                resolve(stdout);
            });
        });
    }

    static fixWinResurrectBat(resurrectBatPath) {
        return new Promise((resolve, reject) => {
            fs.readFile(resurrectBatPath, 'utf8', (err, data) => {
                if (err) reject(err); //TODO: adapt to custom object format

                if (!data.includes('\\pm2')) {
                    let newPM2Path = `node ${require.resolve('pm2').replace('index.js', 'bin\\pm2')}`;
                    let newResurrectBat = data.replace('pm2', newPM2Path);

                    fs.writeFile(resurrectBatPath, newResurrectBat, 'utf8', err => {
                        if (err) reject(err); //TODO: adapt to custom object format
                        else resolve(true);
                    });
                } else {
                    resolve(true);
                }
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

    static fixPermission() {
        return new Promise((resolve, reject) => {
            let windows = process.platform === "win32";
            let Config = require('./lib/config/config');
            let user =  process.env.USER || process.env.USERNAME;
            let path = Config.getAbsolutePath();

            if (!windows) {
                reject({error: {message: "To change permissions, just copy/paste and run the commands below. Change the username if necessary: \n"}, stdout: `chmod -R 0600 ${path}/config\nchown -R ${user} ${path}/config`, stderr: ""});
            } else {
                reject({error: {message: "To change permissions, just copy/paste and run the command below. Change the username if necessary: \n"}, stdout: `icacls ${path}\\config /grant ${user}:M`, stderr: ""});
            }
        });
    }
}

module.exports = Manager;