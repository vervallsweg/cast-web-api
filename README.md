# cast-web-api
[![npm version](https://badge.fury.io/js/cast-web-api.svg)](https://badge.fury.io/js/cast-web-api)
[![Dependency Status](https://img.shields.io/david/vervallsweg/cast-web-api.svg)](https://david-dm.org/vervallsweg/cast-web-api)
[![npm](https://img.shields.io/npm/dm/cast-web-api.svg?maxAge=2592000)]()

Web API for Google Cast enabled devices, based on the [node-castv2](https://github.com/thibauts/node-castv2 "node-castv2") implementation by thibauts.

This API is only intended to be used on your local network **not for hosting on the public internet**.

## Installation
You probably don't want to install the api directly. For a GUI install [cast-web-api-desktop](https://github.com/vervallsweg/cast-web-api-desktop), for headless server installation use [cast-web-api-cli](https://github.com/vervallsweg/cast-web-api-cli).

## Usage

### Basics
cast-web-api tries to behave like the Google Home app. All available devices will be connected to, if a device goes down, it'll be removed. If it randomly disconnects, it'll try to reconnect.
The autoConnect behavior can be turned of with the config parameter `autoConnect`. This can be helpful for [large speaker groups](https://github.com/vervallsweg/cast-web-api/issues/92).

### Parameters

Every changed parameter will be saved in `/config/config.json`. This location will be changed in the next release.

### Documentation

#### Online
Parse the [swagger.json](https://raw.githubusercontent.com/vervallsweg/cast-web-api/master/lib/swagger/swagger.json "swagger.json"), in the [online editor](https://editor.swagger.io/).

#### Local
Install the devDependencies for instance `git clone` this repo then `npm install` into the repo. Docs now available at `/swagger`.

## Debugging //TODO: remove/edit
Every log output follows this format: {time} {device id} {function name}: {message}. For easy differentiation between those components, device id is inverted in color and function name underlined. Info messages appear in your standard terminal color. Error messages in red, warning messages in red and server related messages in blue.
```
2018-03-31T18:27:09.508Z a90824f40764eb5df1fccc4f5cb95dd3 reconnectionManagement(): reconnecting
```

By default only certain messages are logged, to enable all log-levels see the swagger documentation on /config.

## Further information
[thibauts](https://github.com/thibauts "thibauts profile") wrote a great [protocol description](https://github.com/thibauts/node-castv2#protocol-description "protocol description"). I can only highly recommend reading it.

If you read the first sentences of this file it goes without saying that you **should not** run this API on the internet. Run it behind a firewall only in your local network!

If you find a bug or typo, feel free to contact me, open an issue, fork it, open prs, you name it.