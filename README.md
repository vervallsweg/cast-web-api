# cast-web-api
Quick and dirty Node.js web API for Google Cast enabled devices.

This simple web API is based on the awesome [node-castv2](https://github.com/thibauts/node-castv2 "node-castv2") implementation by thibauts.
However my code is **verry badly written and experimental code, not intendend for any production environment!**

Installation
------------

First you'll need to install the dependencies of this project, preferably via npm.

    $ npm install castv2, mdns, debug

Afterwards simply clone the repo to your prefered destination

    $ git clone https://github.com/vervallsweg/cast-web-api.git


By default the server runs localhost:3000. They can be adjusted by changing const hostname and port in line 1-2.

```
const hostname = '127.0.0.1';
const port = 3000;
```

Now you can simply call the script and the web-api should be up and running!

    $ node (yourdirectory)/castWebApi.js


Usage
-----

### Request URLs

Request URLs are formated like this:

    http://{hostname}:{port}/{request}?{parameter}={parameter_value}

Example URL for setting the volume to 50%:

    http://127.0.0.1:3000/setDeviceVolume?address=192.168.86.86&volume=0.5

None of the parameters has to be put in '' or anything like that. Just paste it in.

#### getDevices
Returns a JSON Array of devices found on the network
``` 
[
	[
		"device name",
		"IP",
		port
	],
	[
		...
	]

]
```

#### getDeviceStatus (address)
**Returns DEVICE_STATUS,**

which is JSON encoded and part of the Google Cast protocol.
- address: IP adress of the Google Cast device

#### setDeviceVolume (address) (volume) 
**Returns DEVICE_STATUS,**

and sets the device volume. The return value reflects the state of the device after the command was executed.
- address: IP adress of the Google Cast device
- volume: Float value from 0-1 (0.1=10%, 0.2=20%, ...)

#### setDeviceMuted (address) (muted)
**Returns DEVICE_STATUS,**

and mutes or unmutes the device.
- address: IP adress of the Google Cast device
- muted: true / false

#### getMediaStatus (address) (sessionId)
**Returns MEDIA_STATUS,**

which is JSON encoded and part of the cast protocol as well. 
Can **only** be executed if something is loaded or playing on the device (sessionId must be set). Check for sessionId by using getDeviceStatus.
- address: IP adress of the Google Cast device
- sessionId: sessionId of the current active session

#### setMediaPlaybackPause (address) (sessionId) (mediaSessionId)
**Returns MEDIA_STATUS,**

and pauses currently playing media. mediaSessionId is included in getMediaStatus.
- address: IP adress of the Google Cast device
- sessionId: sessionId of the current active session
- mediaSessionId: int

#### setMediaPlaybackPlay (address) (sessionId) (mediaSessionId)
**Returns MEDIA_STATUS,**

and plays currently loaded media.
- address: IP adress of the Google Cast device
- sessionId: sessionId of the current active session
- mediaSessionId: int

#### setDevicePlaybackStop (address) (sessionId)
**Returns DEVICE_STATUS, *not* MEDIA_STATUS,**

and stops casting to the device, kills currently running session. 
- address: IP adress of the Google Cast device
- sessionId: sessionId of the current active session

### HTTP response codes
The server will return an HTTP status code so you can quickly determin if the request was successfull or not
- 200: Successfull communication with your Google Cast device requested JSON data is returned
- 400: Parameters missing or in the wrong format, returns 'Parameter error'
- 404: Requested URL doesn't match any function, returns 'Not found'
- 500: Comunication with Cast device failed, enable debuging to check for possible errors