const CastBrowser = require("./cast-browser");
const Logger = require("../log/logger");

class CastManager {

    constructor() {
        this._devices = [];
        this._browser = new CastBrowser(this);
    }

    getDevices(connection) {
        let allDevices = [];
        this._devices.forEach(function(element) {
            if (connection === 'all') {
                allDevices.push( element.toString() );
            } else {
                if (element.link === connection) {
                    allDevices.push( element.toString() );
                }
            }
        });
        return allDevices;
    }

    deviceExists(id) {
        let exists = false;
        this._devices.forEach(function(element) {
            if (element.id === id) {
                exists = true;
            }
        });
        return exists;
    }

    getDevice(id) {
        let returnElement = null;
        this._devices.forEach(function(element) {
            if (element.id === id) {
                returnElement = element;
            }
        });
        return returnElement;
    }

    getDeviceConnected(id){
        let that = this;
        return new Promise( function(resolve, reject) {
            if ( that.getDevice(id) ) {
                if ( that.getDevice(id).link === 'connected' ) {
                    resolve( that.getDevice(id) );
                } else {
                    that.getDevice(id).connect();

                    that.getDevice(id).event.once('linkChanged', function() {
                        Logger.log('debug', 'getDeviceConnected()', 'once linkChanged: ' + that.getDevice(id).link, id);
                        resolve( that.getDevice(id) );
                    });

                    setTimeout(function() {
                        resolve( that.getDevice(id) );
                    }, 5000);
                    //TODO: better solution
                }

            } else {
                reject("Device doesn't exist");
            }
        });
    }

    connectGroups(castDevice) {
        Logger.log('info', 'connectGroups()', '', castDevice.id);
        if (castDevice.groups) {
            castDevice.groups.forEach(function(groupId) {
                let group = this.getDevice(groupId);

                if (group) {
                    if (group.link === 'disconnected') {
                        group.connect();
                    }
                }
            });
        }
    }

    //browser

    addDevice(device) {
        if (!this.deviceExists(device.id)) {	//TODO: issue if device down -> device up with new address
            Logger.log('info', 'addDevice()', '', device.id);
            this._devices.push(device);
        }
    }

    updateDevice(change) {
        let targetDevice = this.getDevice(change.id);

        if (targetDevice) {
            Logger.log('info', 'updateDevice()', JSON.stringify(change), targetDevice.id);
            if (change.kind === 'name') {
                targetDevice.name = change.value;
            }
            if (change.kind === 'address') {
                targetDevice.setAddress(change.value);	//TODO: deviceChange address can first change port > 20sec later host: disconnect and reconnect in recon man timeout. Make sure to not double recon man
            }
        }
    }

    removeDevice(id) {
        Logger.log('info', 'removeDevice()', '', id);
        if ( this.deviceExists(id) ) {
            let targetIndex = null;

            this.getDevice(id).disconnect();

            this._devices.forEach(function(element, index) {
                if (element.id === id) {
                    targetIndex = index;
                }
            });

            if (targetIndex!=null) {
                this._devices.splice(targetIndex, 1)
            }
        }
    }
}

module.exports = CastManager;