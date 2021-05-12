'use strict';

/**
 */
class RFSignal {

  /** @type {null} */
  static ID = null;
  /** @type {null} */
  static FREQUENCY = null;

  /**
   * @param {Homey} homey
   */
  constructor({ homey }) {
    this.homey = homey;
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
        this.signal = homey.rf.getSignalInfrared(this.constructor.ID);
        break;
      }
      default:
        throw new Error(`Invalid Signal Frequency: ${this.constructor.FREQUENCY}`);
    }

    this.signal.on('payload', this.onRX);
    this.rxListeners = new Set();
  }

  /**
   * @param listener
   * @returns {Promise<void>}
   */
  async registerRXListener(listener) {
    if (this.rxListeners.has(listener)) return;
    this.rxListeners.add(listener);

    if (this.rxListeners.size === 1) {
      await this.signal.enableRX();
    }
  }

  /**
   * @param listener
   * @returns {Promise<void>}
   */
  async unregisterRXListener(listener) {
    if (!this.rxListeners.has(listener)) return;
    this.rxListeners.delete(listener);

    if (this.rxListeners.size === 0) {
      await this.signal.disableRX();
    }
  }

  /**
   * @param command
   * @param props
   * @returns {Promise<void>}
   */
  async tx(command, { ...props } = {}) {
    const payload = Buffer.isBuffer(command)
      ? command
      : this.constructor.commandToPayload(command);

    await this.signal.tx(payload, { ...props });
  }

  /**
   * @param command
   * @param props
   * @returns {Promise<void>}
   */
  async cmd(command, { ...props } = {}) {
    await this.signal.cmd(command, { ...props });
  }

  /**
   * @param payload
   * @param isFirst
   * @returns {Promise<void>}
   */
  async onRX(payload, isFirst) {
    try {
      const command = this.constructor.payloadToCommand(payload);
      for (const listener of this.rxListeners) {
        Promise.resolve().then(async () => {
          await listener.call(listener, command, { isFirst });
        }).catch(this.homey.app.error);
      }
    } catch (err) {
      this.homey.app.error(err);
    }
  }

  /**
   * @param props
   */
  static commandToPayload({ ...props }) {
    // Overload Me
  }

  /**
   * @param payload
   */
  static payloadToCommand(payload) {
    // Overload Me
  }

  /**
   */
  static createPairCommand() {
    // Overload Me
  }

  /**
   * @param command
   */
  static commandToDeviceData(command) {
    // Overload Me
  }

}

module.exports = RFSignal;
