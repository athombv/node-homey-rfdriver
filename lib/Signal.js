'use strict';

const Homey = require('homey');
const EventEmitter = require('events').EventEmitter;
const Debouncer = require('./Debouncer');

const signals = new Map();
const registerLock = new Map();
const registerPromises = new Map();
const unRegisterPromises = new Map();
const signalTypeMap = new Map([['433', Homey.Signal433], ['868', Homey.Signal868], ['ir', Homey.SignalInfrared]]);

const cmdStructureCache = new Map();
const splitCmdRegex = new RegExp(/^(?:(.*)\$~)?(.*?)(~\$(.*))?$/);


function getSignalType(id) {
	if (!Homey.manifest.signals) throw new Error('No signal in app.json');
	return ['433', '868', 'ir'].find(signal => Homey.manifest.signals[signal] && Homey.manifest.signals[signal][id]);
}

/**
 * @class Signal
 * @property {RFDevice} deviceClass - The RFDevice deviceclass to which this Signal instance is bound
 * @property {String} signalType - The type of signal this signal instance is for. Can be '433'|'868'|'ir'.
 * @property {Homey.Signal} signal - A Homey.Signal instance corresponding to this signal
 * @property {String} signalKey - The id of the signal as defined in app.json
 * @property {String} signalId - A Unique id for the signal
 * @property {Object} signalConfig - The manifest entry of the signal
 * @property {Object} options - The options of the signal as configured in the 'rf' property of the signal
 *
 * @fires Signal#cmd
 * @fires Signal#payload
 * @fires Signal#data
 * @fires Signal#payload_send
 * @fires Signal#cmd_send
 * @fires Signal#error
 */
class Signal extends EventEmitter {
	constructor({ signalType, signalKey, debounceTime, minTxInterval, dropPendingPayload, logger, deviceClass }) {
		super();
		this.logger = logger || {
				log: (() => null),
				silly: (() => null),
				debug: (() => null),
				verbose: (() => null),
				info: (() => null),
				warn: (() => null),
				error: (() => null),
			};
		this.logger.silly(
			'Signal:constructor({ signalType, signalKey, debounceTime, minTxInterval, logger, deviceClass })',
			signalType, signalKey, debounceTime, minTxInterval, logger, deviceClass
		);

		this.deviceClass = deviceClass;
		this.signalType = signalType || getSignalType(signalKey);
		this.signalKey = signalKey;
		this.signalId = `${this.signalType}_${this.signalKey}`;
		if (!(Homey.manifest.signals && Homey.manifest.signals[this.signalType] && Homey.manifest.signals[this.signalType][this.signalKey])) {
			throw new Error(`Signal config not found in app.json at signals.${this.signalType}.${this.signalKey} for ${this.deviceClass.constructor.name}`);
		}
		this.signalConfig = Homey.manifest.signals[this.signalType][this.signalKey];
		this.options = Object.assign({}, this.signalConfig.rf, { debounceTime, minTxInterval, dropPendingPayload });

		if (debounceTime !== undefined) this.options.debounceTime = debounceTime;
		if (minTxInterval !== undefined) this.options.minTxInterval = minTxInterval;

		if (!signalTypeMap.has(this.signalType)) throw new Error(`invalid signalType, please choose from [${[...signalTypeMap].map(e => e[0])}]`);

		this.debounceTimeout = this.options.debounceTime !== undefined ? Number(this.options.debounceTime) : 500;
		this.minTxInterval = this.options.minTxInterval !== undefined ? Number(this.options.minTxInterval) : 0;
		this.dropPendingPayload = Boolean(this.options.dropPendingPayload);
		this.lastTx = 0;

		if (!signals.has(this.signalId)) {
			if (!Homey.app) Homey.app = { manifest: Homey.manifest };
			const signal = new (signalTypeMap.get(this.signalType))(this.signalKey);

			signal.setMaxListeners(100);

			signal.debouncers = new Map();

			signals.set(this.signalId, signal);
			registerLock.set(this.signalId, new Set());
		}
		this.signal = signals.get(this.signalId);

		this.parseCmds();
		this._setDebouncers();

		this.signal.on('payload_send', this.emit.bind(this, 'payload_send'));
		this.signal.on('cmd_send', this.emit.bind(this, 'cmd_send'));
	}

	/**
	 * Fired when a new payload is received
	 * @event Signal#payload
	 * @property {Number[]} payload - The payload that was received
	 */

	/**
	 * Fired when a new cmd is received
	 * @event Signal#cmd
	 * @property {String} cmd - The key of the cmd received
	 */

	/**
	 * Fired when a new data object is received and parsed by this.{@link RFDevice|deviceClass}.{@link RFDevice.payloadToData|payloadToData} (after {@link Signal#event:payload} fired)
	 * @event Signal#data
	 * @property {Object} data - The data object received
	 * @property {Number[]} payload - The payload received
	 */

	/**
	 * Fired when a payload is send
	 * @event Signal#payload_send
	 * @property {Number[]} payload - The payload that was send
	 */

	/**
	 * Fired when a cmd is send
	 * @event Signal#cmd_send
	 * @property {String} cmd - The command that was send
	 */

	/**
	 * Fired when a error occured
	 * @event Signal#error
	 * @property {Error} err - The error that occurred
	 */

	parseCmds() {
		this.emulateToggleBits = this.signalConfig.type === 'prontohex' && this.options.emulateToggleBits;
		this.cmds = Object.keys(this.signalConfig.cmds || {});

		if (this.emulateToggleBits) {
			this.cmds = this.cmds.filter(cmd => cmd.indexOf('_1_') === -1);
		}
		// TODO add sortCmd function
		if (this.cmds && !this.options.disableAutoSort && this.sortCmd) {
			this.cmds = this.cmds.sort(this.sortCmd.bind(this, this.cmds.slice()));
		}
		if (!this.cmds.length) return;
		this.logger.debug('Cmd List:', this.cmds);

		if (!cmdStructureCache.has(this.signalId)) {
			this.cmdStructure = { types: { subTypes: {} }, subTypes: {} };
			const nonTranslated = this.cmds
				.map(this.parseCmdId.bind(this))
				.map(cmd => {
					if (cmd) {
						if (cmd.type) {
							this.cmdStructure.types[cmd.type] = this.cmdStructure.types[cmd.type] || { subTypes: {} };
							if (cmd.subType) {
								this.cmdStructure.types[cmd.type].subTypes[cmd.subType] = this.cmdStructure.types[cmd.type].subTypes[cmd.subType] || {}; // eslint-disable-line
								return this.cmdStructure.types[cmd.type].subTypes[cmd.subType][cmd.cmd] = {
									id: cmd.id,
									label: this.getCmdLabel(cmd),
								};
							} else {
								return this.cmdStructure.types[cmd.type][cmd.cmd] = {
									id: cmd.id,
									label: this.getCmdLabel(cmd),
								};
							}
						} else if (cmd.subType) {
							this.cmdStructure.subTypes[cmd.subType] = this.cmdStructure.subTypes[cmd.subType] || {};
							return this.cmdStructure.subTypes[cmd.subType][cmd.cmd] = {
								id: cmd.id,
								label: this.getCmdLabel(cmd),
							};
						} else {
							return this.cmdStructure[cmd.cmd] = {
								id: cmd.id,
								label: this.getCmdLabel(cmd),
							};
						}
					}
				})
				.filter(cmd => cmd.label.indexOf('\u0000\u0000') !== -1);

			if (nonTranslated.length) {
				this.logger.info('Missing translations for:');
				nonTranslated.reduce((list, cmd) => list.add(cmd.label), new Set()).forEach(cmd => this.logger.info(`${cmd}: '',`));
			}
			cmdStructureCache.set(this.signalId, this.cmdStructure);
		} else {
			this.cmdStructure = cmdStructureCache.get(this.signalId);
		}
	}

	parseCmdId(cmd) {
		const cmdParts = (splitCmdRegex.exec(cmd) || []).filter(Boolean);
		if (cmdParts.length === 2) {
			return {
				id: cmd,
				cmd: cmdParts[1],
			};
		} else if (cmdParts.length === 3) {
			return {
				id: cmd,
				type: cmdParts[1],
				cmd: cmdParts[2],
			};
		} else if (cmdParts.length === 5) {
			return {
				id: cmd,
				type: cmdParts[1],
				cmd: cmdParts[2],
				subType: cmdParts[4],
			};
		} else if (cmdParts.length === 4) {
			return {
				id: cmd,
				cmd: cmdParts[1],
				subType: cmdParts[3],
			};
		}
		return null;
	}

	_setDebouncers() {
		// Add debounce event for timeout if there is none
		if (!this.signal.debouncers.has(this.debounceTimeout)) {
			this.signal.debouncers.set(this.debounceTimeout, new Map());
			this.debounceBuffer = this.signal.debouncers.get(this.debounceTimeout);
			this.signal.on('payload', payload => {
				const payloadStr = payload.join('');
				this.logger.debug(`[Signal ${this.signalId} ~${this.debounceTimeout}] raw payload:`, payloadStr);
				const debouncer = this.debounce(payload);
				if (debouncer) {
					if (debouncer instanceof Debouncer) debouncer.pause();

					this.logger.info(`[Signal ${this.signalId} ~${this.debounceTimeout}] payload:`, payloadStr);
					this.signal.emit(`debounce_payload_${this.debounceTimeout}`, payload);

					if (debouncer instanceof Debouncer) debouncer.reset();
				}
			});
			this.signal.on('cmd', cmd => {
				this.logger.debug(`[Signal ${this.signalId} ~${this.debounceTimeout}] raw command:`, cmd);
				const debouncer = this.debounce(cmd);
				if (debouncer) {
					debouncer.pause();
					this.logger.info(`[Signal ${this.signalId} ~${this.debounceTimeout}] command:`, cmd);
					if (!this.manualDebounceFlag && !this.signal.manualDebounceFlag) {
						this.emit('cmd', cmd);
						this.emit('cmdObj', this.getCmd(cmd));
					} else {
						this.logger.verbose(`[Signal ${this.signalId}] Manually debounced command:`, cmd);
					}
					debouncer.reset();
				}
			});

			setInterval(() => {
				for (const entry in this.debounceBuffer) {
					const debouncer = entry[1];
					if (debouncer && debouncer.state === Debouncer.FINISHED) {
						this.debounceBuffer.delete(entry[0]);
					}
				}
			}, 60000);
		} else {
			this.debounceBuffer = this.signal.debouncers.get(this.debounceTimeout);
		}

		this.signal.on(`debounce_payload_${this.debounceTimeout}`, payloadData => { // Start listening to payload event
			if (!this.manualDebounceFlag && !this.signal.manualDebounceFlag) {
				if (true || registerLock.get(this.signalId).has(this)) {
					// Copy array to prevent mutability issues with multiple drivers
					const payload = Array.from(payloadData).map(Number);
					this.emit('payload', payload);
					if (this.deviceClass) {
						const data = this.deviceClass.payloadToData(payload.slice());
						if (data) this.emit('data', data, payload);
					}
				}
			} else {
				this.logger.verbose(`[Signal ${this.signalId}] Manually debounced payload:`, payloadData.join(''));
			}
		});
	}

	/**
	 * Registers this signal at Homey for given key. The signal is only unregistered at Homey if {@link Signal#unregister|unregister} is called for all keys.
	 * @param {*} key A key that is unique
	 * @returns {Promise} result A promise that resolves when the signal is registered at Homey.
	 */
	register(key) {
		this.logger.silly('Signal:register(key)', key);

		if (registerLock.get(this.signalId).size === 0) {
			this.logger.info(`[Signal ${this.signalId}] registered signal`);
			registerLock.get(this.signalId).add(key || this);

			registerPromises.set(
				this.signalId,
				(unRegisterPromises.get(this.signalId) || Promise.resolve())
					.then(() =>
						this.signal.register()
							.catch(err => { // Register signal
								this.logger.error(err, { extra: { registerLock, registerPromises } });
								return Promise.reject(err);
							})
					)
			);
		} else {
			registerLock.get(this.signalId).add(key || this);
		}

		return registerPromises.get(this.signalId)
			.catch(err => {
				registerLock.get(this.signalId).delete(key || this);
				return Promise.reject(err);
			});
	}

	/**
	 * Unregisters this signal key. The signal is only unregistered at Homey if this function is called for all registered keys.
	 * @param {*} key The unique key that is used to call {@link Signal#register}
	 */
	unregister(key) {
		this.logger.silly('Signal:unregister(key)', key);
		if (registerLock.get(this.signalId).size > 0) {
			registerLock.get(this.signalId).delete(key || this);
			if (registerLock.get(this.signalId).size === 0 && !unRegisterPromises.get(this.signalId)) {
				this.logger.info(`[Signal ${this.signalId}] unregistered signal`);

				(registerPromises.get(this.signalId) || Promise.resolve()).then(() => {
					if (registerLock.get(this.signalId).size === 0) {
						unRegisterPromises.set(
							this.signalId,
							this.signal.unregister()
								.catch(err => {
									// Log errors but other than that just ignore them
									this.logger.error(err, { extra: { registerLock, registerPromises } });
								})
								.then(() => unRegisterPromises.delete(this.signalId))
						);
					}
				});
			}
		}
	}

	/**
	 * Function that can be called to drop all incoming packets for a given period of time
	 * @param {Number} timeout How long incoming packets should be dropped
	 * @param {Boolean} [allListeners] If packets should be dropped for all listeners on this Homey signal or only this instance that uses the Homey signal instance.
	 */
	manualDebounce(timeout, allListeners) {
		this.logger.silly('Signal:manualDebounce(timeout, allListeners)', timeout, allListeners);
		if (allListeners) {
			this.signal.manualDebounceFlag = true;
			clearTimeout(this.signal.manualDebounceTimeout);
			this.signal.manualDebounceTimeout = setTimeout(() => this.signal.manualDebounceFlag = false, timeout);
		} else {
			this.manualDebounceFlag = true;
			clearTimeout(this.manualDebounceTimeout);
			this.manualDebounceTimeout = setTimeout(() => this.manualDebounceFlag = false, timeout);
		}
	}

	/**
	 * Sends a payload array
	 * @param {Number[]} payload The payload array to send
	 * @param {Object} [options] The transmission options for sending the payload
	 * @param {Number} [options.repetitions] A custom amount of repetitions
	 * @returns {Promise} result A promise that resolves when the payload is send.
	 */
	send(payload, options) {
		this.logger.silly('Signal:send(payload)', payload);
		if (!Array.isArray(payload) && typeof payload === 'object') {
			const res = this.deviceClass.dataToPayload(payload);
			if (!res) {
				throw new Error(`Unable to send data object: ${payload}, payload invalid: ${res}`);
			}
			payload = res;
		}
		if (!payload) {
			throw new Error(`Unable to send, invalid payload: ${payload}`);
		}
		let registerLockKey = Math.random();
		while (registerLock.get(this.signalId).has(registerLockKey)) {
			registerLockKey = Math.random();
		}
		return this.register(registerLockKey)
			.then(() => {
				const sendTx = () =>
					this.signal.tx(payload, options)
						.then(result => {
							this.logger.info(`[Signal ${this.signalId}] send payload:`, payload.join(''));
							this.signal.emit('payload_send', payload);
							return result;
						})
						.catch(err => {
							this.logger.warn(`[Signal ${this.signalId}] sending payload failed:`, err);
							return Promise.reject(err);
						});

				if (this.minTxInterval) {
					if ((Date.now() - this.lastTx) < this.minTxInterval) {
						if (this.dropPendingPayload && this.rejectPendingPayload) {
							this.rejectPendingPayload();
						} else {
							this.lastTx += this.minTxInterval;
						}
						this.logger.info(`[Signal ${this.signalId}] delayed payload due to minTxInterval for ${this.lastTx - Date.now()} ms`);

						return new Promise((res, rej) => {
							this.rejectPendingPayload = () => {
								this.rejectPendingPayload = null;
								rej('debounced');
							};
							setTimeout(() => res(), this.lastTx - Date.now());
						})
							.then(() => {
								this.rejectPendingPayload = null;
								return sendTx();
							});

					}
					this.lastTx = Date.now();
				}

				return sendTx();
			})
			.then(() => this.unregister(registerLockKey))
			.catch(err => {
				this.unregister(registerLockKey);
				if (err === 'debounced') return Promise.reject(err);
				this.logger.error(err, { extra: { registerLock, registerPromises } });
				this.emit('error', err);
				throw err;
			});
	}

	/**
	 * Sends a command
	 * @param {String} cmd The command to send
	 * @param {Object} [options] The transmission options for sending the payload
	 * @param {Number} [options.repetitions] A custom amount of repetitions
	 * @returns {Promise} result A promise that resolves when the command is send.
	 */
	sendCmd(cmd, options) {
		this.logger.verbose('Signal:sendCmd(cmd)', cmd);
		const registerLockKey = this.getRandomLockKey();
		return this.register(registerLockKey).then(() => {
			let sendCmd = cmd;
			if (this.emulateToggleBits) {
				const cmdKeyObj = this.parseCmdId(cmd);
				sendCmd = `${cmdKeyObj.type ? `${cmdKeyObj.type}$~` : ''
					}${cmdKeyObj.cmd}${this.shouldToggle() ? '_1_' : ''
					}${cmdKeyObj.subType ? `~$${cmdKeyObj.subType}` : ''}`;
				if (!this.getCmd(sendCmd)) {
					sendCmd = cmd;
				}
			}
			return new Promise((resolve, reject) => {
				const send = () => this.signal.cmd(sendCmd, options, (err, result) => { // Send the cmd to device
					if (err) { // Print error if there is one
						this.logger.warn(`[Signal ${this.signalId}] sending cmd "${sendCmd}" failed:`, err);
						reject(err);
					} else {
						this.logger.info(`[Signal ${this.signalId}] send cmd:`, sendCmd);
						this.signal.emit('cmd_send', sendCmd);
						resolve(result);
					}
				});
				if (this.minTxInterval) {
					if ((Date.now() - this.lastTx) < this.minTxInterval) {
						if (this.dropPendingPayload && this.rejectPendingPayload) {
							this.rejectPendingPayload();
						} else {
							this.lastTx += this.minTxInterval;
						}
						this.logger.info(`[Signal ${this.signalId}] delayed payload due to minTxInterval for ${this.lastTx - Date.now()} ms`);

						return new Promise((res, rej) => {
							this.rejectPendingPayload = () => {
								this.rejectPendingPayload = null;
								rej('debounced');
							};
							setTimeout(() => res(), this.lastTx - Date.now());
						})
							.then(() => {
								this.rejectPendingPayload = null;
								return send();
							});

					}
					this.lastTx = Date.now();
				}

				return send();
			});
		}).then(() => this.unregister(registerLockKey))
			.catch(err => {
				this.unregister(registerLockKey);
				if (err === 'debounced') return Promise.reject(err);
				this.logger.error(err, { extra: { registerLock, registerPromises } });
				this.emit('error', err);
				throw err;
			});
	}


	pauseDebouncers() {
		this.logger.silly('Signal:pauseDebouncers()');
		this.signal.debouncers.forEach(debounceBuffer => {
			debounceBuffer.forEach(debouncer => {
				debouncer.pause();
			});
		});
	}

	resumeDebouncers() {
		this.logger.silly('Signal:resumeDebouncers()');
		this.signal.debouncers.forEach(debounceBuffer => {
			debounceBuffer.forEach(debouncer => {
				debouncer.resume();
			});
		});
	}

	/**
	 * Directly call the tx method of signal without checking if the signal is registered. Usage of this function is not recommended!
	 * @param {Number[]} payload The payload array
	 * @param {Function} callback The callback function that is called by Homey.Signal.tx
	 */
	tx(payload, options) {
		this.logger.silly('Signal:tx(payload, options)', payload, options);
		const frameBuffer = new Buffer(payload);
		return this.signal.tx(frameBuffer, options);
	}

	debounce(payload) {
		this.logger.silly('Signal:debounce(payload)', payload);
		if (this.debounceTimeout <= 0) return payload;

		const payloadString = Array.isArray(payload) ? payload.join('') : payload;
		if (!this.debounceBuffer.has(payloadString)) {
			const debouncer = new Debouncer(this.debounceTimeout, () => this.debounceBuffer.delete(payloadString));
			this.debounceBuffer.set(
				payloadString,
				debouncer
			);
			return debouncer;
		}
		const debouncer = this.debounceBuffer.get(payloadString);
		if (debouncer.state === Debouncer.FINISHED) {
			debouncer.reset();
			return debouncer;
		}

		if (debouncer.state !== Debouncer.PAUSED) {
			debouncer.reset();
		}
		return null;
	}

	getRandomLockKey() {
		let registerLockKey = Math.random();
		while (registerLock.get(this.signalId).has(registerLockKey)) {
			registerLockKey = Math.random();
		}
		return registerLockKey;
	}

	shouldToggle() {
		this.toggleBool = !this.toggleBool;
		return this.toggleBool;
	}

	getCmd(cmdObj) {
		cmdObj = typeof cmdObj === 'string' ? this.parseCmdId(cmdObj) : cmdObj;
		const getCmdCacheItem = () => {
			if (this.cmdStructure.types[cmdObj.type]) {
				if (this.cmdStructure.types[cmdObj.type].subTypes[cmdObj.subType]
					&& this.cmdStructure.types[cmdObj.type].subTypes[cmdObj.subType][cmdObj.cmd]
				) {
					return this.cmdStructure.types[cmdObj.type].subTypes[cmdObj.subType][cmdObj.cmd];
				} else if (this.cmdStructure.types[cmdObj.type][cmdObj.cmd]) {
					return this.cmdStructure.types[cmdObj.type][cmdObj.cmd];
				}
			}
			if (this.cmdStructure.subTypes[cmdObj.subType] && this.cmdStructure.subTypes[cmdObj.subType][cmdObj.cmd]) {
				return this.cmdStructure.subTypes[cmdObj.subType][cmdObj.cmd];
			}
			if (this.cmdStructure[cmdObj.cmd]) {
				return this.cmdStructure[cmdObj.cmd];
			}
		};
		const result = getCmdCacheItem();
		if (result) return Object.assign({}, cmdObj, result);
		return null;
	}

	static getTranslation(key){
		const result = Homey.__(key);
		return result === key || result.startsWith('key \'') ? null : result
	}

	getCmdLabel(cmdObj) {
		cmdObj = typeof cmdObj === 'string' ? this.parseCmdId(cmdObj) : cmdObj;
		let result = (this.getCmd(cmdObj) || {}).label;
		if (result) {
			return result;
		}
		if (!result && cmdObj.type && cmdObj.subType) {
			result = this.constructor.getTranslation(`rf.commands.${cmdObj.type}.${cmdObj.cmd}.${cmdObj.subType}`);
		}
		if (!result && cmdObj.type) {
			result = this.constructor.getTranslation(`rf.commands.${cmdObj.type}.${cmdObj.cmd}.default`);
			if (!result) {
				result = this.constructor.getTranslation(`rf.commands.${cmdObj.type}.${cmdObj.cmd}`);
			}
		}
		if (!result && cmdObj.subType) {
			result = this.constructor.getTranslation(`rf.commands.${cmdObj.cmd}.${cmdObj.subType}`);
		}
		if (!result) {
			result = this.constructor.getTranslation(`rf.commands.${cmdObj.cmd}.default`);
		}
		if (!result) {
			result = this.constructor.getTranslation(`rf.commands.${cmdObj.cmd}`);
		}
		if (!result) {
			return `${cmdObj.cmd}\u0000\u0000`;
		}
		return result;
	}
}

module.exports = Signal;
