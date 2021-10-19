'use strict';

const Homey = require('homey');

/**
 * @hideconstructor
 */
class RFSignal {

  /**
   * @type {string}
   * @static
   */
  static ID = null;

  /**
   * @type {'433'|'868'|'ir'}
   * @static
   * */
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

    /**
     * @type {object}
     * @description The Signal's manifest
     */
    this.manifest = Homey.manifest.signals[this.constructor.FREQUENCY][this.constructor.ID];

    this.signal.on('payload', this.onRX);
    this.rxListeners = new Set();
  }


  /**
   * @param {Function} listener
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
   * @param {Function} listener
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
   * @param {string} command
   * @param {object} props
   * @returns {Promise<void>}
   */
  async tx(command, { ...props } = {}) {
    const payload = Buffer.isBuffer(command)
      ? command
      : this.constructor.commandToPayload(command);

    await this.signal.tx(payload, { ...props });
  }

  /**
   * @param {string} command
   * @param {object} props
   * @returns {Promise<void>}
   */
  async cmd(command, { ...props } = {}) {
    await this.signal.cmd(command, { ...props });
  }

  /**
   * @param payload
   * @param {boolean} isFirst
   * @returns {Promise<void>}
   */
  async onRX(payload, isFirst) {
    try {
      const command = this.constructor.payloadToCommand(payload);

      if (command === null || command === undefined) {
        throw new Error(`Command Not Found For Payload: ${payload}`);
      }

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
   * @param {object} props
   */
  static commandToPayload({ ...props }) {
    // Overload Me
  }

  /**
   * @param {object} props
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
   * @param {object} command
   */
  static commandToDeviceData(command) {
    // Overload Me
  }

}

module.exports = RFSignal;
