class ReconnectionManager {
    constructor() {
        //old
        this.event.on('linkChanged', function() {
            //reconnectionManagementInit
            that.reconnectionManagement();
        });
    }

    reconnectionManagement() {
        logger.log('debug', 'reconnectionManagement()', 'link changed to: ' + this.link + ', reconnectInterval: ' + this.reconnectInterval, this.id);
        var that = this;

        if (this.link=='disconnected') {
            if (this.reconnectInterval==null) {
                this.reconnectInterval = 'blocked';
                logger.log('debug', 'reconnectionManagement()', 'starting interval', this.id);
                this.reconnectInterval = setInterval(function() {
                    logger.log('debug', 'reconnectionManagement()', 'reconnect evaluating', that.id);
                    if (that.link!='connected' && that.link!='connecting') {
                        logger.log('info', 'reconnectionManagement()', 'reconnecting', that.id);
                        that.connect();
                    }
                }, 300000); //TODO: fix multiple reconnects if .conect() was called multiple times
            }
        } else {
            logger.log('debug', 'reconnectionManagement()', 'interval evaluating', this.id);
            if (this.reconnectInterval!=null) {
                logger.log('debug', 'reconnectionManagement()', 'interval remove', this.id);
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
        }
    }
}