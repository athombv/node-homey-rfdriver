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

    const { name } = this.getManifest();
    this[sRF].name = this.homey.__(name);

    await this.onRFInit();
  }

  async onRFInit() {
    // Overload Me
  }

  async getRFSignal() {
    const homey = this.homey;
    const Signal = this.constructor.SIGNAL;

    if (!(Signal.prototype instanceof RFSignal))
      throw new Error('Signal class does not extend RFSignal');

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

  async tx(command, { } = {}) {
    const signal = await this.getRFSignal();
    await signal.tx(command, {});
  }

  async onPair(session) {
    session.registerHandler('showView', async viewId => {
      if (viewId === 'rf_receiver_learn') return this.onPairRFReceiverLearn(session);
      if (viewId === 'rf_transmitter') return this.onPairRFTransmitter(session);
    });
  }

  async onPairRFReceiverLearn(session) {
    const signal = await this.getRFSignal();
    const command = signal.constructor.createPairCommand();

    session.registerHandler('tx', async () => {
      await signal.tx(command);
    });

    session.registerHandler('createDevice', async () => {
      return {
        name: this[sRF].name,
        data: signal.constructor.commandToDeviceData(command),
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
        data: signal.constructor.commandToDeviceData(command),
      });

      done = true;
    };

    await signal.registerRXListener(listener);

    session.registerHandler('disconnect', async () => {
      await signal.unregisterRXListener(listener);
    });
  }

}