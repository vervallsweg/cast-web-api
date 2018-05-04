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

### Basics
Every call uses HTTP. Only starting a new playback uses POST, everything else uses GET.

A device will be managed by the API, after you accessed it through /device/{id} or ran any command on it successfully. The API will discover devices automatically, handle address changes and will try to reconnect to all managed devices if they become 'disconnected'.

### /device
Every request without a device command returns a device status object with the following format.
``` 
{
	"id": "abc1234a",
	"name": "My Chromecast",
	"connection": "{connected/disconnected}",
	"address": {
		"host": "192.168.43.21",
		"port": "8009"
	},
	"status": {
		"volume": 10,
		"muted": {true/false},
		"application": "Spotify",
		"status": "{PLAYING/PAUSED/IDLE/BUFFERING}",
		"title": "My song",
		"subtitle": "Artist",
		"image": "http://url.to/image",
		"groupPlayback": {true/false if device is member of group}
	},
	"groups": [ {ids of the groups this device is part of} ],
	"members": [ {ids of the member devices this group has} ]
}
```
Every request with a device command returns a simple JSON object with a response (response object). In addition to setting the HTTP response code to 200 (success), 404 (command unknown) or 500 (error occured).
```
{
	"response": "{ok/error}",
	{"error": "error message"}
}
```
Please note that {a/b} refers to the possible values of a key and the brackets are not part of the response.

#### /
Returns a JSON array with device status objects of all devices that are/were connected to the API.
```
http://127.0.0.1/device/
```

#### /discover
Manually starts device discovery. The currently used mdns packages makes installation easy but *device discovery [unreliable](https://github.com/vervallsweg/cast-web-api/issues/35 "unreliable") sometimes*. This is especially noticeable when using the API's group features. Audio groups can literally disappear because a discovery didn't return all the group devices. 

```
http://127.0.0.1/device/discover
```

#### /{connected/disconnected}
Filters / for only connected/disconnected devices.
```
http://127.0.0.1/device/connected
```

#### /{device id}
Returns the device status object of the specified device. This command also connects the device to the API. If no device with the specified id was found on the network it returns a response object with an error message.
The device will show up in / and reconnected automaticaly, after this request (or any request with a device id) is completed successfully.
```
http://127.0.0.1/device/abc1234a/
```

##### /muted/{true/false}
Returns a response object and (un-)mutes the device.
```
http://127.0.0.1/device/abc1234a/muted/true
```

##### /volume/{level}
Returns a response object and sets the volume on the device. Level is an int value between 0-100.
```
http://127.0.0.1/device/abc1234a/volume/25
```

##### /play
Returns a response object and continous playback on the device. If there's no playback on the device, or the receiver doesn't support playback control, it returns an error object.
```
http://127.0.0.1/device/abc1234a/play
```

##### /pause
Returns a response object and pauses playback on the device. If there's no playback on the device, or the receiver doesn't support playback control, it returns an error object.
```
http://127.0.0.1/device/abc1234a/pause
```

##### /stop
Returns a response object and stops playback on the device. If there's no playback on the device, or the receiver cannot be closed, it returns an error object.
```
http://127.0.0.1/device/abc1234a/stop
```

##### /image
Proxies the image from the device's image url. Useful if your application can only access local content.

##### /playMedia [HTTP POST]
Returns a response object. Requires a JSON array with the media information in the request data. 
It uses Google's [default media receiver](https://developers.google.com/cast/docs/receiver_apps#default "Default Media Receiver"). If you don't know what this is please **read the documentation first**, it is linked above and below. Remember: always check device compatibility (formats, screen available) before casting your media to a device!
- mediaType: the Google Cast media type string, see: - [supported media](https://developers.google.com/cast/docs/media#media-type-strings "supported media"). Don't just use mp3 or mp4, the correct string from the doc is needed (e.g. audio/mp3).
- mediaUrl: HTTP(S) url to your content
- mediaStreamType: Stream type of media your media, see: - [streamType](https://developers.google.com/cast/docs/reference/messages#MediaInformation "streamType")
- mediaTitle (->title)
- mediaSubtitle (->subtitle)
- mediaImageUrl (->images[0]): see - [generic media metadata](https://developers.google.com/cast/docs/reference/messages#GenericMediaMetadata "generic media metadata")
```
TODO: curl example
```

##### /playMediaGet [deprecated]
Equal to /playMedia just using GET. Warning: Pasting a JSON array into the request query is not a great idea. Links can be truncated, encoded/decoded wrong, leading to playback errors in the best case. Use /playMedia whenever possible!

##### /subscribe/{callback address}
Creates a subscription for the selected device. When the device's status object changes (i.e. volume/playback changes) the new status update is send to the callback address. For now it only supports http callbacks and only one per device. If you call this path again for the same device, with a different callback address, the old callback will be overwritten.
```
http://127.0.0.1/device/abc1234a/subscribe/127.0.0.2:8080
```

##### /unsubscribe
Removes all subscriptions from the selected device.
```
http://127.0.0.1/device/abc1234a/unsubscribe
```

##### /remove
Disconnects the selected device and it will no longer be managed by the API.
```
http://127.0.0.1/device/abc1234a/remove
```

#### /config
``` 
{
	parameter: value
}
```
Returns all config parameters with the current value. 


Requests with just the parameter specified return it's current value. If the request also includes a /value it will be changed.
Returns a json object with parameter:value.
```
http://127.0.0.1/config/timeoutDiscovery/		//Returns current value
http://127.0.0.1/config/timeoutDiscovery/6000		//Returns 6000 and sets timeoutDiscovery to 6000[ms]
```

##### /timeoutDiscovery/{value}
Default: 4000[ms].
Sets the time for the server to wait for all Cast devices on the network to reply on discovery. Increase this value if you're having difficulties discovering all devices on your network.

##### /reconnectInterval/{value}
Default: 300000[ms].
The amount of time after which the API attempts to reconnect to a device in /device.

##### /discoveryInterval/{value}
Default: 60000[ms].
Sets the interval for the API's automatic device discovery. This ensures that devices can be connected faster and handles address changes.

##### /groupManagement/{true/false}
Default: true.
Group-management automatically connects all group members if a cast group is connected to the API. This allows for more reliable group playback detection.

##### /version
Returns "this" and "latest" versions.

##### /version/this
API version you're currently running.

##### /version/latest
Latest API version available on GitHub.

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