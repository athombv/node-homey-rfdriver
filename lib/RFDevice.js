'use strict';

const Homey = require('homey');
const RFUtil = require('./RFUtil');

/**
 * @extends Homey.Device
 * @hideconstructor
 */
class RFDevice extends Homey.Device {

  // Overload Me
  /** @type {boolean} */
  static RX_ENABLED = false;

  /** @type {object} */
  static CAPABILITIES = {};

  constructor(...props) {
    super(...props);

    this.onCapability = this.onCapability.bind(this);
    this.onRX = this.onRX.bind(this);
  }

  /*
   * Lifecycle
   */
  /**
   * Do not use this method, but use {@link RFDevice#onRFInit} instead.
   * @returns {Promise<void>}
   */
  async onInit() {
    // Initialize RF
    Object.keys(this.constructor.CAPABILITIES).forEach(capabilityId => {
      if (!this.hasCapability(capabilityId)) return;
      this.registerCapabilityListener(capabilityId, (...args) => {
        const isVolumeChangeCapability = capabilityId === 'volume_down' || capabilityId === 'volume_up';
        if (this.hasCapability('volume_mute') && isVolumeChangeCapability) {
          this.setCapabilityValue('volume_mute', false);
        }
        return this.onCapability(capabilityId, ...args);
      });
    });

    this.driver = this.driver || this.getDriver();

    // Enable RX if this Driver uses RX or if the command was copied from a remote
    // with the 'copiedFromRemote' param
    if (this.constructor.RX_ENABLED || this.getData().copiedFromRemote === true) {
      await this.driver.enableRX(this.onRX);
    }

    await this.onRFInit();
  }

  /**
   * @returns {Promise<void>}
   */
  async onRFInit() {
    // Overload Me
  }

  async onUninit() {
    // Disable RX if this Driver uses RX or if the command was copied from a remote
    // with the 'copiedFromRemote' param
    if (this.constructor.RX_ENABLED || this.getData().copiedFromRemote === true) {
      await this.driver.disableRX(this.onRX);
    }

    await this.onRFUninit();
  }

  /**
   * @returns {Promise<void>}
   */
  async onRFUninit() {
    // Overload Me
  }

  /**
   * @returns {Promise<void>}
   */
  async onDeleted() {
    await this.onRFDeleted();
  }

  /**
   * @returns {Promise<void>}
   */
  async onRFDeleted() {
    // Overload Me
  }

  /**
   * @description Device-specific methods
   * @param {string} capabilityId
   * @param {*} value
   * @param {object} opts
   * @returns {Promise<void>}
   */
  async onCapability(capabilityId, value, opts = {}) {
    const data = this.getData();
    const listener = this.constructor.CAPABILITIES[capabilityId];

    // If this is an Object of Signal Commands
    // Example:
    // static CAPABILITIES = { onoff: { 'true': 'POWER_ON', 'false': 'POWER_OFF' }}
    if (typeof listener === 'object') {
      const command = listener[String(value)];
      if (!command) {
        throw new Error(`Missing Command For Capability ${capabilityId} Value: ${value}`);
      }

      await this.driver.cmd(command, {
        device: this,
      });
      return;
    }

    // If this is an Command
    // Example:
    // static CAPABILITIES = { volume_up: 'VOLUME_UP' }
    if (typeof listener === 'string') {
      await this.driver.cmd(listener, {
        device: this,
      });
      return;
    }

    // If this is a function
    // Example:
    // static CAPABILITIES = { async dim(value) { ... } }
    if (typeof listener === 'function') {
      const command = await listener.call(this, { value, opts, data });
      await this.driver.tx(command, {
        device: this,
      });
      return;
    }

    throw new Error(`Invalid Capability Listener: ${capabilityId}`);
  }

  /**
   * @param command
   * @param {object} args
   * @param {boolean} args.isFirst
   * @param {object} args.flags
   * @returns {Promise<void>}
   */
  async onRX(command, { isFirst, ...flags } = {}) {
    const match = await this.onCommandMatch(command);

    if (match) {
      await Promise.all([
        this.onCommand(command, { isFirst, ...flags }),
        isFirst && this.onCommandFirst(command, { ...flags }),
      ]);
    }
  }

  /**
   * @param command
   * @returns {Promise<*>}
   */
  async onCommandMatch(command) {
    const signal = await this.driver.getRFSignal();
    const currentDeviceData = await this.getData();
    const commandDeviceData = signal.constructor.commandToDeviceData(command);
    return RFUtil.deepEqual(currentDeviceData, commandDeviceData);
  }

  /**
   * @param command
   * @param {object} flags
   * @returns {Promise<void>}
   */
  async onCommandFirst(command, { ...flags } = {}) {
    // Overload Me
  }

  /**
   * @param command
   * @param {object} args
   * @param {boolean} args.isFirst
   * @returns {Promise<void>}
   */
  async onCommand(command, { isFirst }) {
    // Overload Me
  }

}

module.exports = RFDevice;
