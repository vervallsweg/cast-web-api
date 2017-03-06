# cast-web-api
Quick and dirty Node.js web API for Google Cast enabled devices.

First of this is **verry badly written and experimental code, not intendend for any production environment!**

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

#### /getDevices
Returns a JSON Array of devices found on the network
``` 
[
	[
		"device name",
		"IP",
		"port"
	],
	[
		...
	]

]
```