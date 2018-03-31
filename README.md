# cast-web-api
Web API for Google Cast enabled devices, based on the [node-castv2](https://github.com/thibauts/node-castv2 "node-castv2") implementation by thibauts.

This API is only intendend to be used on your local network **not for hosting on the public internet**.

## Installation
Install cast-web-api as a command line utility. Check your permissions first!

	$ npm install cast-web-api -g

## First steps
    $ cast-web-api

The server runs on your network IP and port 3000 by default. If it cannot determine your ip it defaults to 127.0.0.1. Both parameters can be adjusted with the `--hostname` and  `--port` arguments:

	$ cast-web-api --hostname=192.168.0.11 --port=8080

If you'd like to run the API in the background as a daemon [forever](https://github.com/foreverjs/forever "forever") is recommended

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

	> where cast-web-api

Copy the result path till the npm folder. Then append 'node_modules\cast-web-api' to it. Then change to the new directory:

	> cd C:\Users\name\AppData\Roaming\npm\node_modules\cast-web-api\

Finally you can also use forever.

	> forever start castWebApi.js
	> forever stop castWebApi.js

## Usage

### Basics
Every call uses HTTP. Only starting a new playback uses POST, everything else uses GET.

1. /disover all devices on the network
2. /device/{id} for all the devices you want to connect to the API.

After you ran any command on /device/{id} successfully it will be managed by the API. You can list all devices managed by the API with /device. The API will handle address changes and will try to reconnect to all managed devices if they become 'disconnected'

### /discover
Returns a JSON array of devices found on the network. The mdns packages makes installation easier but *device discovery [unreliable](https://github.com/vervallsweg/cast-web-api/issues/35 "unreliable") sometimes*.
``` 
[
	{
		"id": "abc1234a-...",
		"name": "Living room TV",
		"ip": "192.168.0.12",
		"port": 8009
	},
	{
		...
	}
]
```

    http://{host}/discover


### /device
Every request without a device command returns a device status object with the following format.
``` 
{
	"id": "abc1234a",
	"connection": "{connected/disconnected}",
	"volume": 10,
	"muted": {true/false},
	"application": "Spotify",
	"status": "{PLAYING/PAUSED/IDLE/BUFFERING}",
	"title": "My song",
	"subtitle": "Artist"
}
```
Every request with a device command returns a simple JSON object with a response (response object).
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

#### /{device id}
Returns the device status object of the specified device. This command also connects the device to the API. If no device with the specified id can be found on the network it returns a response object with an error message.
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

##### /playMedia [HTTP POST]
Returns a response object. Requires a JSON object with the media information in the request data. 
It uses Google's [default media receiver](https://developers.google.com/cast/docs/receiver_apps#default "Default Media Receiver"). If you don't know what this is please **read the documentation first**, it is linked above and below. Remember: always check device compatibility (formats, screen available) before casting your media to a device!
- contentType: the Google Cast media type string, see: - [supported media](https://developers.google.com/cast/docs/media#media-type-strings "supported media"). Don't just use mp3 or mp4, the correct string from the doc is needed (e.g. audio/mp3).
- mediaUrl: HTTP(S) url to your content
- mediaStreamType: Stream type of media your media, see: - [streamType](https://developers.google.com/cast/docs/reference/messages#MediaInformation "streamType")
- mediaTitle (->title)
- mediaSubtitle (->subtitle)
- mediaImageUrl (->images[0]): see - [generic media metadata](https://developers.google.com/cast/docs/reference/messages#GenericMediaMetadata "generic media metadata")
```
TODO: curl example
```

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
Requests with just the parameter return it's current value. If the request also includes a /value it will be changed.
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
The amount of time after which the API attempts to reconnect to a device in /devices.

##### /discoveryInterval/{value}
Default: 60000[ms].
Sets the interval for the API's automatic device discovery. This ensures that devices can be connected faster and handles address changes.

##### /version/this
API version you're currently running.

##### /version/latest
Latest API version available on GitHub.

## Debugging
cast-web-js uses npm's debug package. Debugging can be enabled with the following command:

    $ DEBUG=cast-web-api node (yourdirectory)/castWebApi.js

If you need further information you can enable debugging for the underlying castv2 module. You can either set the scope to castv2 or to everything:

	$ DEBUG=* node (yourdirectory)/castWebApi.js

## Further information
[thibauts](https://github.com/thibauts "thibauts profile") wrote a great [protocol description](https://github.com/thibauts/node-castv2#protocol-description "protocol description"). I can only highly recommend reading it.

If you read the first sentences of this file it goes without saying that you **should not** run this API on the internet. Run it behind a firewall only in your local network!

If you find a bug or typo, feel free to contact me, open an issue, fork it, open prs, you name it.