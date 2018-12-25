const logger = require('../../../log/logger');

class CastGroup {
    constructor(master, members=[]) {
        this._master = master;
        this._members = members;

        this.setListeners();
    }

    setListeners() {
        this._master.on('statusChanged', () => {
            this.syncStatus();
        });

        // this.on('linkChanged', () => { //TODO:
        //     //auto connect groups
        //     if (this.link == 'connected' || this.link == 'connecting') {
        //         if (this.groups) {
        //             this.groups.forEach(function(group) {
        //                 if (group.link != 'connected' && group.link != 'connecting') {
        //                     group.link = 'connecting';
        //                     group.connect();
        //                 }
        //             });
        //         }
        //     }
        // });
    }

    syncStatus() {
        if (this._members) {
            if (this._master.link === 'connected' && this._master.sessionId != null) {
                logger.log('info', 'CastGroup.syncStatus()', 'syncing group this._master.sessionId'+this._master.sessionId, this._master.id);
                this.setStatus(this.getMediaStatus(this._master.toObject()));
            } else {
                console.log('link: '+this._master.link+', this._master.sessionId: '+this._master.sessionId);
                logger.log('info', 'CastGroup.syncStatus()', 'used to be group, remove & reset', this._master.id);

                this.setStatus({groupPlayback: false, application: '', status: '', title: '', subtitle: '', image: ''});
                //TODO: reset as well, either in cast-device set status (if was groupPlayback) or see if cast-device sends new status on its own
            }
        } else {
            logger.log('info', 'CastGroup.syncStatus()', 'has no members, removing', this._master.id); //TODO: wtf? If it has no members, what are we iterating over for delete??

            this.setStatus({groupPlayback: false});
        }
    }

    setStatus(status) {
        this._members.forEach(member => {
            console.log('new status: '+JSON.stringify(status));
            member.status = status;
        });
    }

    getMediaStatus(status) {
        return {
            'groupPlayback': status.id,
            'application': status.status.application,
            'status': status.status.status,
            'title': status.status.title,
            'subtitle': status.status.subtitle,
            'image': status.status.image
        };
    }

    addMember(castDevice) {
        let member = this.getMember(castDevice.id);

        if (!member) {
            this._members.push(castDevice);
            this._master.emit('statusChanged');
        }

            // //connecting group members //TODO: is this necessary?
            // if (this.link=='connected' || this.link=='connecting') { //to not trigger recon man if device was never online
            //     this.event.emit('linkChanged');
            // }
    }

    removeMember(castDevice) {
        this._members.forEach(( member, index )=> {
            if (member.id === castDevice.id) {
                this._members.splice(index, 1); //TODO: better solution for parallel access
                logger.log("info", "CastGroup.removeMember()",'removed member', castDevice.id);
            }
        });
    }

    getMember(id) {
        let found = null;
        this._members.forEach(member => {
            if (member.id === id) {
                found = member;
            }
        });
        return found;
    }

    get members() {
        let members = [];
        this._members.forEach(member => {
            members.push(member.id);
        });
        return members;
    }
}

module.exports = CastGroup;