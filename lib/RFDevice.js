'use strict';

const Homey = require('homey');
const RFUtil = require('./RFUtil');

module.exports = class RFDevice extends Homey.Device {

  // Overload Me
  static RX_ENABLED = false;
  static CAPABILITIES = {};

  constructor(...props) {
    super(...props);

    this.onCapability = this.onCapability.bind(this);
    this.onRX = this.onRX.bind(this);
  }

  /*
   * Lifecycle
   */
  async onInit() {
    // Initialize RF
    Object.keys(this.constructor.CAPABILITIES).forEach(capabilityId => {
      if (!this.hasCapability(capabilityId)) return;
      this.registerCapabilityListener(capabilityId, (...args) => {
        return this.onCapability(capabilityId, ...args);
      });
    });

    this.driver = this.driver || this.getDriver();

    // Enable RX if this Driver uses RX
    if (this.constructor.RX_ENABLED) {
      await this.driver.enableRX(this.onRX);
    }

    await this.onRFInit();
  }

  async onRFInit() {
    // Overload Me
  }

  async onDeleted() {
    // Disable RX if this Driver uses RX
    if (this.constructor.RX_ENABLED) {
      await this.driver.disableRX(this.onRX);
    }

    await this.onRFDeleted();
  }

  async onRFDeleted() {
    // Overload Me
  }

  /*
   * Device-specific methods
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

      const signal = await this.driver.getRFSignal();
      await signal.cmd(command);
      return;
    }

    // If this is an Command
    // Example:
    // static CAPABILITIES = { volume_up: 'VOLUME_UP' }
    if (typeof listener === 'string') {
      const signal = await this.driver.getRFSignal();
      await signal.cmd(listener);
      return;
    }

    // If this is a function
    // Example:
    // static CAPABILITIES = { async dim(value) { ... } }
    if (typeof listener === 'function') {
      const command = await listener.call(this, { value, opts, data });
      await this.driver.tx(command);
      return;
    }

    throw new Error(`Invalid Capability Listener: ${capabilityId}`);
  }

  async onRX(command, { isFirst, ...flags } = {}) {
    const match = await this.onCommandMatch(command);

    if (match) {
      await Promise.all([
        this.onCommand(command, { isFirst, ...flags }),
        isFirst && this.onCommandFirst(command, { ...flags }),
      ]);
    }
  }

  async onCommandMatch(command) {
    const signal = await this.driver.getRFSignal();
    const currentDeviceData = await this.getData();
    const commandDeviceData = signal.constructor.commandToDeviceData(command);
    return RFUtil.deepEqual(currentDeviceData, commandDeviceData);
  }

  async onCommandFirst(command, { ...flags } = {}) {
    // Overload Me
  }

  async onCommand(command, { isFirst }) {
    // Overload Me
  }

};
