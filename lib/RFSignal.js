'use strict';

module.exports = class RFSignal {

  static ID = null;
  static FREQUENCY = null;

  constructor({ homey }) {
    this.onRX = this.onRX.bind(this);

    switch (this.constructor.FREQUENCY) {
      case '433': {
        this.signal = homey.rf.getSignal433(this.constructor.ID);
        break;
      }
      case '868': {
        this.signal = homey.rf.getSignal868(this.constructor.ID);
        break;
      }
      case 'ir': {
        this.signal = homey.rf.getSignalIR(this.constructor.ID);
        break;
      }
      default:
        throw new Error(`Invalid Signal Frequency: ${this.constructor.FREQUENCY}`);
    }

    this.signal.on('payload', this.onRX);
    this.rxListeners = new Set();
  }

  async registerRXListener(listener) {
    if (this.rxListeners.has(listener)) return;
    this.rxListeners.add(listener);

    if (this.rxListeners.size === 1) {
      await this.signal.enableRX();
    }
  }

  async unregisterRXListener(listener) {
    if (!this.rxListeners.has(listener)) return;
    this.rxListeners.delete(listener);

    if (this.rxListeners.size === 0) {
      await this.signal.disableRX();
    }
  }

  async tx(command, { } = {}) {
    const payload = Buffer.isBuffer(command)
      ? command
      : this.constructor.commandToPayload(command);

    await this.signal.tx(payload, {});
  }

  async onRX(payload, isFirst) {
    try {
      const command = this.constructor.payloadToCommand(payload);
      for (const listener of this.rxListeners) {
        Promise.resolve().then(async () => {
          await listener.call(listener, command, { isFirst });
        }).catch(console.error);
      }
    } catch (err) {
      console.error(err);
    }
  }

  static commandToPayload({ }) {
    // Overload Me
  }

  static payloadToCommand(payload) {
    // Overload Me
  }

  static createPairCommand() {
    // Overload Me
  }

  static commandToDeviceData(command) {
    // Overload Me
  }

}