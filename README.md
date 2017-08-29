# cast-web-api
Quick and dirty Node.js web API for Google Cast enabled devices.

This simple web API is based on the awesome [node-castv2](https://github.com/thibauts/node-castv2 "node-castv2") implementation by thibauts.

However my code is **verry badly written and experimental, not intendend for any production environment!**

## Installation

First you'll need to install the dependencies of this project, preferably via npm.

    $ npm install castv2 castv2-client debug http url minimist mdns-js node-fetch

Afterwards clone the repo to your prefered destination

    $ git clone https://github.com/vervallsweg/cast-web-api.git

Now you can simply call the script and the web-api should be up and running!

    $ node (yourdirectory)/castWebApi.js

By default the server runs on localhost:3000. They can be adjusted with the --hostname --port arguments:

	$ node (yourdirectory)/castWebApi.js --hostname=192.168.0.11 --port=8080

If you'd like to run the API in the background as a daemon [forever](https://github.com/foreverjs/forever "forever") is recommended

	$ npm install forever -g

Running the script and setting the parameters is mostly unchanged:

	$ forever start castWebApi.js
	$ forever stop castWebApi.js

## Usage

### Protocol
Everything is HTTP GET. All parameters are part of the URL, no need for POST, etc.

### Request URLs

Request URLs are formated like this:

    http://{hostname}:{port}/{request}?{parameter}={parameter_value}

Example URL for setting the volume to 50%:

    http://127.0.0.1:3000/setDeviceVolume?address=192.168.86.86&volume=0.5

None of the parameters has to be put in '' or anything like that. Just paste it in.

#### getDevices
Returns a JSON Array of devices found on the network. Recent changes make installation easier but *device discovery [unreliable](https://github.com/vervallsweg/cast-web-api/issues/35 "unreliable") sometimes*.
``` 
[
	[
		"deviceName": "Chromecast-...",
		"deviceFriendlyName": "Living room",
		"deviceAddress": "192.168.0.12",
		"devicePort": 8009
	],
	[
		...
	]

]
```

    http://{host}/getDevices


#### getDeviceStatus (address)
**Returns DEVICE_STATUS,**

which is JSON encoded and part of the Google Cast protocol.
- address: IP adress:port of the Google Cast device, if no port is provided 8009 is assumed

    http://{host}/getDeviceStatus?address={address}


#### setDeviceVolume (address) (volume) 
**Returns DEVICE_STATUS,**

and sets the device volume. The return value reflects the state of the device after the command was executed.
- address: IP adress of the Google Cast device
- volume: Float value from 0-1 (0.1=10%, 0.2=20%, ...)


    http://{host}/setDeviceVolume?address={address}&volume={volume}


#### setDeviceMuted (address) (muted)
**Returns DEVICE_STATUS,**

and mutes or unmutes the device.
- address: IP adress of the Google Cast device
- muted: true / false


    http://{host}/setDeviceMuted?address={address}&muted={muted}


#### getMediaStatus (address) (sessionId)
**Returns MEDIA_STATUS,**

which is JSON encoded and part of the cast protocol as well. 
Can **only** be executed if something is loaded or playing on the device (sessionId must be set). Check for sessionId by using getDeviceStatus.
- address: IP adress of the Google Cast device
- sessionId: sessionId of the current active session


    http://{host}/getMediaStatus?address={address}&sessionId={sessionId}


#### setMediaPlaybackPause (address) (sessionId) (mediaSessionId)
**Returns MEDIA_STATUS,**

and pauses currently playing media. mediaSessionId is included in getMediaStatus.
- address: IP adress of the Google Cast device
- sessionId: sessionId of the current active session
- mediaSessionId: int


    http://{host}/setMediaPlaybackPause?address={address}&sessionId={sessionId}&mediaSessionId={mediaSessionId}


#### setMediaPlaybackPlay (address) (sessionId) (mediaSessionId)
**Returns MEDIA_STATUS,**

and plays currently loaded media.
- address: IP adress of the Google Cast device
- sessionId: sessionId of the current active session
- mediaSessionId: int


    http://{host}/setMediaPlaybackPlay?address={address}&sessionId={sessionId}&mediaSessionId={mediaSessionId}


#### setDevicePlaybackStop (address) (sessionId)
**Returns DEVICE_STATUS, *not* MEDIA_STATUS,**

and stops casting to the device, kills currently running session. 
- address: IP adress of the Google Cast device
- sessionId: sessionId of the current active session


    http://{host}/setDevicePlaybackStop?address={address}&sessionId={sessionId}


#### setMediaPlayback (address, mediaType, mediaUrl, mediaStreamType, mediaTitle, mediaSubtitle, mediaImageUrl)
**Returns MEDIA_STATUS,**

after playback of your custom media has started. For this it uses Google's [default media receiver](https://developers.google.com/cast/docs/receiver_apps#default "Default Media Receiver"). If you don't know what this is please **read the documentation first**, it is linked above and below. Remember, always check device compatibility (formats, screen available) before casting your media to a device! Oh and don't forget to url encode paramaters if necessary, the server will decode them.
- address: IP adress of the Google Cast device
- mediaType: the Google Cast media type string, see: [supported media](https://developers.google.com/cast/docs/media#media-type-strings "supported media"). Don't just use mp3 or mp4, the correct string from the doc is needed (e.g. audio/mp3).
- mediaUrl: HTTP(S) url to your content
- mediaStreamType: Kind of stream - [streamType](https://developers.google.com/cast/docs/reference/messages#MediaInformation "streamType")
- mediaTitle (->title), mediaSubtitle(->subtitle), mediaImageUrl(->images[0]): see [generic media metadata](https://developers.google.com/cast/docs/reference/messages#GenericMediaMetadata "generic media metadata")


    http://{host}/setMediaPlayback?address={address}&mediaType={mediaType}&mediaUrl={mediaUrl}&mediaStreamType={mediaStreamType}&mediaTitle={mediaTitle}&mediaSubtitle={mediaSubtitle}&mediaImageUrl={mediaImageUrl}


#### config
See [server settings](https://github.com/vervallsweg/cast-web-api/#server-settings "server settings")

### HTTP response codes
The server will return an HTTP status code so you can quickly determin if the request was successful or not
- 200: Successful communication with your Google Cast device requested JSON data is returned
- 400: Parameters missing or in the wrong format, returns 'Parameter error'
- 404: Requested URL doesn't match any function, returns 'Not found'
- 500: Comunication with Cast device failed, enable debuging to check for possible errors

## Server settings
Basic settings can be set and read using the config request url or the corresponding command line argument. Server hostname and port can only be set from the command line (see: [Installation](https://github.com/vervallsweg/cast-web-api/#installation "Installation")). The requestUrl only supports setting one parameter at a time, multiple parameters will be ignored.

### Usage

    http://{hostname}/comfig?get={parameter}


    http://{hostname}/comfig?set={parameter}&value={value}

Every successful get/set options returns a simple JSON with response: ok and the parameter value.

    {"response": "ok", "networkTimeout": 2000}


### Modes
Get, returns the parameter's value. Set, sets it to the specified value and returns the updated value.

### Parameters
#### networkTimeout (ms) [2000]
Sets the time for the server to wait for an answer from the cast device. By default it is set to 2000ms (2s). If a response is received by the API earlier than the timeout, it will be returned immediately.

#### appLoadTimeout (ms) [5000]
Time for the server to wait untill your custom media is `PLAYING`. Depends on media type, size, network and device performance. **Especially groups can take longer than 5s to start playback**, adjust timeout accordingly.

#### currenRequestId (ms) [1]
The Cast protocoll requires a requestId for each request made to a device. The API creates a unique requestId for each request by incrementing the initial value: currentRequestId.

## Debugging
cast-web-js uses npm's debug package. Debugging can be enabled with the following command:

    $ DEBUG=cast-web-api node (yourdirectory)/castWebApi.js

If you require further information you can enable debugging for the underlying castv2 module. You can either set the scope to castv2 or to everything *:

    $ DEBUG=* node (yourdirectory)/castWebApi.js

## Further information
[thibauts](https://github.com/thibauts "thibauts profile") wrote a great [protocol description](https://github.com/thibauts/node-castv2#protocol-description "protocol description"). I can only highly recommend reading it.

If you read the first sentences of this file it goes without saying that you **should not** run this API on the internet. Run it behind a firewall only in your local network!

If you find a bug or typo, feel free to contact me, open an issue, fork it, fix it yourself and open a pull request, you name it.