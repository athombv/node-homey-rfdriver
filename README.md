# Homey RFDriver

## Introduction
This module is used to make the creation of 433, 868 and Infrared apps easier.

It is essentially a map-tool from Homey-capabilities to signal payloads for 433/868/ir.

## Docs
See https://athombv.github.io/node-homey-rfdriver/

## Installation
```bash
npm install -g node-homey-config-composer
npm install homey-rfdriver
```

#### Homey Config Composer
To use Homey RFDriver you will need to make use of the Homey Config Composer. The Config Composer is a small tool which makes it possible to combine multiple config files into your app.json file. For instance you are able to put the configuration of each device into its own config file like so:
```
MyApp/
    config/
        drivers/
            MyDriver.js
            MyOtherDriver.js
        signals/
            433/
                TheSignal.json
        script.js
    app.json
```
You can use both `.js` and `.json` files for your config which makes you able to do some cool things like using a loop to generate multiple setting entries. However if you do not want to use the more advanced features of the Config Composer you only have to add the `scripts.js` file explained below.

#### The Script file
Homey RFDriver hooks into the Config Composer using the `script.js` file. To setup Homey RFDriver create the `config` folder in your project and add the `script.js` file with the content below:
```javascript
'use strict';

module.exports = require('homey-rfdriver/lib/scripts').run;
```
This will execute the RFDriver scripts every time you run `homeyConfig compose`.

## Usage
To make use of the features of RFDriver there are some keys that need to be added to your app.json config. The first addition is the `rf` property on drivers. The other key is the `rf_template` key that can be used just like the `template` property for pair views and will copy the template to the `pair` folder of the corresponding driver. After this file is copied you can change the settings of the template by opening it and editing the `options` variable in the template.

The following settings can be set:
```javascript
{
	id: "MyDevice",
    ...
    rf: {
        // Required: the id of the signal that this driver uses
        signal: 'MySignal',
        // Optional: the level for which logs should be printed in the console, can be 'silly'|'debug'|'verbose'|'info'|'warn'|'error'. Defaults to 'info'.
        logLevel: 'info'
        // Optional: the level for which logs should be send to sentry (if added to the app). Defaults to 'warn'
        captureLevel: 'warn'
        // Optional: the minimum time between signal repetitions to register multiple presses. Defaults to 500ms
        debounceTime: 1500,
        // Optional: the minimal amount of time between multiple repetitions of the same signal when send from Homey. Defaults to 0ms
        minTxInterval: 250,
        // Optional: the location/name of the device class file which is instantiated for device instances. Defaults to device.js.
        deviceClass: 'myDevice.js',
        // Optional: the location of a custom signal class file which will be used by the device instances. Defaults to the default Signal class of the RFDriver.
        signalClass: 'mySignal.js',
    }
    ...
    pair: [
    	{
            id: 'imitate', // The id of the template is optional when you set the rf_template. It will then default to the template name. 
                           // If this name is set differently from the template name you MUST change this in the template options
            rf_template: 'imitate',
        },
        {
            rf_template: 'test_switch',
        },
        {
            rf_template: 'done',
        }
    ]
}
```
Every time the config changes you will need to execute `homeyConfig compose` to ensure the changes are registered by the `RFDriver`.

When calling `homeyConfig compose` for the first time `RFDriver` will automatically create the driver folders in `drivers/` and will create the necessary files for your app. You will need to edit the `options` variable in every pair view that is generated and will need to implement some fucntions in the `device.js` file to make your app work. Documentation of the methods available in the `device.js` file and the `driver.js` file can be found /* TODO here */.

The initial files will contain the following: 

#### driver.js
```javascript
'use strict';

const Homey = require('homey');
const RFDriver = require('RFDriver');
// The util functions of RFDriver like util.payloadToBitString etc.
const util = RFDriver.util;

module.exports = class MyDriver extends RFDriver.Driver {

};
```

#### device.js
```javascript
'use strict';

const Homey = require('homey');
// The util functions of RFDriver like util.payloadToBitString etc.
const util = require('RFDriver').util;

// This file exports a function that receives the RFDevice class. You will need to return a class that extends the given class. You can do this by leaving the line below as this and only change "MyDevice" into a logical name for your app.
module.exports = RFDevice => class MyDevice extends RFDevice {

	// To use your driver you must implement the payloadToData and dataToPayload functions. These functions are static which means that you cannot use 'this' inside these functions!
    static payloadToData(payload) {   
        // e.g. the payload is as follows: 10101010010 
        // wich corresponds to the following data: { address: '1010101', key: '001' state: '0' }
        
        // check if the payload has the correct characteristics like length or checksum
        if (payload.length === 11) {
            const data = {
                address: util.payloadToBitString(payload.slice(0, 7)),
                key: util.payloadToBitString(payload.slice(7, 10)),
                state: payload[10],
            }
            // To make use of automatic capability updates set the capability value in the data object
            data.onoff = data.state === 1;
            // To make use of automatic id matching set data.id to a unique value for this device. Since this device is switching on the address + the key we set it to these values concatted
            data.id = data.address + '|' + data.key;
            return data;
        }
        // if the payload was invalid return null. This will cause the payload to be dropped by this device.
        return null;
    }
    
    static dataToPayload(data) {
    	// e.g. the data that Homey wants to send is the same as the received data above which was { address: '1010101', key: '001' state: '0', onoff: false, id: '1010101|001' }
        // When making use of the automatic capability updates dataToPayload will be fired with the capability key set to the new value when the capability is changed. Therefore you will need to translate that capability to the corresponding payload.
        
        // check if the data has the correct characteristics like required keys
        if(data.address && data.key && data.hasOwnProperty('onoff')){
            const address = util.bitStringToPayload(data.address);
            const key = util.bitStringToPayload(data.key);
            const state = data.onoff ? 1 : 0;
            
            return [].concat(address, key, state);
        }
        
        // if the data was invalid return null. Depending on why dataToPayload was called the app will crash or return an error to the user.
        return null;
    }
};

```