# cast-web-api
Web API for Google Cast enabled devices, based on the [node-castv2](https://github.com/thibauts/node-castv2 "node-castv2") implementation by thibauts.

This API is only intendend to be used on your local network **not for hosting on the public internet**.

## Installation
	$ npm install cast-web-api -g

## First steps
    $ cast-web-api

The server runs on your network IP:3000 by default. On error it defaults to 127.0.0.1. Adjustable via:

	$ cast-web-api --hostname=192.168.0.11 --port=8080

## Run as daemon
[Forever](https://github.com/foreverjs/forever "forever") is recommended:

	$ npm install forever -g

### Linux/OSX

	$ forever start `which cast-web-api`
	$ forever stop `which cast-web-api`

If you'd like to always run the API in the background even after reboots, you can use crontab.

	$ # While using forever
	$ (crontab -l 2>/dev/null; echo "@reboot `which forever` `which cast-web-api`")| crontab -
	$ # While using vanilla node
	$ (crontab -l 2>/dev/null; echo "@reboot `which node` `which cast-web-api` >> ~/cast-web-api.log")| crontab -

Adjust the command to pass parameters via `crontab -e`. The vanilla node version will log output to `~/cast-web-api.log` e.g. `/home/yourname/cast-web-api.log`.

### Windows

	> cast-web-api --windows

Copy the result path and change directory to it:

	> cd {path you just copied}

Finally you can also use forever.

	> forever start castWebApi.js
	> forever stop castWebApi.js

## Usage

[Documentation](https://vervallsweg.github.io/cast-web/swagger/ "Documentation"), to use the 'Try it out' feature, start the API on 127.0.0.1:3000.

### Basics
A device will be managed by the API, after you accessed it through /device/{id} or ran any command on it successfully. The API will discover devices automatically, handle address changes and will try to reconnect to all managed devices if they become 'disconnected'.

## Debugging
Every log output follows this format: {time} {device id} {function name}: {message}. For easy differentiation between those components, device id is inverted in color and function name underlined. Info messages appear in your standard terminal color. Error messages in red, warning messages in red and server related messages in blue.
```
2018-03-31T18:27:09.508Z a90824f40764eb5df1fccc4f5cb95dd3 reconnectionManagement(): reconnecting
```

cast-web-js uses npm's debug package. Debugging can be enabled with the following command:

    $ DEBUG=cast-web-api node (yourdirectory)/castWebApi.js

If you need further information you can enable debugging for the underlying castv2 module. You can either set the scope to castv2 or to everything:

	$ DEBUG=* node (yourdirectory)/castWebApi.js

## Further information
[thibauts](https://github.com/thibauts "thibauts profile") wrote a great [protocol description](https://github.com/thibauts/node-castv2#protocol-description "protocol description"). I can only highly recommend reading it.

If you read the first sentences of this file it goes without saying that you **should not** run this API on the internet. Run it behind a firewall only in your local network!

If you find a bug or typo, feel free to contact me, open an issue, fork it, open prs, you name it.