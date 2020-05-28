# Homey RFDriver

This module helps developers create RF (433MHz, 868MHz, Infrared) apps for Homey.

## Installation

```bash
$ homey app plugin add
```

Then select `rf`.

## Requirements

This module requires Homey Apps SDK v3.

## Usage

Both your driver and device should extend RFDriver and RFDevice. RFDriver should then reference another class that extends RFSignal.

A typical app might have these files:

```
/.homeycompose/signals/433/my_signal.json
/lib/MySignal.js (extends RFSignal)
/drivers/my_driver/driver.js (extends RFDriver)
/drivers/my_driver/device.js (extends RFDevice)
/drivers/my_driver/pair/rf_receiver_learn.html
/drivers/my_driver/pair/rf_receiver_add.html
/drivers/my_driver/pair/image.svg
```

Your driver can be either a *transmitter* (e.g. a remote) or a *receiver* (e.g. a light or socket switch).

You should copy the corresponding files from this module's `/pair` folder to your driver's `/pair` folder.

### RFSignal

Imagine we have a simple 433 MHz protocol that first sends the address (1 byte) and then the on/off state (1 byte, `0x00` for off, `0xFF` for on).

Our signal definition must be added to `/.homeycompose/signals/433/my_signal.json`. Refer to the [Signal Documentation](https://apps.developer.athom.com/tutorial-Signals.html) for more information on how to create a signal.

Your JSON describes how to encode and decode the low & high signals into bits.
The RFSignal you define here will parse these bits (or bytes) from and to JavaScript objects.

`/lib/my_signal.js`

```javascript
'use strict';

const { RFSignal, RFError, RFUtil } = require('homey-rfdriver');

// Protocol:
// [ 0x00 - 0xFF, 0x00 | 0xFF ]
// [ address    , state       ]

module.exports = class extends RFSignal {

  static FREQUENCY = '433';
  static ID = 'my_signal';

  // This method converts a JavaScript object command
  // into a payload for our signal.
  static commandToPayload({ address, state }) {
    if( typeof address !== 'number' )
      throw new RFError('Invalid Address');

    if( typeof state !== 'boolean' )
      throw new RFError('Invalid State');
      
    return [ address, state ? 0x00 : 0xFF ];
  }

  // This method converts a received payload
  // into a JavaScript object command.
  static payloadToCommand(payload) {
    const address = Number(payload[0]);
    const state = Boolean(payload[1]);
    return { address, state };
  }

  // This method takes a command object
  // and returns a device-unique data object
  static commandToDeviceData(command) {
    return {
      address: command.address,
    };
  }

  // This method is invoked when a new receiver is added
  // We can generate a random address, as if someone pressed
  // the button on a remote.
  static createPairCommand() {
    return {
      address: Math.round(Math.random() * 255),
      state: true,
    };
  }

}
```

### RFDriver

`/drivers/my_driver/driver.js`

```javascript
const { RFDriver } = require('homey-rfdriver');
const MySignal = require('../../lib/MySignal');

module.exports = class extends RFDriver {

  static SIGNAL = MySignal;

}
```

#### Transmitter

Copy `/pair/rf_transmitter_learn.html` to your driver's `/pair` folder. 

Then add this to your `/drivers/<driver_id>/driver.compose.json`:

```json
"pair": [
  {
    "id": "rf_transmitter_learn",
    "options": {
      "title": {
        "en": "Press any button"
      },
      "instruction": {
        "en": "Press any button on your device."
      }
    }
  }
]
```

#### Receiver

Copy `/pair/rf_receiver_learn.html` and `/pair/rf_receiver_add.html` to your driver's `/pair` folder. 

Then add this to your `/drivers/<driver_id>/driver.compose.json`:

```json
"pair": [
  {
    "id": "rf_receiver_learn",
    "navigation": {
      "next": "rf_receiver_add"
    },
    "options": {
      "title": {
        "en": "Press the button..."
      },
      "instruction": {
        "en": "Press the button on your device once."
      }
    }
  },
  {
    "id": "rf_receiver_add",
    "options": {
      "instruction": {
        "en": "Did the device turn off and on?"
      }
    }
  }
]
```

#### IR Remote

Copy `/pair/rf_ir_remote_learn.html` and `/pair/rf_ir_remote_add` to your driver's `/pair` folder. 

Then add this to your `/drivers/<driver_id>/driver.compose.json`:

```json
"pair": [
  {
    "id": "rf_ir_remote_learn",
    "navigation": {
      "next": "rf_ir_remote_add"
    },
    "options": {
      "title": {
        "en": "Pair your IR remote",
        "nl": "Koppel je IR afstandsbediening"
      },
      "instruction": {
        "en": "Press next to pair your remote.",
        "nl": "Druk op volgende om je afstandsbediening te koppelen."
      }
    }
  },{
    "id": "rf_ir_remote_add"
  }
]
```

### RFDevice

`/drivers/my_driver/device.js`

```javascript
const { RFDevice } = require('homey-rfdriver');

module.exports = class extends RFDriver {

  static RX_ENABLED = false; // Set to true for transmitter devices

  static CAPABILITIES = {

    // When the onoff capability is changed by the user,
    // you can assemble a command here.
    // 'data' is your device's data object
    onoff: ({ value, data }) => ({
      address: data.address,
      state: value === true,
    }),
  };

}
```