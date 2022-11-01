/* eslint-disable max-len */

'use strict';

const Homey = require('homey');
const RFSignal = require('./RFSignal');
const RFUtil = require('./RFUtil');

const sRF = Symbol('RF');

/**
 * @extends Homey.Driver
 * @hideconstructor
 */
class RFDriver extends Homey.Driver {

  /** @type {RFSignal} */
  static SIGNAL = null;

  /**
   * Do not use this method, but use {@link RFDriver#onRFInit} instead.
   * @returns {Promise<void>}
   */
  async onInit() {
    this[sRF] = {};
    this[sRF].signal = await this.getRFSignal();
    this[sRF].rxEnabledDevices = new Set();

    this.manifest = this.manifest || this.getManifest();
    this[sRF].name = this.homey.__(this.manifest.name);

    await this.onRFInit();
  }

  /**
   * @returns {Promise<void>}
   */
  async onRFInit() {
    // Overload Me
  }

  async onUninit() {
    await this.onRFUninit();
  }

  /**
   * @returns {Promise<void>}
   */
  async onRFUninit() {
    // Overload Me
  }

  /**
   * @returns {Promise<*>}
   */
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

  /**
   * @param listener
   * @returns {Promise<void>}
   */
  async enableRX(listener) {
    await this[sRF].signal.registerRXListener(listener);
  }

  /**
   * @param listener
   * @returns {Promise<void>}
   */
  async disableRX(listener) {
    await this[sRF].signal.unregisterRXListener(listener);
  }

  /**
   * @param command
   * @param {object} props
   * @returns {Promise<void>}
   */
  async cmd(command, { ...props } = {}) {
    const signal = await this.getRFSignal();
    await signal.cmd(command, { ...props });
  }

  /**
   * @param payload
   * @param {object} props
   * @returns {Promise<void>}
   */
  async tx(payload, { ...props } = {}) {
    const signal = await this.getRFSignal();
    await signal.tx(payload, { ...props });
  }

  /**
   * @param {Session} session
   * @returns {Promise<void>}
   */
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

  /**
   * @param {Session} session
   * @returns {Promise<void>}
   */
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
          copiedFromRemote: false,
        },
      };
    });
  }

  /**
   * @param {Session} session
   * @returns {Promise<void>}
   */
  async onPairRFTransmitter(session) {
    let done = false;
    let activeView = true;

    const signal = await this.getRFSignal();

    const listener = async (command, { isFirst }) => {
      if (!activeView) return;
      if (!isFirst) return;
      if (done) return;

      await session.emit('createDevice', {
        name: this[sRF].name,
        data: {
          uuid: RFUtil.generateUUIDv4(),
          ...signal.constructor.commandToDeviceData(command),
          copiedFromRemote: true,
        },
      });

      done = true;
    };

    await signal.registerRXListener(listener);

    session.setHandler('showView', async viewId => {
      // Only set the view active when shown
      activeView = (viewId === 'rf_transmitter_learn');
    });

    session.setHandler('disconnect', async () => {
      await signal.unregisterRXListener(listener);
    });
  }

  /**
   * @description Since IR remotes don't have any unique data to identify them, use a uuid v4 as device data.
   * @param {Session} session
   * @returns {Promise<void>}
   */
  async onPairIRRemoteAdd(session) {
    await session.emit('createDevice', {
      name: this[sRF].name,
      data: {
        uuid: RFUtil.generateUUIDv4(),
      },
    });
  }

}

module.exports = RFDriver;
