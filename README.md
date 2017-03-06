# cast-web-api
Quick and dirty Node.js web API for Google Cast enabled devices.

First of this is verry bad and experimental code, not intendend for any production environment!

Installation
------------

First you'll need to install the dependencies of this project, preferably via npm.
$npm install castv2, mdns, debug

Afterwards simply clone the repo to your prefered destination
```$git clone https://github.com/vervallsweg/cast-web-api.git```

By default the server runs on 127.0.0.1 port 3000. They can be adjusted by changing const hostname and port in line 1-2.

Now you can simply call the script and the web-api should be up and running!
```$node (yourdirectory)/castWebApi.js```

Usage
-----