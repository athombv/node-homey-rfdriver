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
		this.logger.silly('Driver:onInit()');

		this.log(
			'Initializing driver with log level', this.logger.getLogLevelLabel(),
			'and capture level', this.logger.getCaptureLevelLabel()
		);

		// TODO re-enable and move to device.js
		// if (this.manifest.triggers && this.manifest.triggers.find(trigger => trigger.id === `${this.id}:received`)) {
		// 	this.on('device_frame_received', (device, data) => {
		// 		this.logger.verbose('Driver->device_frame_received(device, data)', device, data);
		// 		this.handleReceivedTrigger(device, data);
		// 	});
		// 	Homey.manager('flow').on(`trigger.${this.id}:received`, (callback, args, state) => {
		// 		this.logger.verbose(
		// 			`Driver->trigger.${this.id}:received(callback, args, state)`, callback, args, state
		// 		);
		// 		this.onTriggerReceived(callback, args, state);
		// 	});
		// }
		// if (this.manifest.actions && this.manifest.actions.find(actions => actions.id === `${this.id}:send`)) {
		// 	Homey.manager('flow').on(`action.${this.id}:send`, (callback, args) => {
		// 		this.logger.verbose(`Driver->action.${this.id}:send(callback, args)`, callback, args);
		// 		this.onActionSend(callback, args);
		// 	});
		// }
		// if (this.manifest.triggers) {
		// 	const cmdReceivedTrigger = this.manifest.triggers.find(trigger => trigger.id === `${this.id}:cmd_received`);
		// 	if (cmdReceivedTrigger) {
		// 		this.on('device_cmd_received', (device, cmd) => {
		// 			this.logger.verbose('Driver->device_cmd_received(device, cmd)', device, cmd);
		// 			this.handleCmdReceivedTrigger(device, cmd);
		// 		});
		// 		Homey.manager('flow').on(`trigger.${this.id}:cmd_received`, (callback, args, state) => {
		// 			this.logger.verbose(
		// 				`Driver->trigger.${this.id}:cmd_received(callback, args, state)`, callback, args, state
		// 			);
		// 			this.onTriggerCmdReceived(callback, args, state);
		// 		});
		// 		if ((cmdReceivedTrigger.args.find(arg => arg.name === 'cmd') || {}).type === 'autocomplete') {
		// 			Homey.manager('flow').on(`trigger.${this.id}:cmd_received.cmd.autocomplete`, (callback, args) => {
		// 				this.logger.verbose(
		// 					`Driver->trigger.${this.id}:cmd_received.cmd.autocomplete(callback, args)`, callback, args
		// 				);
		// 				this.onTriggerCmdReceivedAutocomplete(callback, args);
		// 			});
		// 		}
		// 	}
		// }
		// if (this.manifest.actions) {
		// 	const sendCmdAction = this.manifest.actions.find(actions => actions.id === `${this.id}:send_cmd`);
		// 	if (sendCmdAction) {
		// 		Homey.manager('flow').on(`action.${this.id}:send_cmd`, (callback, args) => {
		// 			this.logger.verbose(`Driver->action.${this.id}:send_cmd(callback, args)`, callback, args);
		// 			this.onActionSendCmd(callback, args);
		// 		});
		// 		if ((sendCmdAction.args.find(arg => arg.name === 'cmd') || {}).type === 'autocomplete') {
		// 			Homey.manager('flow').on(`action.${this.id}:send_cmd.cmd.autocomplete`, (callback, args) => {
		// 				this.logger.verbose(
		// 					`Driver->action.${this.id}:send_cmd.cmd.autocomplete(callback, args)`, callback, args
		// 				);
		// 				this.onActionSendCmdAutocomplete(callback, args);
		// 			});
		// 		}
		// 	}
		// }

		if (this.onRFInit) this.onRFInit();
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

	// TODO impelment flow card listeners below in device.js
	// handleReceivedTrigger(device, data) {
	// 	this.logger.silly('Driver:handleReceivedTrigger(device, data)', device, data);
	// 	if (data.id === device.id) {
	// 		Homey.manager('flow').triggerDevice(
	// 			`${this.id}:received`,
	// 			null,
	// 			Object.assign({}, { device: device }, data),
	// 			this.getDevice(device), err => {
	// 				if (err) Homey.error('Trigger error', err);
	// 			}
	// 		);
	// 	}
	// }
	//
	// handleCmdReceivedTrigger(device, cmd) {
	// 	this.logger.silly('Driver:handleCmdReceivedTrigger(device, data)', device, cmd);
	// 	Homey.manager('flow').triggerDevice(
	// 		`${this.id}:cmd_received`,
	// 		null,
	// 		{ cmd },
	// 		this.getDevice(device), err => {
	// 			if (err) Homey.error('Trigger error', err);
	// 		}
	// 	);
	// }
	//
	// onTriggerReceived(callback, args, state) {
	// 	this.logger.silly('Driver:onTriggerReceived(callback, args, state)', callback, args, state);
	// 	callback(null, Object.keys(args).reduce(
	// 		(result, curr) => result && String(args[curr]) === String(state[curr]),
	// 		true
	// 	));
	// }
	//
	// onTriggerCmdReceived(callback, args, state) {
	// 	this.logger.silly('Driver:onTriggerCmdReceived(callback, args, state)', callback, args, state);
	// 	callback(null, args.cmd.cmd === state.cmd);
	// }
	//
	// onTriggerCmdReceivedAutocomplete(callback, args) {
	// 	this.logger.silly('Driver:onTriggerCmdReceivedAutocomplete(callback, args, state)', callback, args);
	// 	const device = this.getDevice(args.args.device);
	// 	if (device) {
	// 		const cmdMap = this.getCmdsForDevice(device);
	// 		const resultList = [];
	// 		const query = args.query.toLowerCase();
	// 		for (const entry of cmdMap) {
	// 			if (entry[1].label.toLowerCase().indexOf(query) !== -1 || entry[0].toLowerCase().indexOf(query) !== -1) {
	// 				resultList.push({
	// 					name: entry[1].label,
	// 					cmd: entry[0],
	// 				});
	// 			}
	// 		}
	// 		callback(null, resultList.sort((a, b) => this.cmds.indexOf(a.cmd) - this.cmds.indexOf(b.cmd)));
	// 	} else {
	// 		callback('Could not find device');
	// 	}
	// }
	//
	// onActionSendCmdAutocomplete(callback, args) {
	// 	this.logger.silly('Driver:onTriggerSendCmdAutocomplete(callback, args, state)', callback, args);
	// 	this.onTriggerCmdReceivedAutocomplete(callback, args);
	// }
	//
	// onActionSend(callback, args) {
	// 	this.logger.silly('Driver:onActionSend(callback, args)', callback, args);
	// 	const device = this.getDevice(args.device);
	// 	if (device) {
	// 		this.send(device, args).then(() => callback(null, true)).catch(callback);
	// 	} else {
	// 		callback('Could not find device');
	// 	}
	// }
	//
	// onActionSendCmd(callback, args) {
	// 	this.logger.silly('Driver:onActionSendCmd(callback, args)', callback, args);
	// 	const device = this.getDevice(args.device);
	// 	if (device) {
	// 		this.sendCmd(device, args.cmd.cmd).then(() => callback(null, true)).catch(callback);
	// 	} else {
	// 		callback('Could not find device');
	// 	}
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
		const pairDevice = this.getPairDevice('default');
		pairDevice.on('data', receivedListener);
		pairDevice.on('send_pair', receivedListener);

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

		socket.on('set_device', ({ data, settings, store, capabilities }, callback) => {
			this.logger.verbose(
				'Driver:pair->set_device(data, callback)+pairDevice', data, callback, pairDevice
			);
			if (this.getDevice(data)) {
				return callback(new Error('generator.error.device_exists'));
			}
			pairDevice.setDeviceState({ data, settings, store, capabilities });
			if (!pairDevice.assembleDeviceObject()) {
				return callback(new Error('generator.error.invalid_device'));
			}

			// this.emit('new_pair_device', pairDevice);
			return callback(null, pairDevice.deviceState);
		});

		socket.on('set_device_dipswitches', (dipswitches, callback) => {
			this.logger.verbose(
				'Driver:pair->set_device_dipswitches(dipswitches, callback)+pairDevice',
				dipswitches, callback, pairDevice
			);
			const data = pairDevice.dipswitchesToData(dipswitches.slice());
			if (!data) return callback(new Error('generator.error.invalid_dipswitch'));
			const oldData = pairDevice.getData();
			pairDevice.setDeviceState({ data: Object.assign({ dipswitches }, data) });
			if (!pairDevice.assembleDeviceObject()) {
				pairDevice.setDeviceState({ data: oldData });
				return callback(new Error('generator.error.invalid_device'));
			}

			// this.emit('new_pair_device', pairDevice);
			return callback(null, pairDevice.deviceState);
		});

		socket.on('set_device_codewheels', (codewheelIndexes, callback) => {
			this.logger.verbose(
				'Driver:pair->set_device_codewheels(codewheelIndexes, callback)+pairDevice',
				codewheelIndexes, callback, pairDevice
			);
			const data = pairDevice.codewheelsToData(codewheelIndexes.slice());
			if (!data) return callback(new Error('generator.error.invalid_codewheelIndexes'));
			const oldData = pairDevice.getData();
			pairDevice.setDeviceState({ data: Object.assign({ codewheelIndexes }, data) });
			if (!pairDevice.assembleDeviceObject()) {
				pairDevice.setDeviceState({ data: oldData });
				return callback(new Error('generator.error.invalid_device'));
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
			const oldData = pairDevice.getData();
			const result = pairDevice.constructor.generateData();
			if (result instanceof Error) return callback(result);
			if (!Object.keys(pairDevice.getData()).length || !pairDevice.assembleDeviceObject()) {
				pairDevice.setDeviceState({ data: oldData });
			}

			// this.emit('new_pair_device', pairDevice);
			return callback(null, pairDevice.deviceState);
		});

		socket.on('program_send', (data, callback) => {
			this.logger.verbose(
				'Driver:pair->program_send(data, callback)+pairDevice', data, callback, pairDevice
			);
			pairDevice.setDeviceState({ data: pairDevice.constructor.generateData() });
			const testPayload = pairDevice.constructor.dataToPayload(pairDevice.getData());
			const testData = testPayload && testPayload.length ? pairDevice.constructor.payloadToData(testPayload) : null;
			if (testPayload && testData) {
				return Promise.resolve(pairDevice.sendProgramSignal())
					.then(() => callback(null, true))
					.catch(err => callback(err));
			}
			this.error(`Generated device data could not be parsed to a payload! (device: ${
				JSON.stringify(pairDevice.getData())} -> payload: ${testPayload ? `[${testPayload.join(',')}]` : null
				} -> data: ${testData ? JSON.stringify(testData) : null}`);
			return callback(new Error('generator.error.no_device'));
		});

		socket.on('test', (data, callback) => {
			this.logger.verbose('Driver:pair->test(data, callback)+pairDevice', data, callback, pairDevice);
			if (!pairDevice.assembleDeviceObject()) return callback(new Error('pairdevice_not_complete'));
			callback(null, pairDevice.deviceState);
		});

		socket.on('override_device', (data, callback) => {
			if (!pairDevice) {
				return callback(new Error('generator.error.no_device'));
			}
			if (!(data && data.constructor === Object)) {
				return callback(new Error('Data must be an object!'));
			}
			const newPairingDeviceData = Object.assign({}, pairDevice.getData(), data, { overridden: true });
			const payload = pairDevice.constructor.dataToPayload(newPairingDeviceData);
			if (!payload) {
				return callback(new Error('New pairing device data is invalid, changes are reverted.'));
			}
			const frame = payload.map(Number);
			const dataCheck = pairDevice.constructor.payloadToData(frame);
			if (
				frame.find(isNaN) || !dataCheck ||
				dataCheck.constructor !== Object ||
				!pairDevice.matchesData(dataCheck)
			) {
				return callback(new Error('New pairing device data is invalid, changes are reverted.'), pairDevice.deviceState);
			}
			pairDevice.setDeviceState({ data: newPairingDeviceData });
			callback(null, pairDevice.deviceState);
		});

		socket.on('done', (data, callback) => {
			this.logger.verbose('Driver:pair->done(data, callback)+pairDevice', data, callback, pairDevice);
			if (!pairDevice) {
				return callback(new Error('generator.error.no_device'));
			}
			return callback(null, pairDevice.assembleDeviceObject());
		});

		socket.on('send', (data, callback) => {
			this.logger.verbose('Driver:pair->send(data, callback)+pairDevice', data, callback, pairDevice);
			if (pairDevice) {
				pairDevice.send(data).then(callback.bind(null)).catch(callback);
			}
			return callback(new Error('generator.error.no_device'));
		});

		socket.on('set_settings', (settings, callback) => {
			this.logger.verbose('Driver:pair->set_settings(settings, callback)+this.pairDevice', settings, callback, pairDevice);
			if (pairDevice) {
				pairDevice.setDeviceState({ settings });
				callback(null, pairDevice.getSettings());
			} else {
				callback(new Error('generator.error.no_device'));
			}
		});

		socket.on('set_setting', (data, callback) => {
			this.logger.verbose('Driver:pair->set_settings(data, callback)+this.pairDevice', data, callback, pairDevice);
			if (pairDevice) {
				pairDevice.setSettings(data);
				callback(null, pairDevice.getSettings());
			} else {
				callback(new Error('generator.error.no_device'));
			}
		});

		socket.on('get_settings', (data, callback) => {
			this.logger.verbose('Driver:pair->get_settings(data, callback)+this.pairDevice', data, callback, pairDevice);
			if (!pairDevice) {
				return callback(new Error('generator.error.no_device'));
			}
			const deviceSettings = pairDevice.getSettings();
			const settings = this.getManifestSettings().map(setting => {
				setting.value = deviceSettings.hasOwnProperty(setting.id) ? deviceSettings[setting.id] : setting.value;
				return setting;
			});
			return callback(null, settings);
		});

		socket.on('get_setting', (data, callback) => {
			this.logger.verbose('Driver:pair->get_setting(data, callback)+this.pairDevice', data, callback, pairDevice);
			if (!pairDevice) {
				return callback(new Error('generator.error.no_device'));
			}
			return callback(null, pairDevice.deviceState.settings[data]);
		});

		socket.on('set_capabilities', (capabilities, callback) => {
			this.logger.verbose('Driver:pair->set_capabilities(capabilities, callback)+this.pairDevice', capabilities, callback, pairDevice);
			if (pairDevice) {
				pairDevice.setDeviceState({ capabilities });
				callback(null, pairDevice.getCapabilities());
			} else {
				callback(new Error('generator.error.no_device'));
			}
		});

		socket.on('get_capabilities', (data, callback) => {
			this.logger.verbose('Driver:pair->get_capabilities(data, callback)+this.pairDevice', data, callback, pairDevice);
			if (pairDevice) {
				callback(null, pairDevice.getCapabilities());
			} else {
				callback(new Error('generator.error.no_device'));
			}
		});

		socket.on('has_capability', (capability, callback) => {
			this.logger.verbose('Driver:pair->has_capability(capability, callback)+this.pairDevice', capability, callback, pairDevice);
			if (pairDevice) {
				callback(null, pairDevice.hasCapability(capability));
			} else {
				callback(new Error('generator.error.no_device'));
			}
		});

		socket.on('emulate_frame', (data, callback) => {
			this.logger.verbose('Driver:pair->emulate_frame(data, callback)+this.pairDevice', data, callback, pairDevice);
			if (!pairDevice) {
				return callback(new Error('generator.error.no_device'));
			}
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
				.catch(callback);
		});

		// TODO implement
		socket.on('toggle', (capabilityId, callback) => {
			this.logger.verbose(
				'Driver:pair->toggle(data, callback)+pairDevice', data, callback, pairDevice
			);
			if (!pairDevice) return callback(new Error('generator.error.no_device'));
			if (!pairDevice.assembleDeviceObject()) return callback(new Error('pairdevice_not_complete'));
			if (!pairDevice.hasCapability(capabilityId)) return callback(new Error(`pairdevice_does_not_have_capability_${capabilityId}`));

			pairDevice.triggerCapabilityListener(capabilityId, !pairDevice.getCapabilityValue(capabilityId))
				.then(() => callback())
				.catch(callback);
		});

		socket.on('capability', ({ id: capabilityId, value }, callback) => {
			this.logger.verbose(
				'Driver:pair->capability(data, callback)+pairDevice', { capabilityId, value }, callback, pairDevice
			);
			if (!pairDevice) return callback(new Error('generator.error.no_device'));
			if (!pairDevice.assembleDeviceObject()) return callback(new Error('pairdevice_not_complete'));
			if (!pairDevice.hasCapability(capabilityId)) return callback(new Error(`pairdevice_does_not_have_capability_${capabilityId}`));

			pairDevice.triggerCapabilityListener(capabilityId, value)
				.then(() => callback())
				.catch(callback);
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

		return pairDevice;
	}
}

module.exports = RFDriver;