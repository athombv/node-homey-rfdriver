'use strict';

const Homey = require('homey');
const Logger = require('./Logger');
const util = require('./util');

module.exports = superclass =>
	/**
	 * @class RFDevice
	 * @property {RFDriver} driver - The driver instance
	 * @property {Object} options - The options for this device as configured in the 'rf' property of the driver
	 * @property {Signal} signal - The signal instance for this device instance
	 * @property {Logger} logger - The logger instance for this device instance
	 *
	 * @fires RFDevice#data
	 * @fires RFDevice#before_send
	 * @fires RFDevice#send
	 * @fires RFDevice#after_send
	 * @fires RFDevice#before_send_cmd
	 * @fires RFDevice#send_cmd
	 * @fires RFDevice#after_send_cmd
	 * @fires RFDevice#error
	 */
	class RFDevice extends superclass {

		constructor(...args) {
			super(...args);

			this.driver = this.getDriver();
			this.translateError = this.driver.translateError;
			this.options = this.driver.getDeviceOptions(this);
			this.signal = this.options._signalInstance;
			this.lastFrame = {};

			this.logger = new Logger({
				logLevel: this.options.logLevel,
				captureLevel: this.options.captureLevel,
				logFunc: this.log,
				errorFunc: this.error,
			});

			this._onDataListener = (data) => {
				if (!data || !(this.matchesData(data) || (this.isPairInstance && !Object.keys(this.getData() || {}).length))) return;
				const parsedData = this.parseIncomingData(data);
				if (!parsedData) return;
				this.emit('data', parsedData);
			};
			this._onSignalError = (err) => {
				if (err && err.message === 'invalid_device') {
					return this.setUnavailable(Homey.__('generator.error.invalid_device'));
				}
				setImmediate(() => {
					throw err;
				});
			}

			this.signal.on('data', this._onDataListener);
			this.signal.on('error', this._onSignalError);

			this.on('data', this.onData.bind(this));
			this.on('send', this.onSend.bind(this));
			this.signal.register(this)
				.catch(this._onSignalError);

			this.ready(() => this.setCapabilityListeners(this.getCapabilities()));

			if (this.isPairInstance) {
				this.onInit();
			}
		}

		/**
		 * Fired when a new data object is received and parsed by this.{@link RFDevice.payloadToData|payloadToData}
		 * @event RFDevice#data
		 * @property {Object} data - The data object received
		 */

		/**
		 * Fired when this.{@link RFDevice#send|send} is called, before this.{@link RFDevice#parseOutgoingData|parseOutgoingData} is called.
		 * @event RFDevice#before_send
		 * @property {Object} data - The data object to be send
		 */

		/**
		 * Fired when this.{@link RFDevice#send|send} is called, just before this calling this.{@link Signal|signal}.{@link Signal#send|send} is called.
		 * @event RFDevice#send
		 * @property {Object} data - The data object to be send
		 * @property {Object} frame - The frame that will be given to this.signal.send
		 * @property {Object} dataCheck - The result of this.{@link RFDevice#payloadToData}(frame)
		 */

		/**
		 * Fired fired after this.{@link Signal|signal}.{@link Signal#send|send} is finished.
		 * @event RFDevice#after_send
		 * @property {Object} data - The data object that was send
		 */

		/**
		 * Fired when this.{@link RFDevice#send|cmd} is called.
		 * @event RFDevice#before_send_cmd
		 * @property {String} cmd - The command to be send
		 */

		/**
		 * Fired when this.{@link RFDevice#send|cmd} is called, just before this calling this.{@link Signal|signal}.{@link Signal#send|cmd} is called.
		 * @event RFDevice#send_cmd
		 * @property {String} cmd - The command to be send
		 * @property {cmdObj} cmdObj - The parsed command
		 */

		/**
		 * Fired fired after this.{@link Signal|signal}.{@link Signal#cmd|cmd} is finished.
		 * @event RFDevice#after_send_cmd
		 * @property {Signal} cmd - The command that was send
		 */

		/**
		 * An object parsed from a command id to access the cmd, type and subtype of the command
		 * @typedef {Object} cmdObj
		 * @property {Object} cmdObj.id - The full id of the command e.g. 'beamer~$onoff$~4k_versions
		 * @property {Object} cmdObj.cmd - The command key e.g. 'onoff'
		 * @property {Object} [cmdObj.type] - The type of the command e.g. 'beamer'
		 * @property {Object} [cmdObj.subtype] - The subtype of the command e.g. '4k_versions'
		 */

		/**
		 * Fired when a error occured
		 * @event RFDevice#error
		 * @property {Error} err - The error that occurred
		 */

		/**
		 * returns the id property in the device data object
		 * @returns {*} id the id property
		 * @memberof RFDevice
		 */
		get id() {
			return this.getData().id;
		}

		/**
		 * returns the last frame received for this device
		 * @returns {Object} lastFrame the data object of the last received frame.
		 * @memberof RFDevice
		 */
		getLastFrame() {
			return this.lastFrame || {};
		}

		/**
		 * Static method that parses a payload array to a device data object
		 * @param {number[]} payload
		 * @returns {Object|null} result the parsed data object
		 * @memberof RFDevice
		 */
		static payloadToData(payload) {
			return null;
		}

		/**
		 * Static method that parses a device data object into a payload array
		 * @param {Object} data The data object
		 * @returns {number[]|null} payload the payload that Homey can send
		 * @memberof RFDevice
		 */
		static dataToPayload(data) {
			this.error('dataToPayload not implemented. Please add the "static dataToPayload" to your device.js file!');
			return null;
		}

		/**
		 * Static method that generates a random device data object which can be used to program a device e.g. a socket with
		 * This method is only necessary when your driver uses the 'program' rf_template
		 * @returns {Object} result A random device data object
		 * @memberof RFDevice
		 */
		static generateData() {
			this.error('generateData not implemented. Please add the "static generateData" to your device.js file!');
			return null;
		}

		/**
		 * Static method that generates a device data object from a dipswitch array
		 * This method is only necessary when your driver uses the 'dipswitch' rf_template
		 * @param {Array} dipswitches The dipswitch array that the user set in the pair wizard
		 * @returns {Object|null} result the device data object or null if the dipswitch array was invalid
		 * @memberof RFDevice
		 */
		static dipswitchesToData(dipswitches) {
			return null;
		}

		/**
		 * Static method that generates a device data object from a codewheelIndexes array
		 * This method is only necessary when your driver uses the 'codewheel' rf_template
		 * @param {Array} codewheelIndexes The codewheelIndexes array that the user set in the pair wizard
		 * @returns {Object|null} result the device data object or null if the codewheelIndexes array was invalid
		 * @memberof RFDevice
		 */
		static codewheelsToData(codewheelIndexes) {
			return null;
		}

		/**
		 * This function should send a program signal to the device. You can access the device and its properties on 'this'
		 * The default implementation of this function calls this.send() without data which will send the this.getData() object
		 * This method is only necessary when your driver uses the 'program' rf_template
		 * @returns {Promise} result a promise which resolves after the sending of the program signal is complete
		 * @memberof RFDevice
		 */
		sendProgramSignal() {
			return this.send();
		}

		/**
		 * This function combines the data given to this.send() with device data to generate a complete device data object.
		 * The default implementation will extend this.getData with this.lastFrame and the sendData object given to this.send()
		 * @param {Object} sendData The data object given to this.send(data)
		 * @returns {Object} result the data object that should be send using {@link RFDevice.dataToPayload|dataToPayload}
		 * @memberof RFDevice
		 */
		assembleSendData(sendData) {
			return Object.assign({}, this.getData(), this.lastFrame || {}, this.getEmptyCapabilitiesObject(), sendData);
		}

		/**
		 * This function combines all data set to this device into an object which will be used to add this device.
		 * The object can contain all properties which can be given to Homey.addDevice in the pair view.
		 * The default implementation should suffice and will set this.getData(), this.getSettings(), this.getStore() and this.getCapabilities() on the new device.
		 * @returns {Object|null} result The device object or null if the device object could not be created.
		 * @memberof RFDevice
		 */
		assembleDeviceObject() {
			if (!Object.keys(this.getData() || {}).length) {
				this.error('could not assemble device, data empty.');
				return null;
			}

			// const name = typeof data.name === 'object' ?
			// 	data.name[Homey.ManagerI18n.getLanguage()] || data.name.en :
			// 	data.name;

			const data = this.getData();
			const settings = this.getSettings();
			const store = this.getStore();
			const capabilities = this.getCapabilities();
			const mobileComponents = ((this.getDriver().manifest.mobile || {}).components || [])
				.filter(component =>
					!component.capabilities ||
					component.capabilities.every(capability => this.hasCapability(capability))
				);
			const capabilityObj = (capabilities || [])
				.reduce((obj, capability) => Object.assign(obj, { [capability]: this.getCapabilityValue(capability) }), {})

			return Object.assign(
				{
					name: util.__(this.options.name || this.getDriver().manifest.name || 'My Device'),
					data: Object.assign({}, data, capabilityObj),
				},
				settings ? { settings } : {},
				store ? { store } : {},
				capabilities ? { capabilities } : {},
				mobileComponents.length ? { mobile: { components: mobileComponents } } : {},
			);
		}

		/**
		 * This function returns an object with all capability keys assigned to "undefined"
		 * This can be used to clear a deviceData object from capability keys before assigning the real capability key to send
		 * @returns {Object} result
		 */
		getEmptyCapabilitiesObject() {
			return this.getCapabilities()
				.concat(this.getDriver().manifest.capabilities)
				.reduce((res, key) => Object.assign(res, { [key]: undefined }), {})
		}

		/**
		 * This function is called after {@link RFDevice.payloadToData|payloadToData} but before the 'data' event is emitted. This function can be used
		 * to add custom mutations on the data depending on this.getSettings() or other device instance specific values.
		 * @param {Object} incomingData The incoming data object
		 * @returns {Object|null} result The data that should be emitted or null if the data should be dropped.
		 * @memberof RFDevice
		 */
		parseIncomingData(incomingData) {
			return incomingData;
		}

		/**
		 * This function is called in this.send just before the data turned into a payload array and send by Homey. This function can be used
		 * to add custom mutations on the data depending on this.getSettings() or other device instance specific values.
		 * @param {Object} outgoingData The outgoing data object
		 * @returns {Object|null} result The data that should be send by Homey or null if the data should not be send.
		 * @memberof RFDevice
		 */
		parseOutgoingData(outgoingData) {
			return outgoingData;
		}

		/**
		 * Returns all (persistent) state variables on the device instance.
		 * @returns {{name: (string), data: (Object), lastFrame: (Object|null), settings: {Object}, store: {Object}, capabilities: {String[]}, signal}}
		 * @memberof RFDevice
		 */
		get deviceState() {
			return {
				name: this.getName(),
				data: this.getData(),
				lastFrame: this.lastFrame || this.getData(),
				settings: this.getSettings(),
				store: this.getStore(),
				capabilities: this.getCapabilities(),
				signal: this.signal,
			};
		}

		/**
		 * This function is used while pairing to check if the device has all properties to create a valid device object to add to Homey
		 * @returns {Promise} result If the device is valid.
		 * @memberof RFDevice
		 */
		assertDevice() {
			this.logger.silly('Driver:assertDevice()+this', this);
			if (!this.id) {
				return Promise.reject(new Error('Device has no id set in the data object'));
			} else if (this.driver.getDevice(this.getData())) {
				return Promise.reject(new Error('Device with similar data already exists'));
			} else if (!this.dataToPayload(this.getData())) {
				return Promise.reject(new Error('Device data could not produce a valid payload array!'));
			}
			return Promise.resolve(this);
		}

		/**
		 * This function is called when the device is inited or the capabilities array is changed while pairing this device.
		 * Note that you should register all capability listeners inside this function an nowhere else to guarantee that they are set correctly during pairing
		 * @param {String[]} capabilities The capabilities array of the device.
		 * @memberof RFDevice
		 */
		setCapabilityListeners(capabilities) {
			this.registerMultipleCapabilityListener(capabilities, (valueObj) => {
				return this.send(valueObj);
			}, 500);
		}

		/**
		 * Compares a data object with this device to check if the data object is relevant for this device.
		 * The default implementation compares the id property in the device data object to the id value of the data object.
		 * @param {Object} data The received data object
		 * @returns {boolean} result If the data object is intended for this device.
		 * @memberof RFDevice
		 */
		matchesData(data) {
			return this.id === data.id;
		}

		/**
		 * This function is called when the 'data' event is emmitted.
		 * The default implementation will check the data object for capability changes and sets the new values automatically.
		 * @param {Object} data The incoming data object.
		 * @memberof RFDevice
		 */
		onData(data) {
			if (!this.isPairInstance || Object.keys(this.getData() || {}).length) {
				this.getCapabilities().forEach(capability => {
					if (data.hasOwnProperty(capability) && data[capability] !== null && data[capability] !== undefined) {
						this.setCapabilityValue(capability, data[capability]);
					}
				});
			}
			this.lastFrame = data;
		}

		/**
		 * This function is called when the 'send' evnet is emitted
		 * The default implementation will emit the 'send_pair' event with the frame argument. If you want to manipulate
		 * This data before the event is triggered you can do so here.
		 * @param {Object} data the data to be send
		 * @param {Number[]} payload the payload that will be transmitted
		 * @param {Object} frame the data object parsed from payload
		 */
		onSend(data, payload, frame) {
			if (this.isPairInstance) {
				this.emit('send_pair', frame);
			}
		}

		/**
		 * This function is called when this device is added for the first time from the pairing wizard.
		 * @returns {*}
		 * @memberof RFDevice
		 */
		onAdded() {
			// Set initial data object on state
			this.onData(this.getData());
			return null;
		}

		/**
		 * This function is called when a user deletes this device from Homey.
		 * Note. When overriding this.onDeleted() make sure you call super.onDeleted() to ensure that all listeners are removed correctly!
		 * @memberof RFDevice
		 */
		onDeleted() {
			this.removeAllListeners();
			this.signal.unregister(this);
			this.signal.removeListener('data', this._onDataListener);
			this.signal = null;
		}

		/**
		 * This function can be called to send data for this device.
		 * @param {Object} [data] (a part of) The data that you want to send
		 * @param {Object} [options] The options object
		 * @param {Object} [options.signal] A different signal instance to call the 'send' function on
		 * @returns {Promise} result A promise which resolves after the data is send.
		 * @memberof RFDevice
		 */
		send(data, options) {
			this.logger.silly('Driver:send(data, callback, options)', data, options);
			return new Promise((resolve, reject) => {
				options = options || {};
				data = this.assembleSendData(Object.assign({}, data));
				if (!data) return reject('assemble_send_data_returned_null');
				this.emit('before_send', data);
				data = this.parseOutgoingData(data);
				if (!data) return reject('parse_outgoing_data_returned_null');

				const payload = this.constructor.dataToPayload(data);
				if (!payload) {
					const err = new Error(`dataToPayload(${JSON.stringify(data)}) gave empty response: ${payload}`);
					this.logger.error(err);
					reject(err);
					this.setUnavailable(this.translateError('invalid_device_data'));
					return;
				}
				const frame = payload.map(Number);
				const dataCheck = this.constructor.payloadToData(frame);
				if (
					frame.find(isNaN) || !dataCheck ||
					dataCheck.constructor !== Object || !dataCheck.id ||
					dataCheck.id !== this.getData().id
				) {
					const err = new Error(`Incorrect frame from dataToPayload(${JSON.stringify(data)}) => ${frame} => ${
						JSON.stringify(dataCheck)}`);
					this.logger.error(err);
					reject(err);
					this.setUnavailable(this.translateError('invalid_device_data'));
					return;
				}
				this.emit('send', data, frame, dataCheck);
				resolve(
					(options.signal || this.signal)
						.send(frame)
						.then(() => {
							this.emit('after_send', data);
						})
						.catch(err => {
							this.logger.error(err);
							this.emit('error', err);
							throw err;
						})
				);
			});
		}

		// TODO test if this still works
		getCmds() {
			if (!this.cmdCache) {
				const deviceData = this.getData();
				const driverConfig = this.driver.config;
				const typeDef = Object.assign({}, deviceData, deviceData.metadata);
				const cmdType = typeDef.hasOwnProperty('cmdType') ?
					typeDef.cmdType :
					(this.config.cmdType || driverConfig.cmdType);
				const cmdSubType = typeDef.hasOwnProperty('cmdSubType') ?
					typeDef.cmdSubType :
					(this.config.cmdSubType || driverConfig.cmdType);

				const resultMap = new Map();
				const addCmds = (obj) => {
					if (!obj || typeof obj !== 'object') return;
					Object.keys(obj).forEach((cmd) => {
						if (typeof obj[cmd].id !== 'string') return;
						resultMap.set(cmd, obj[cmd]);
					});
				};

				addCmds(this.cmdStructure);
				if (cmdSubType && cmdSubType !== 'default') {
					addCmds(this.cmdStructure.subTypes[cmdSubType]);
				}
				if (cmdType && cmdType !== 'default') {
					addCmds(this.cmdStructure.types[cmdType]);
					if (cmdSubType && cmdSubType !== 'default') {
						addCmds(this.cmdStructure.types[cmdType].subTypes[cmdSubType]);
					}
				}
				this.cmdCache = resultMap;
			}
			return this.cmdCache;
		}

		// TODO test if this still works
		sendCmd(cmd, options) {
			this.logger.silly('Driver:sendCmd(cmd, callback, options)', cmd, options);
			return new Promise((resolve, reject) => {
				options = options || {};
				const cmdObj = this.signal.parseCmdId(cmd);
				if (!cmdObj) {
					const err = new Error(`${cmd} is not a valid command string`);
					this.logger.error(err);
					return reject(err);
				}
				cmd = cmdObj.cmd;
				this.emit('before_send_cmd', cmd);

				const cmdKey = this.getCmds().get(cmd);
				if (!cmdKey) {
					const err = new Error(`Device of type ${this.options.cmdType} and subtype ${this.options.cmdSubType
						} does not have cmd ${cmd}`);
					this.logger.error(err);
					return reject(err);
				}
				this.emit('send_cmd', cmd, cmdKey);
				let sendCmd = cmdKey.id;
				const signal = (options.signal || this.signal);
				if (signal.options.emulateToggleBits) {
					const cmdKeyObj = this.signal.parseCmdId(cmdKey.id);
					sendCmd = `${cmdKeyObj.type ? `${cmdKeyObj.type}$~` : ''
						}${cmdKeyObj.cmd}${(options.signal || this.signal).shouldToggle() ? '_1_' : ''
						}${cmdKeyObj.subType ? `~$${cmdKeyObj.subType}` : ''}`;
				}
				resolve(
					signal
						.sendCmd(sendCmd)
						.then(() => {
							this.emit('after_send_cmd', cmd);
						})
						.catch(err => {
							this.logger.error(err);
							this.emit('error', err);
							throw err;
						})
				);
			});
		}
	};
