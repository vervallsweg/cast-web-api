# MDNS installation

## MAC OS X
You're good to go, everything is already installed!

## Linux
The node-mdns package requires the avahi dns_sd compat library and headers. On most distributions the package name is libavahi-compat-libdnssd-dev that obviously depends on your distribution.

	$ [sudo] apt-get install libavahi-compat-libdnssd-dev

That should work on most distributions.

## Windows
Either download Bonjour, which should be included in Apple iTunes, or download the [Bonjour SDK for Windows](http://www.softpedia.com/get/Programming/SDK-DDK/Bonjour-SDK.shtml#download "Bonjour SDK for Windows").
Also required are [Python 2.X](https://www.python.org/downloads/release/python-2713/ "Python 2.X") (2.5>3.0) and a 
Microsoft C++ Compiler. If you have neither of the two installed simply open an administrative shell and run:

	npm install -g windows-build-tools