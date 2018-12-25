const CastDevice = require("./id/cast-device");
const MdnsCastBrowser = require("mdns-cast-browser");

class CastBrowser {
    constructor(castManager) {
        this._browser = new MdnsCastBrowser();
        this._browser.discover();
        this._castManager = castManager;
        this.setup();
    }

    setup() {
        this._browser.on('deviceUp', device => {
            let newDevice = new CastDevice(device.id, device.address, device.name);
            this._castManager.addDevice(newDevice);
        });

        this._browser.on('deviceDown', device => {
            this._castManager.removeDevice(device.id);
        });

        this._browser.on('deviceChange', change => {
            this._castManager.updateDevice(change);
        });

        this._browser.on('groupsUp', groups => {
            // console.log('groupsUp: ' + JSON.stringify(groups));
            this._castManager.groupUp(groups);
        });

        this._browser.on('groupsDown', groups => {
            // console.log('groupsDown: ' + JSON.stringify(groups));
            this._castManager.groupDown(groups);
        });

        // this._browser.on('groupsUp', groups => {
        //     console.log('groupsUp: '+JSON.stringify(groups));
        //     let targetDevice = getDevice(groups.id);
        //
        //     if (targetDevice) {
        //         if (groups.groups) {
        //             groups.groups.forEach(function(group) {
        //                 let groupDevice = getDevice(group);
        //                 if (groupDevice) {
        //                     targetDevice.setGroup(groupDevice);
        //                     groupDevice.setMember(targetDevice);
        //                 }
        //             });
        //         }
        //     }
        // });
        //
        // this._browser.on('groupsDown', groups => {
        //     console.log('groupsDown: '+JSON.stringify(groups));
        //     let targetDevice = getDevice(groups.id);
        //
        //     if (targetDevice) {
        //         if (groups.groups) {
        //             groups.groups.forEach(function(group) {
        //                 targetDevice.removeGroup(group);
        //                 let groupDevice = getDevice(group);
        //                 if (groupDevice) {
        //                     groupDevice.removeMember(targetDevice.id);
        //                 }
        //             });
        //         }
        //     }
        // });
    }
}

module.exports = CastBrowser;