'use strict';

const Homey = require('homey');

module.exports = class RFDriver extends Homey.Driver {

  static SIGNAL_ID = null;
  static RX_ENABLE = false;

  async onInit() {
    this.rf = {};
    this.rf.signal = this.homey.rf.getSignal(this.constructor.SIGNAL_ID);
    this.rf.rxEnabledDevices = new Set();
  }

  async enableRX(device) {
    if (this.rf.rxEnabledDevices.has(device)) return;
    this.rf.rxEnabledDevices.add(device);

    if (this.rf.rxEnabledDevices.size === 1) {
      this.debug('Enabling RX...');
      await this.rf.signal.enableRX();
      this.debug('RX Enabled');
    }
  }

  async disableRX(device) {
    if (!this.rf.rxEnabledDevices.has(device)) return;
    this.rf.rxEnabledDevices.delete(device);

    if (this.rf.rxEnabledDevices.size === 0) {
      this.debug('Disabling RX...');
      await this.rf.signal.disableRX();
      this.debug('RX Disabled');
    }

  }

  async onPair(socket) {
    // TODO
  }

}