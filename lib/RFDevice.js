'use strict';

const Homey = require('homey');

module.exports = class RFDevice extends Homey.Device {

  constructor() {
    this.onCapability = this.onCapability.bind(this);
  }

  async onInit() {
    this.driver = this.getDriver();

    // Initialize RF
    this.rf = {};
    this.rf.capabilities = this.getCapabilities();
    this.rf.capabilities.forEach(capabilityId => {
      this.registerCapabilityListener(capabilityId, (...args) => this.onCapability(capabilityId, ...args));
    });

    // Enable RX if this Driver uses RX
    if (this.driver.constructor.RX_ENABLE)
      await this.enableRX();
  }

  async onCapability(capabilityId, value, opts) {
    console.log('onCapability', capabilityId, value, opts);
  }

  async enableRX() {
    await this.driver.enableRX(this);
  }

  async disableRX() {
    await this.driver.disableRX(this);
  }

}