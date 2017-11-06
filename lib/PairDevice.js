'use strict';

const Homey = require('homey');

module.exports = class PairDeviceMixin extends Homey.SimpleClass {

	constructor(driver, deviceOptions) {
		super();

		this.isPairInstance = true;

		this.__available = true;
		this.__capabilities = deviceOptions.capabilities || [];
		this.__state = {};
		this.__store = {};
		this.__deviceClass = 'other';
		this.__data = {};
		this.__name = 'pairing device';
		this.__settings = driver.getManifestSettings()
			.reduce((settingsObj, setting) => Object.assign(settingsObj, { [setting.id]: setting.value }), {});
		this.__capabilityListeners = {};

		this.__driver = driver;
		this.__deviceOptions = deviceOptions;
	}

	/**
	 * Mimic device functions
	 */
	onAdded() {
		return null;
	}

	onDeleted() {
		return null;
	}

	onInit() {
		return null;
	}

	onRenamed() {
		return null;
	}

	onSettings() {
		return null;
	}

	ready(cb) {
		return cb();
	}

	getAvailable() {
		return this.__available;
	}

	getCapabilities() {
		return Homey.util.recursiveDeepCopy(this.__capabilities);
	}

	getCapabilityValue(capabilityId) {
		return this.__state[capabilityId];
	}

	getClass() {
		return this.__deviceClass;
	}

	getData() {
		return Homey.util.recursiveDeepCopy(this.__data);
	}

	getDriver() {
		return this.__driver;
	}

	getName() {
		return this.__name;
	}

	getSetting(settingId) {
		return this.__settings[settingId];
	}

	getSettings() {
		return Homey.util.recursiveDeepCopy(this.__settings);
	}

	getState() {
		return Homey.util.recursiveDeepCopy(this.__state);
	}

	getStore() {
		return Homey.util.recursiveDeepCopy(this.__store);
	}

	getStoreKeys() {
		return Object.keys(this.__store);
	}

	getStoreValue(storeId) {
		return Homey.util.recursiveDeepCopy(this.__store[storeId]);
	}

	hasCapability(capabilityId) {
		return this.__capabilities.includes(capabilityId);
	}

	registerCapabilityListener(capabilityId, callback) {
		this.__capabilityListeners[capabilityId] = this.__capabilityListeners[capabilityId] || [];
		this.__capabilityListeners[capabilityId].push(callback);
	}

	registerMultipleCapabilityListener(capabilityIds, callback) {
		capabilityIds.forEach(capabilityId => {
			this.__capabilityListeners[capabilityId] = this.__capabilityListeners[capabilityId] || [];
			this.__capabilityListeners[capabilityId]
				.push((value, opts, cb) => callback({ [capabilityId]: value }, { [capabilityId]: opts }, cb));
		});
	}

	setAvailable(cb) {
		this.__available = true;
		if (cb) cb();
		return Promise.resolve();
	}

	setCapabilityValue(capabilityId, value, cb) {
		this.__state[capabilityId] = value;
		if (cb) cb();
		return Promise.resolve();
	}

	setSettings(newSettings, cb) {
		Object.assign(this.__settings, newSettings);
		if (cb) cb();
		return Promise.resolve();
	}

	setStoreValue(key, value, cb) {
		this.__store[key] = value;
		if (cb) cb();
		return Promise.resolve();
	}

	setUnavailable(_, cb) {
		this.__available = false;
		if (cb) cb();
		return Promise.resolve();
	}

	triggerCapabilityListener(capabilityId, value, opts, callback) {

		if (typeof callback === 'function')
			return Homey.util.callbackAfterPromise(this, this.triggerCapabilityListener, arguments);

		console.log('calling listener', capabilityId, this.__capabilityListeners[capabilityId]);
		return Promise.all(
			(this.__capabilityListeners[capabilityId] || []).map(listener => {
				const deferred = {};
				const cbPromise = new Promise((res, rej) => {
					deferred.resolve = res;
					deferred.reject = rej;
				});
				const result = listener(value, opts, (err, res) => err ? deferred.reject(err) : deferred.resolve(res));

				if (result instanceof Promise) {
					deferred.resolve(result);
				}

				return cbPromise;
			})
		).then(() => {
			this.__state[capabilityId] = value;
		});
	}

	unsetStoreValue(key, cb) {
		delete this.__store[key];
		if (cb) cb();
		return Promise.resolve();
	}

	/**
	 * End of Mimicked functions
	 */

	__generateData() {
		const oldData = this.__data;
		let count = 0;
		do {
			this.__data = Object.assign(this.constructor.generateData(), { generated: true });
			count++;
		} while (this.__driver.getDevice(this.__data) && count < 100);
		if (count === 100) {
			this.__data = oldData;
			return new Error('Could not generate unique device');
		}
		return this.__data;
	}

	setDeviceState({ data, settings, store, capabilities }) {
		if (settings !== undefined) Object.assign(this.__settings, settings);
		if (store !== undefined) this.__store = store;
		if (data !== undefined) {
			if (this.__data && this.__data.id !== data.id) {
				this.__lastFrame = null;
			}
			this.__data = data;
		}
		if (Array.isArray(capabilities)) {
			this.__capabilities = capabilities;
			this.__capabilityListeners = {};
			this.setCapabilityListeners(capabilities);
		}
	}

	destroy() {
		this.onDeleted();
	}
};
