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

### HTTP response codes
- 200: Successfull communication with your Google Cast device requested JSON data is returned
- 400: Parameters missing or in the wrong format, returns 'Parameter error'
- 404: Requested URL doesn't match any function, returns 'Not found'
- 500: Comunication with Cast device failed, enable debuging to check for possible errors

### Request URLs

    http://{hostname}:{port}/{request}?{parameter}={parameter_value}

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
Returns the Google Cast DEVICE_STATUS, which is JSON encoded.
- address: IP adress of the Google Cast device

#### setDeviceVolume (address) (volume) 
Sets the device volume and *returns* DEVICE_STATUS. This reflects the state of the device after the command was executed.
- address: IP adress of the Google Cast device
- volume: Float value from 0-1 (0.1=10%, 0.2=20%, ...)

#### setDeviceMuted (address) (muted)
Mutes or unmutes the device and returns the new DEVICE_STATUS
- address: IP adress of the Google Cast device
- muted: true / false

#### getMediaStatus (address) (sessionId)
Returns the standard MEDIA_STATUS, JSON encoded. Can only be executed if something is loaded or playing on the device (sessionId must be set). Check for sessionId by using getDeviceStatus.
- address: IP adress of the Google Cast device
- sessionId: sessionId of the current active session