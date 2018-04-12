'use strict';

const Homey = require('homey');
const PairDevice = require('./PairDevice');
const RFDevice = require('./Device');
const path = require('path');
const Signal = require('./Signal');
const Logger = require('./Logger');
const util = require('./util');

/**
 * @class RFDriver
 * @property {Object} manifest - The manifest for this driver
 * @property {Object} options - The options for this device as configured in the 'rf' property of the driver
 * @property {Logger} logger - The logger instance for this device instance
 */
class RFDriver extends Homey.Driver {

	constructor(...args) {
		super(...args);

		this.on('__log', console.log);
		this.on('__debug', console.log);
		this.on('__error', console.error);

		this.isRunningInDebugMode = process.env.DEBUG === '1';

		this.manifest = Homey.manifest.drivers.find(driver => driver.id === this.id);
		this.options = this.manifest.rf || {};

		this.logger = new Logger({
			logLevel: this.options.logLevel,
			captureLevel: this.options.captureLevel,
			logFunc: this.log,
			errorFunc: this.error,
		});

		this.defaultSignalClass = this.options.signalClass ? require(path.join(Homey.dir, 'drivers', this.id, this.options.signalClass)) : Signal;
		const defaultDevice = Object.assign(
			{
				id: 'default',
				debounceTime: 500,
				capabilities: this.manifest.capabilities,
			},
			this.options,
			{
				_deviceClassGenerator: require(path.join(Homey.dir, 'drivers', this.id, this.options.deviceClass || 'device.js')),
				devices: undefined,
				_signalClass: this.defaultSignalClass,
			}
		);
		defaultDevice._deviceClass = defaultDevice._deviceClassGenerator(RFDevice(Homey.Device));
		if (defaultDevice.signal) {
			defaultDevice._signalInstance = new defaultDevice._signalClass({
				signalType: defaultDevice.signalType,
				signalKey: defaultDevice.signal,
				deviceClass: defaultDevice._deviceClass,
				debounceTime: defaultDevice.debounceTime,
				minTxInterval: defaultDevice.minTxInterval,
				dropPendingPayload: defaultDevice.dropPendingPayload,
				logger: this.logger,
			});
			defaultDevice.signalType = defaultDevice._signalInstance.signalType;
		}

		this.devices = new Map([[defaultDevice.id, defaultDevice]].concat(
			defaultDevice.id !== 'default' ? [['default', defaultDevice]] : [],
			(this.options.devices || []).map(device => {
				if (!device.id) throw new Error('Subdevice must have an id');
				const signalClass = device._signalClass ? require(path.join(Homey.dir, 'drivers', this.id, device._signalClass)) : this.defaultSignalClass;
				const deviceOptions = Object.assign({}, defaultDevice, device, {
					_deviceClassGenerator: device.driver ? require(path.join(Homey.dir, 'drivers', this.id, device.deviceClass)) : defaultDevice._deviceClassGenerator,
					devices: undefined,
					_signalClass: signalClass,
				});
				deviceOptions._deviceClass = deviceOptions._deviceClassGenerator(RFDevice(Homey.Device))
				if (!deviceOptions.signal) throw new Error(`Device "${device.id}" has no signal property`);
				deviceOptions._signalInstance = new deviceOptions._signalClass({
					signalType: deviceOptions.signalType,
					signalKey: deviceOptions.signal,
					deviceClass: deviceOptions._deviceClass,
					debounceTime: deviceOptions.debounceTime,
					minTxInterval: deviceOptions.minTxInterval,
					dropPendingPayload: deviceOptions.dropPendingPayload,
					logger: this.logger,
				});
				deviceOptions.signalType = deviceOptions._signalInstance.signalType;
				return [deviceOptions.id, deviceOptions];
			})
		));
	}

	onMapDeviceClass(device) {
		return this.getDeviceOptions(device)._deviceClass;
	}

	/**
	 * The onInit method is called when a driver is initialized.
	 * Note. when overriding this method make sure you call super.onInit() or use onRFInit() which is called after onInit()
	 * @memberof RFDriver
	 */
	onInit() {
		this.removeListener('__log', console.log);
		this.removeListener('__debug', console.log);
		this.removeListener('__error', console.error);

		super.onInit();

		this.logger.silly('Driver:onInit()');

		this.logger.info(
			'Initializing driver with log level', this.logger.getLogLevelLabel(),
			'and capture level', this.logger.getCaptureLevelLabel()
		);

		this.initDefaultFlows();

		this.onRFInit();
	}

	onRFInit() {

	}

	/**
	 * Initializes the default flows that are implemented in the RFDriver.
	 * @param {String[]} [skip] An array of flow id's that should be skipped when loading default flow logic.
	 */
	initDefaultFlows(skip = []) {
		const matchRFDriverCard = (searchId, cardId) => {
			// Retain support for old flow card id's
			if (cardId === `${this.id}:${searchId}`) return true;

			const searchString = `rf.${searchId}`;
			if (!cardId.startsWith(searchString)) return false;
			if (cardId.length > searchString.length && cardId[searchString.length] !== '.') return false;
			return cardId.split('.').slice(1);
		};

		if (!(this.flowTriggerDeviceFrameReceived || skip.includes('received'))) {
			const receivedTrigger = this.getFlowTriggersManifest({ filterFn: (card) => matchRFDriverCard('received', card.id) });
			if (receivedTrigger && receivedTrigger.length) {
				this.flowTriggerDeviceFrameReceived = new Homey.FlowCardTriggerDevice(receivedTrigger[0].id)
					.register()
					.registerRunListener(this.genericRunListener.bind(this, 'onFlowTriggerFrameReceived'));
			}
		}

		if (!(this.flowTriggerDeviceCmdReceived || skip.includes('cmd_received'))) {
			const cmdReceivedTrigger = this.getFlowTriggersManifest({ filterFn: (card) => matchRFDriverCard('cmd_received', card.id) });
			if (cmdReceivedTrigger && cmdReceivedTrigger.length) {
				const card = cmdReceivedTrigger[0];
				this.flowTriggerDeviceCmdReceived = new Homey.FlowCardTriggerDevice(card.id)
					.register()
					.registerRunListener(this.genericRunListener.bind(this, 'onFlowTriggerCmdReceived'));

				const cmdArg = card.args.find(arg => arg.name === 'cmd');
				if (cmdArg && cmdArg.type === 'autocomplete') {
					this.flowTriggerDeviceCmdReceived
						.getArgument(cmdArg.name)
						.registerAutocompleteListener(this.genericRunListener.bind(this, 'onFlowTriggerCmdReceivedAutocomplete'));
				}
			}
		}

		if (!(this.flowActionDeviceFrameSend || skip.includes('send'))) {
			const sendAction = this.getFlowActionsManifest({ filterFn: (card) => matchRFDriverCard('send', card.id) });
			if (sendAction && sendAction.length) {
				this.flowActionDeviceFrameSend = new Homey.FlowCardAction(sendAction[0].id)
					.register()
					.registerRunListener(this.genericRunListener.bind(this, 'onFlowActionFrameSend'));
			}
		}

		if (!(this.flowActionDeviceSendCmd || skip.includes('send_cmd'))) {
			const sendCmdAction = this.getFlowActionsManifest({ filterFn: (card) => matchRFDriverCard('send_cmd', card.id) });
			if (sendCmdAction && sendCmdAction.length) {
				const card = sendCmdAction[0];
				this.flowActionDeviceSendCmd = new Homey.FlowCardAction(card.id)
					.register()
					.registerRunListener(this.genericRunListener.bind(this, 'onFlowActionSendCmd'));

				const cmdArg = card.args.find(arg => arg.name === 'cmd');
				if (cmdArg && cmdArg.type === 'autocomplete') {
					this.flowActionDeviceSendCmd
						.getArgument(cmdArg.name)
						.registerAutocompleteListener(this.genericRunListener.bind(this, 'onFlowActionSendCmdAutocomplete'));
				}
			}
		}

		if (!(this.flowActionDeviceSendCmdNumber || skip.includes('send_cmd_number'))) {
			const sendCmdNumberAction = this.getFlowActionsManifest({ filterFn: (card) => matchRFDriverCard('send_cmd_number', card.id) });
			if (sendCmdNumberAction && sendCmdNumberAction.length) {
				const card = sendCmdNumberAction[0];
				this.flowActionDeviceSendCmdNumber = new Homey.FlowCardAction(card.id)
					.register()
					.registerRunListener(this.genericRunListener.bind(this, 'onFlowActionSendCmdNumber'));
			}
		}

	}

	genericRunListener(triggerFnName, args, state) {
		if (typeof args === 'object' && args.device) {
			if (!args.device[triggerFnName]) return Promise.resolve();
			return args.device[triggerFnName](args, state);
		} else if (typeof state === 'object' && state.device) {
			if (!state.device[triggerFnName]) return Promise.resolve();
			return state.device[triggerFnName](args, state);
		}

		// workaround for bug in Homey 1.5.3
		const device = this.getDevice(state.device_data);
		if (device instanceof Error) {
			return Promise.reject(device);
		}
		if (!device[triggerFnName]) return Promise.resolve();
		return Promise.resolve(device[triggerFnName](Object.assign({ device }, args), state));
	}

	// TODO implement logic
	getDeviceOptions(device) {
		return this.devices.get('default');
	}

	// TODO implement or remove
	// matchDeviceClassPayload(data, signal) {
	// 	for (const [id, deviceOptions] of this.devices) {
	// 		if (id === 'default') continue;
	// 		if (deviceOptions._signalInstance === signal && deviceOptions.class.matchesPayload(data)) {
	// 			return deviceOptions;
	// 		}
	// 	}
	// 	return this.devices.get('default');
	// }

	// TODO probably remove or add static method or something
	// getDevicesByCmd(cmdObj) {
	// 	cmdObj = typeof cmdObj === 'string' ? this.parseCmdId(cmdObj) : cmdObj;
	// 	const result = [];
	// 	for (const entry of this.devices) {
	// 		if (cmdObj.type) {
	// 			if (entry[1].cmdType !== cmdObj.type) continue;
	// 		} else {
	// 			if (entry[1].cmdType && entry[1].cmdType !== 'default' &&
	// 				this.cmds.indexOf(`${entry[1].cmdType}$~${cmdObj.id}`) !== -1) continue;
	// 		}
	// 		if (cmdObj.subType) {
	// 			if (entry[1].cmdSubType !== cmdObj.subType) continue;
	// 		} else {
	// 			if (entry[1].cmdSubType && entry[1].cmdSubType !== 'default' &&
	// 				this.cmds.indexOf(`${cmdObj.id}~$${entry[1].cmdSubType}`) !== -1) continue;
	// 		}
	// 		result.push(entry[1]);
	// 	}
	// 	return result;
	// }

	getManifestSettings() {
		if (!this.manifestSettings) {
			if (!this.manifest || !this.manifest.settings) return this.manifestSettings = [];

			const flattenSettings = (settings) => {
				return settings.reduce((manifestSettings, setting) => {
					if (setting.type === 'group') {
						return manifestSettings.concat(flattenSettings(setting.children));
					}
					manifestSettings.push(setting);
					return manifestSettings;
				}, []);
			};

			this.manifestSettings = flattenSettings(this.manifest.settings);
		}
		return this.manifestSettings;
	}

	/**
	 * Gets a device which matches given payload data object
	 * @param {Object} data the data object to match with
	 * @returns {RFDevice|null} The first Device that matches the given data.
	 * @memberof RFDriver
	 */
	getDevice(data) {
		return Object.values(this.getDevices()).find(device => device.matchesData(data));
	}

	getPairDevice(device = {}) {
		const deviceOptions = this.devices.get(device.id || device || 'default');
		return new (deviceOptions._deviceClassGenerator(RFDevice(PairDevice)))(this, deviceOptions);
	}

	translateError(err) {
		if (err && err instanceof Error && err.message) {
			if (this.isRunningInDebugMode) {
				return `Error: ${err.message}   ${err.stack.replace(/\n/g, '')}`;
			}
			const translationPath = `generator.error.${err.message.replace(/ /g, '_')}`;
			const translation = Homey.__(translationPath);

			if (translationPath !== translation) {
				return translation;
			} else {
				return err;
			}
		} else if (err && typeof err === 'string') {
			const translationPath = `generator.error.${err.replace(/ /g, '_')}`;
			const translation = Homey.__(translationPath);

			if (translationPath !== translation) {
				return translation;
			} else {
				return err;
			}
		}
		return err;
	}

	/**
	 * The pair method that is called when the user opens the pair view of this driver.
	 * Note. When overriding this method make sure you call super.onPair(socket)!
	 * @param {Object} socket The socket connection object to the pair view
	 * @returns {RFDevice} The instance of the pairDevice
	 * @memberof RFDriver
	 */
	onPair(socket) { // Pair sequence
		this.logger.verbose('Driver:pair(socket)', socket);
		this.logger.info('opening pair wizard');

		const receivedListener = (frame) => {
			this.logger.verbose('emitting frame to pairing wizard', frame);
			socket.emit('frame', frame);
		};
		let pairDevice;
		const resetDeviceInstance = (type = 'default') => {
			if (pairDevice) {
				pairDevice.destroy();
			}
			pairDevice = this.getPairDevice(type);
			pairDevice.on('data', receivedListener);
			pairDevice.on('send_pair', receivedListener);
		};
		resetDeviceInstance();

		socket.on('next', (data, callback) => {
			this.logger.verbose('Driver:pair->next(data, callback)', data, callback);
			socket.emit('nextView', this.manifest.pair.map(view => view.id));
			callback();
		});

		socket.on('previous', (data, callback) => {
			this.logger.verbose('Driver:pair->previous(data, callback)', data, callback);
			socket.emit('previousView', this.manifest.pair.map(view => view.id));
			callback();
		});

		socket.on('reset_device', (_, callback) => {
			this.logger.verbose(
				'Driver:pair->reset_device(data, callback)+pairDevice', callback, pairDevice
			);
			resetDeviceInstance();

			return callback(null, pairDevice.deviceState);
		});

		socket.on('set_device', ({ data, settings, store, capabilities }, callback) => {
			this.logger.verbose(
				'Driver:pair->set_device(data, callback)+pairDevice', {
					data,
					settings,
					store,
					capabilities
				}, callback, pairDevice
			);
			if (this.getDevice(data)) {
				return callback(this.translateError(new Error('device_exists')));
			}
			pairDevice.setDeviceState({ data, settings, store, capabilities });
			const deviceObject = pairDevice.assembleDeviceObject();
			if (!deviceObject || deviceObject instanceof Error) {
				pairDevice.resetDeviceState();
				return callback(this.translateError(deviceObject || new Error('invalid_device_data')));
			}

			// this.emit('new_pair_device', pairDevice);
			return callback(null, pairDevice.deviceState);
		});

		socket.on('set_device_dipswitches', (dipswitches, callback) => {
			this.logger.verbose(
				'Driver:pair->set_device_dipswitches(dipswitches, callback)+pairDevice',
				dipswitches, callback, pairDevice
			);
			const data = pairDevice.constructor.dipswitchesToData(dipswitches.slice());
			if (!data) return callback(new Error('invalid_dipswitch'));
			const oldData = pairDevice.getData();
			pairDevice.setDeviceState({ data: Object.assign({ dipswitches }, data) });
			const deviceObject = pairDevice.assembleDeviceObject();
			if (!deviceObject || deviceObject instanceof Error) {
				pairDevice.setDeviceState({ data: oldData });
				return callback(this.translateError(deviceObject || new Error('invalid_device_data')));
			}

			// this.emit('new_pair_device', pairDevice);
			return callback(null, pairDevice.deviceState);
		});

		socket.on('set_device_codewheels', (codewheelIndexes, callback) => {
			this.logger.verbose(
				'Driver:pair->set_device_codewheels(codewheelIndexes, callback)+pairDevice',
				codewheelIndexes, callback, pairDevice
			);
			const data = pairDevice.constructor.codewheelsToData(codewheelIndexes.slice());
			if (!data) return callback(new Error('invalid_codewheelIndexes'));
			const oldData = pairDevice.getData();
			pairDevice.setDeviceState({ data: Object.assign({ codewheelIndexes }, data) });
			const deviceObject = pairDevice.assembleDeviceObject();
			if (!deviceObject || deviceObject instanceof Error) {
				pairDevice.setDeviceState({ data: oldData });
				return callback(this.translateError(deviceObject || new Error('invalid_device_data')));
			}

			// this.emit('new_pair_device', pairDevice);
			return callback(null, pairDevice.deviceState);
		});

		socket.on('get_device', (data, callback) => {
			this.logger.verbose(
				'Driver:pair->get_device(data, callback)+pairDevice', data, callback, pairDevice
			);
			callback(null, pairDevice.deviceState);
		});

		socket.on('program', (data, callback) => {
			this.logger.verbose(
				'Driver:pair->program(data, callback)+pairDevice', data, callback, pairDevice
			);
			const result = pairDevice.__generateData();
			if (result instanceof Error) return callback(result);

			// this.emit('new_pair_device', pairDevice);
			return callback(null, pairDevice.deviceState);
		});

		socket.on('program_send', (data, callback) => {
			this.logger.verbose(
				'Driver:pair->program_send(data, callback)+pairDevice', data, callback, pairDevice
			);
			if (!Object.keys(pairDevice.getData()).length || !pairDevice.assembleDeviceObject()) {
				const result = pairDevice.__generateData();
				if (result instanceof Error) return callback(result);
			}

			const testPayload = pairDevice.constructor.dataToPayload(pairDevice.getData());
			const testData = testPayload && testPayload.length ? pairDevice.constructor.payloadToData(testPayload) : null;
			if (testPayload && testData) {
				return Promise.resolve(pairDevice.sendProgramSignal())
					.then(() => callback(null, true))
					.catch(err => callback(this.translateError(err)));
			}
			this.error(`Generated device data could not be parsed to a payload! (device: ${
				JSON.stringify(pairDevice.getData())} -> payload: ${testPayload ? `[${testPayload.join(',')}]` : null
				} -> data: ${testData ? JSON.stringify(testData) : null}`);
			return callback(this.translateError(new Error('no_device')));
		});

		socket.on('test', (data, callback) => {
			this.logger.verbose('Driver:pair->test(data, callback)+pairDevice', data, callback, pairDevice);
			const deviceObject = pairDevice.assembleDeviceObject();
			if (!deviceObject || deviceObject instanceof Error) {
				return callback(this.translateError(deviceObject || new Error('invalid_device_data')));
			}
			callback(null, pairDevice.deviceState);
		});

		socket.on('override_device', (data, callback) => {
			if (!pairDevice) {
				return callback(this.translateError(new Error('no_device')));
			}
			if (!(data && data.constructor === Object)) {
				return callback(this.translateError(new Error('data_no_object')));
			}
			const newPairingDeviceData = Object.assign({}, pairDevice.getData(), data, { overridden: true });
			const payload = pairDevice.constructor.dataToPayload(newPairingDeviceData);
			if (!payload) return callback(this.translateError(new Error('pairdevice_invalid_data')));

			const frame = payload.map(Number);
			const dataCheck = pairDevice.constructor.payloadToData(frame);
			if (
				frame.find(isNaN) || !dataCheck ||
				dataCheck.constructor !== Object ||
				!pairDevice.matchesData(dataCheck)
			) {
				return callback(this.translateError(new Error('pairdevice_invalid_data')), pairDevice.deviceState);
			}
			pairDevice.setDeviceState({ data: newPairingDeviceData });
			callback(null, pairDevice.deviceState);
		});

		socket.on('done', (data, callback) => {
			this.logger.verbose('Driver:pair->done(data, callback)+pairDevice', data, callback, pairDevice);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));

			const deviceObject = pairDevice.assembleDeviceObject();
			if (!deviceObject || deviceObject instanceof Error) {
				return callback(this.translateError(deviceObject || new Error('invalid_device_data')));
			}
			if (this.getDevice(deviceObject.data)) {
				return callback(new Error('Could not add device because it is already paired. Please check your device overview.'));
			}

			return callback(null, deviceObject);
		});

		socket.on('send', (data, callback) => {
			this.logger.verbose('Driver:pair->send(data, callback)+pairDevice', data, callback, pairDevice);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));
			if (typeof data === 'string') return callback(this.translateError(new Error('invalid_send_data')))

			pairDevice.send(data)
				.then(() => callback())
				.catch(err => callback(this.translateError(err)));
		});

		socket.on('set_settings', (settings, callback) => {
			this.logger.verbose('Driver:pair->set_settings(settings, callback)+this.pairDevice', settings, callback, pairDevice);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));

			pairDevice.setDeviceState({ settings });
			callback(null, pairDevice.getSettings());
		});

		socket.on('set_setting', (data, callback) => {
			this.logger.verbose('Driver:pair->set_settings(data, callback)+this.pairDevice', data, callback, pairDevice);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));

			pairDevice.setSettings(data);
			callback(null, pairDevice.getSettings());
		});

		socket.on('get_settings', (data, callback) => {
			this.logger.verbose('Driver:pair->get_settings(data, callback)+this.pairDevice', data, callback, pairDevice);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));

			const deviceSettings = pairDevice.getSettings();
			const settings = this.getManifestSettings().map(setting => {
				setting.value = deviceSettings.hasOwnProperty(setting.id) ? deviceSettings[setting.id] : setting.value;
				return setting;
			});
			return callback(null, settings);
		});

		socket.on('get_setting', (data, callback) => {
			this.logger.verbose('Driver:pair->get_setting(data, callback)+this.pairDevice', data, callback, pairDevice);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));

			return callback(null, pairDevice.deviceState.settings[data]);
		});

		socket.on('set_capabilities', (capabilities, callback) => {
			this.logger.verbose('Driver:pair->set_capabilities(capabilities, callback)+this.pairDevice', capabilities, callback, pairDevice);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));

			pairDevice.setDeviceState({ capabilities });
			callback(null, pairDevice.getCapabilities());
		});

		socket.on('get_capabilities', (data, callback) => {
			this.logger.verbose('Driver:pair->get_capabilities(data, callback)+this.pairDevice', data, callback, pairDevice);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));

			callback(null, pairDevice.getCapabilities());
		});

		socket.on('has_capability', (capability, callback) => {
			this.logger.verbose('Driver:pair->has_capability(capability, callback)+this.pairDevice', capability, callback, pairDevice);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));

			callback(null, pairDevice.hasCapability(capability));
		});

		socket.on('emulate_frame', (data, callback) => {
			this.logger.verbose('Driver:pair->emulate_frame(data, callback)+this.pairDevice', data, callback, pairDevice);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));

			return callback(
				null,
				pairDevice.emit(
					'data',
					Object.assign({}, pairDevice.deviceState.data, pairDevice.getLastFrame() || {}, data || {})
				)
			);
		});

		socket.on('assert_device', (data, callback) => {
			this.logger.verbose('Driver:pair->assert_device(data, callback)+pairDevice', data, callback, pairDevice);
			pairDevice.assertDevice()
				.then(res => callback(null, pairDevice.deviceState))
				.catch(err => callback(this.translateError(err)));
		});

		socket.on('toggle', (capabilityId, callback) => {
			this.logger.verbose(
				'Driver:pair->toggle(capabilityId, callback)+pairDevice', capabilityId, callback, pairDevice
			);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));
			const deviceObject = pairDevice.assembleDeviceObject();
			if (!deviceObject || deviceObject instanceof Error) {
				return callback(this.translateError(deviceObject || new Error('pairdevice_not_complete')));
			}
			if (!pairDevice.hasCapability(capabilityId)) return callback(this.translateError(new Error(`pairdevice_does_not_have_capability_${capabilityId}`)));

			pairDevice.triggerCapabilityListener(capabilityId, !pairDevice.getCapabilityValue(capabilityId))
				.then(() => callback())
				.catch(err => callback(this.translateError(err)));
		});

		socket.on('capability', ({ id: capabilityId, value }, callback) => {
			this.logger.verbose(
				'Driver:pair->capability(data, callback)+pairDevice', { capabilityId, value }, callback, pairDevice
			);
			if (!pairDevice) return callback(this.translateError(new Error('no_device')));
			const deviceObject = pairDevice.assembleDeviceObject()
			if (!deviceObject || deviceObject instanceof Error) {
				return callback(this.translateError(deviceObject || new Error('pairdevice_not_complete')));
			}
			if (!pairDevice.hasCapability(capabilityId)) return callback(this.translateError(new Error(`pairdevice_does_not_have_capability_${capabilityId}`)));

			pairDevice.triggerCapabilityListener(capabilityId, value)
				.then(() => callback())
				.catch(err => callback(this.translateError(err)));
		});

		const highlightListener = data => {
			this.logger.verbose('emitting highlight to pairing wizard', data);
			socket.emit('highlight', data);
		};
		this.on('highlight', highlightListener);

		socket.on('disconnect', (data, callback) => {
			this.logger.verbose('Driver:pair->toggle(data, callback)+pairDevice', data, callback, pairDevice);
			pairDevice.destroy();
			this.logger.info('pair wizard closed');
			callback();
		});

		return new Proxy({}, {
			get: function (target, name) {
				if (typeof pairDevice[name] === 'function') {
					return pairDevice[name].bind(pairDevice);
				}
				return pairDevice[name];
			},
		});
	}

	/**
	 * Generates an object with flow configs from the manifest
	 * @param {Object} [options] The options object
	 * @param {Boolean} [options.onlyForDriver] If this function should filter cards to only cards that contain a 'device' argument for this driver, defaults to true.
	 * @param {Function} [filterFn] An optional filter function that is called for each matching flow config. Should return true to add tot the result or false to filter the flow config.
	 * @param {String[]} [types] The flow card types that should be returned. Defaults to all types (['triggers, 'conditions', 'actions']).
	 * @returns {Object[]} result An object containing an Array for each type with all configs that match given filters
	 */
	getFlowManifest({ onlyForDriver = true, filterFn, types = ['triggers', 'conditions', 'actions'] } = {}) {
		// Filters the manifest flow object for given types and returns a filtered object cointaining these types
		return types.map(type => {
			if (!(Homey.app.manifest.flow && Array.isArray(Homey.app.manifest.flow[type]))) return [];

			return Homey.app.manifest.flow[type]
				.filter(card => {
					if (!onlyForDriver) return true;

					return (card.args || []).some(arg =>
						arg.type === 'device' && arg.filter &&
						new RegExp(`driver_id=([^=&]*\|)?${this.id}($|&|\|)`, 'i').test(arg.filter)
					);
				})
				.filter(card => {
					if (typeof filterFn !== 'function') return true;

					return filterFn(card);
				});
		}).reduce((result, cardArray, index) => Object.assign(result, { [types[index]]: cardArray }), {});
	}

	/**
	 * Generates an Array with Trigger flow configs from the manifest
	 * @param {Object} [options] The options object
	 * @param {Boolean} [options.onlyForDriver] If this function should filter cards to only cards that contain a 'device' argument for this driver, defaults to true.
	 * @param {Function} [filterFn] An optional filter function that is called for each matching flow config. Should return true to add tot the result or false to filter the flow config.
	 * @returns {Object[]} configs An array containing all configs that match given filters
	 */
	getFlowTriggersManifest(opts) {
		return this.getFlowManifest(Object.assign({}, opts, { types: ['triggers'] })).triggers;
	}

	/**
	 * Generates an Array with Condition flow configs from the manifest
	 * @param {Object} [options] The options object
	 * @param {Boolean} [options.onlyForDriver] If this function should filter cards to only cards that contain a 'device' argument for this driver, defaults to true.
	 * @param {Function} [filterFn] An optional filter function that is called for each matching flow config. Should return true to add tot the result or false to filter the flow config.
	 * @returns {Object[]} configs An array containing all configs that match given filters
	 */
	getFlowConditionsrManifest(opts) {
		return this.getFlowManifest(Object.assign({}, opts, { types: ['conditions'] })).conditions;
	}

	/**
	 * Generates an Array with Action flow configs from the manifest
	 * @param {Object} [options] The options object
	 * @param {Boolean} [options.onlyForDriver] If this function should filter cards to only cards that contain a 'device' argument for this driver, defaults to true.
	 * @param {Function} [filterFn] An optional filter function that is called for each matching flow config. Should return true to add tot the result or false to filter the flow config.
	 * @returns {Object[]} configs An array containing all configs that match given filters
	 */
	getFlowActionsManifest(opts) {
		return this.getFlowManifest(Object.assign({}, opts, { types: ['actions'] })).actions;
	}
}

module.exports = RFDriver;
