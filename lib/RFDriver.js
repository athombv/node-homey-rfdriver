/* eslint-disable max-len */

'use strict';

const Homey = require('homey');
const RFSignal = require('./RFSignal');
const RFUtil = require('./RFUtil');

const sRF = Symbol('RF');

module.exports = class RFDriver extends Homey.Driver {

  static SIGNAL = null;

  async onInit() {
    this[sRF] = {};
    this[sRF].signal = await this.getRFSignal();
    this[sRF].rxEnabledDevices = new Set();

    this.manifest = this.manifest || this.getManifest();
    this[sRF].name = this.homey.__(this.manifest.name);

    await this.onRFInit();
  }

  async onRFInit() {
    // Overload Me
  }

  async getRFSignal() {
    const { homey } = this;
    const Signal = this.constructor.SIGNAL;

    if (!(Signal.prototype instanceof RFSignal)) {
      throw new Error('Signal class does not extend RFSignal');
    }

    this.homey.app[sRF] = this.homey.app[sRF] || {};
    this.homey.app[sRF].signals = this.homey.app[sRF].signals || {};
    this.homey.app[sRF].signals[Signal.TYPE] = this.homey.app[sRF].signals[Signal.TYPE] || {};
    this.homey.app[sRF].signals[Signal.TYPE][Signal.ID] = this.homey.app[sRF].signals[Signal.TYPE][Signal.ID] || new Signal({ homey });

    return this.homey.app[sRF].signals[Signal.TYPE][Signal.ID];
  }

  async enableRX(listener) {
    await this[sRF].signal.registerRXListener(listener);
  }

  async disableRX(listener) {
    await this[sRF].signal.unregisterRXListener(listener);
  }

  async tx(command, { ...props } = {}) {
    const signal = await this.getRFSignal();
    await signal.tx(command, { ...props });
  }

  async onPair(session) {
    session.setHandler('showView', async viewId => {
      switch (viewId) {
        case 'rf_receiver_learn': {
          await this.onPairRFReceiverLearn(session);
          break;
        }
        case 'rf_transmitter_learn': {
          await this.onPairRFTransmitter(session);
          break;
        }
        case 'rf_ir_remote_add': {
          await this.onPairIRRemoteAdd(session);
          break;
        }
        default: {
          // Do Nothing
        }
      }
    });
  }

  async onPairRFReceiverLearn(session) {
    const signal = await this.getRFSignal();
    const command = signal.constructor.createPairCommand();

    session.setHandler('tx', async () => {
      await signal.tx(command);
    });

    session.setHandler('createDevice', async () => {
      return {
        name: this[sRF].name,
        data: {
          uuid: RFUtil.generateUUIDv4(),
          ...signal.constructor.commandToDeviceData(command),
        },
      };
    });
  }

  async onPairRFTransmitter(session) {
    let done = false;

    const signal = await this.getRFSignal();
    const listener = async (command, { isFirst }) => {
      if (!isFirst) return;
      if (done) return;

      await session.emit('createDevice', {
        name: this[sRF].name,
        data: {
          uuid: RFUtil.generateUUIDv4(),
          ...signal.constructor.commandToDeviceData(command),
        },
      });

      done = true;
    };

    await signal.registerRXListener(listener);

    session.setHandler('disconnect', async () => {
      await signal.unregisterRXListener(listener);
    });
  }

  // Since IR remotes don't have any unique data to identify them, use a uuid v4 as device data.
  async onPairIRRemoteAdd(session) {
    await session.emit('createDevice', {
      name: this[sRF].name,
      data: {
        uuid: RFUtil.generateUUIDv4(),
      },
    });
  }

};
