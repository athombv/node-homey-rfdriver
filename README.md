# Homey RFDriver

## Introduction
This module is used to make the creation of 433, 868 and Infrared apps easier.
RFDriver supplies a default driver and device class to map Homey-capabilities to 433/868/ir payloads.
On top of this RFDriver implements functionality that is common between many RF projects like pair wizard templates and flow cards. 

## Docs
See https://athombv.github.io/node-homey-rfdriver/

## Installation
RFDriver is added as an plugin in the latest version of the Athom-Cli. To get the latest version of the Athom-Cli run
```bash
npm install -g athom-cli
```
To start using RFDriver you can add it to your project through the "athom app create" wizard or by adding "rf" to your .homeyplugins.json file like this:
```json
# MyApp/.homeyplugins.json
[
    {
        "id": "rf"
    }
]
```

#### Homey Config Composer
Homey RFDriver makes use of the "compose" plugin also provided by Athom-Cli to copy files and configuration to your app.json and other project files. The composer plugin provides a way to compose your json config files and pair templates from the .homeycompose folder. For documentation on the composer you can visit the Athom-Cli github repo here: https://github.com/athombv/node-athom-cli.

## Usage
RFDriver can be configured on Driver basis by adding configuration to the "rf" property in your driver json config.
The following options are available for the "rf" config property:
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
        // Optional: the minimum time between signal repetitions to trigger a press event. Defaults to 500ms
        debounceTime: 500,
        // Optional: the minimum amount of time Homey waits between sending signals from Homey. Defaults to 0ms
        minTxInterval: 250,
        // Optional: if onoff should be set to true when a dim value is send. Defaults to true
        syncOnOffOnDim: true,
        // The next few options are used for signals which use the cmds property of the signal object to send signals
        // Optional: the cmdType prefix for this device. This prefix is the start of the command id and seperated from the id part of the command by "$~" (e.g. tv$~turn_on). Commands containing a cmdType only trigger the command part for the devices that have the same cmdType value (e.g. beamer$~turn_on will not trigger the turn_on command of a device with cmdType "tv"). Lastly, commands without a cmdType trigger the commands all devices regardless of cmdType (e.g. turn_on will trigger turn_on for a device with cmdType "tv" and a device with cmdType "beamer"). cmdType (and cmdSubType) can be set dynamically by adding "cmdType" to your device settings.
        "cmdType": "tv",
        // Optional: the cmdSubType suffix for this device. This suffix is the end of the command id seperated from the id part of the command by "~$" (e.g. turn_on~$new_models). cmdSubType works like cmdType but can be used to nest commands one layer deeper. For instance, you can use cmdSubType to differentiate a few signals for some models e.g. you can add tv$~turn_on~$new_models to your signal when tv$~turn_on does not work for new models of the tv but other signals do still work. Another usecase is to offer more signals e.g. tv$~3d$~new_models.
        "cmdSubType": "cmdSubType",
        // Optional: the capabilityToCommandMap can be used to automagically send the right command when a Homey capability is changed. The structure of the command map is { [capabilityId]: { [capabilityValue]: [cmdWhichShouldBeSend] } }. When the capabilityValue is called "toggle" RFDriver will assume the capability is boolean and send the command when the boolean value changed. When the capability is defined like { [capabilityId]: [cmdWhichShouldBeSend] } RFDriver sends the command regardless of the value. This configuration should be used when the capability is set only like a button press
        "capabilityToCommandMap": {
            "onoff": {
                "true": "power_on",
                "toggle": "onoff"
            },
            "volume_mute": {
                "toggle": "mute"
            },
            "volume_up": "volume_up",
            "volume_down": "volume_down",
            "channel_up": "channel_up",
            "channel_down": "channel_down"
        }
        // Optional: the commandToCapabilityMap is generated from your capabilityToCommandMap but could be set to override the generated map. This map is used by RFDriver to call this.setCapabilityValue when a command is received by Homey (or send through a Homey flow). The map is defined like { [cmdIdReceived]: [ { "capability": [capabilityId], "value": [capabilityValue] } ] }. When the capabilityValue is "toggle" RFDriver will assume the capability is boolean and toggle the value of the boolean.
        "commandToCapabilityMap": {
            "power_on": [{"capability": "onoff", "value": true}],
            "onoff": [{"capability": "onoff", "value": "toggle"}],
        }
        // Optional: the location/name of the device class file which is instantiated for device instances. Defaults to device.js.
        deviceClass: 'myDevice.js',
        // Optional: the location of a custom signal class file which will be used by the device instances. Defaults to the default Signal class of the RFDriver.
        signalClass: 'mySignal.js',
    }
}
```
Every time the config changes you will need to execute `athom app build` or `athom app run` to ensure the changes are committed to your app.json file.

To add a driver using RFDriver you can use `athom app driver create`. This will automatically create the driver folders in `drivers/` and will create the necessary files for your app. Documentation of the methods available in the `device.js` file and the `driver.js` file can be found here: https://athombv.github.io/node-homey-rfdriver/.

The initial files will contain the following: 

#### driver.js
```javascript
'use strict';

const Homey = require('homey');
const RFDriver = require('RFDriver');
// The util functions of RFDriver like util.payloadToBitString etc.
const util = RFDriver.util;

module.exports = class MyDriver extends RFDriver.Driver {
    onRFInit(){
        super.onRFInit();

        // Init your driver here
    }
};
```

#### device.js
```javascript
'use strict';

const Homey = require('homey');
// The util functions of RFDriver like util.payloadToBitString etc.
const util = require('RFDriver').util;

// To extend from another class change the line below to
// module.exports = RFDevice => class /*<DRIVER_ID>*/Device extends MyGenericDevice(RFDevice) {
// and define MyGenericDevice like so
// module.exports = RFDevice => class MyGenericDevice extends RFDevice {
module.exports = RFDevice => class MyDevice extends RFDevice {
    onRFInit() {
        super.onRFInit();
        
        // Init your device here
    }
    
    // If your driver handles raw payload requests instead of commands you need to implement the payloadToData function below. This function is "static" which means that you cannot use 'this' inside this function!
    static payloadToData(payload) {   
        // e.g. the payload is as follows: 101010100000010 
        // wich corresponds to the following data: { address: '1010101000', unit: '0001' onoff: false }
        
        // check if the payload has the correct characteristics like length or checksum
        if (payload.length === 15) {
            const data = {
                address: util.bitArrayToString(payload.slice(0, 10)),
                unit: util.bitArrayToString(payload.slice(10, 14)),
                // A device capability id like onoff in the data object will automatically call this.setCapabilityValue.
                onoff: payload[14] === 1,
            };
            // RFDriver requires an id property in the data object by default. This should be unique for every device instance.
            // This id property is used by RFDriver to match incoming payloads to devices. Since this device is listening to the address + unit of the remote we concat both values to create an unique id for this device.
            data.id = data.address + data.unit;
            return data;
        }
        // if the payload was invalid return null. This will cause the payload to be dropped by this device.
        return null;
    }
    
    // If your driver handles raw payload requests instead of commands you need to implement the dataToPayload function below
    static dataToPayload(data) {
    	// e.g. the data that Homey wants to send is the same as the received data above which was { address: '1010101000', key: '0001', onoff: true, id: '1010101000|0001' }
        // When making use of the automatic capability updates dataToPayload will be fired with the capability key set to the new value when the capability is changed. Therefore you will need to translate that capability to the corresponding payload.
        
        // check if the data has the correct characteristics like required keys
        if (data.address && data.unit) {
            return [].concat(
                util.bitStringToBitArray(data.address),
                util.bitStringToBitArray(data.unit),
                // The default capabilityListener will send an object with the capability key set to its new value e.g. { onoff: true }
                data.onoff ? 1 : 0
            );
        }
        
        // if the data was invalid return null. Depending on why dataToPayload was called the app will crash or return an error to the user.
        return null;
    }
    
    // If your driver uses the rf.program, rf.codewheel or rf.dipswitch pair template you need to implement the generateData function below
    static generateData() {
        const data = {
            address: util.generateRandomBitString(10),
            unit: util.generateRandomBitString(4),
            onoff: true,
        };
        data.id = data.address + data.unit;
        return data;
    }
};
```

## Pair templates
RFdriver copies a variety of generic pair templates to your .homeycompose folder. You can use these pair templates by adding the name of the template folder to the pair array in your driver on the `$template` key. Options for the pair templates can be found inside the template.html and overwritten by adding them to the `options` property of the pair template entry. An example config is shown below:
```json
{
    ...
    "pair": [
        {
            "$template": "rf.imitate",
            "id": "rf.imitate",
            "options": {
                "title": "rf.pair.imitate.title.wall_switch",
                "body": "rf.pair.imitate.body.wall_switch"
            },
            "navigation": {
                "next": "rf.test_remote"
            }
        },
        {
            "$template": "rf.test_remote",
            "id": "rf.test_remote",
            "options": {
                "title": "rf.pair.test.title.wall_switch",
                "body": "rf.pair.test.body.wall_switch"
            },
            "navigation": {
                "prev": "rf.imitate",
                "next": "rf.done"
            }
        },
        {
            "$template": "rf.done",
            "id": "rf.done"
        }
    ]
}
```

## Driver Templates
RFDriver also copies a range of default device config templates. These templates can be used as a starting point to build new drivers with. You can your driver with a RFDriver config by adding it to the `$extends` key in your device.composer.json file (in your driver folder). To edit pair view options of pair views defined in a device config template you can use the `$pairOptions` key. This will override the `options` key of the pair template with the `$pairOptions.templateId` object.
```json
{
    "$extends": [ "rf.ir_remote", "philips", "rc5" ],
    "name": {
        "en": "Philips TV Remote",
        "nl": "Philips TV Afstandsbediening"
    },
    "icon": "./drivers/old_tv/assets/icon.svg",
    "images": {
        "small": "./drivers/old_tv/assets/images/small.jpg",
        "large": "./drivers/old_tv/assets/images/large.jpg"
    },
    "$pairOptions": {
        "rf.done": {
            "title": "myremote.pair.done.addedtitle"
        }
    }
}
```

## Default flows
Some default flows are checked by RFDriver and when they exist default logic for the flows will be triggered. Default flows are detected by the driver id followed by their id with a ':' as seperator. The following flow logic is included in RFDriver:
##### received
Compares the arguments of this card with the data object that was received. When the keys match the flow is triggered
```
"triggers": [
    {
        "id": "SF-501R:received",
        "title": {
            "en": "Button is pressed",
            "nl": "Knop is ingedrukt"
        },
        "args": [
            {
                "name": "unit",
                "type": "dropdown",
                "values": [
                    {
                        "id": "01",
                        "label": {
                            "en": "Button A",
                            "nl": "Knop A"
                        }
                    },
                    {
                        "id": "10",
                        "label": {
                            "en": "Button B",
                            "nl": "Knop B"
                        }
                    }
                ]
            },
            {
                "name": "onoff",
                "type": "dropdown",
                "values": [
                    {
                        "id": true,
                        "label": {
                            "en": "On",
                            "nl": "Aan"
                        }
                    },
                    {
                        "id": false,
                        "label": {
                            "en": "Off",
                            "nl": "Uit"
                        }
                    }
                ]
            },
            {
                "name": "device",
                "type": "device",
                "filter": "driver_id=SF-501R"
            }
        ]
    }
]
```
##### cmd_received
Compares the cmd argument to a received command id. When the cmd argument has the type "autocomplete" RFDriver will supply a list with all commands available for that device.
```
"triggers": [
    {
        "id": "new_tv:cmd_received",
        "title": {
            "en": "Button is Pressed",
            "nl": "Knop is Ingedrukt"
        },
        "args": [
            {
                "name": "cmd",
                "type": "autocomplete"
            },
            {
                "type": "device",
                "name": "device",
                "filter": "driver_id=new_tv"
            }
        ]
    }
]
```
##### send
Sends the args object when the flow card is triggered.
```
"actions": [
    {
        "id": "FA21RF:send",
        "title": {
            "en": "Test the smoke sensor",
            "nl": "Test de rookmelder"
        },
        "args": [
            {
                "name": "onoff",
                "type": "dropdown",
                "values": [
                    {
                        "id": true,
                        "label": {
                            "en": "On",
                            "nl": "Aan"
                        }
                    },
                    {
                        "id": false,
                        "label": {
                            "en": "Off",
                            "nl": "Uit"
                        }
                    }
                ]
            },
            {
                "name": "device",
                "type": "device",
                "filter": "driver_id=FA21RF"
            }
        ]
    }
]
```

you can skip loading the default behavior by overwriting the initDefaultFlows function in your driver.js file and calling the super function with a array with flowcard ids that should be skipped.
```javascript 
...
initDefaultFlows(){
    super.initDefaultFlows(['cmd_received']);
}
```