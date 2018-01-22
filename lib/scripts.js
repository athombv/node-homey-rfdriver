'use strict';

const fse = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const semverDiff = require('semver-diff');
const mergeOptions = require('merge-options');

const localesFile = require('../locales');
const templateConfigFile = require('../templates/config');
const templateConfig = Object.keys(templateConfigFile).reduce((result, type) => {
	const configType = templateConfigFile[type];
	result[type] = Object.keys(configType)
		.reduce((typeConfig, key) => {
			typeConfig[key] = mergeOptions({}, configType[configType[key].extends] || {}, configType[key], { extends: null });
			return typeConfig;
		}, {});
	return result;
}, {});

const parseTemplateRegex = new RegExp(/<!--START OF TEMPLATE-->([\S\s]*)<!--END OF TEMPLATE-->/i);
const templateNameRegex = new RegExp(/^((433|868|ir|generic)_)?(.+)$/);
const templateCache = new Map();

module.exports = class Scripts {

	static run(config, rootDir) {
		Scripts.addLocales(config, localesFile);
		Scripts.addPermissionsToConfig(config);
		Scripts.copyAssets(rootDir);
		Scripts.checkTemplates(config, rootDir);
		return config;
	}

	static copyAssets(rootDir) {
		const assetsPath = path.join(rootDir, 'assets/RFDriver');
		fse.ensureDirSync(assetsPath);
		fse.emptyDirSync(assetsPath);
		fse.copySync(path.join(__dirname, '../assets'), assetsPath);
	}

	static checkTemplates(config, rootDir) {
		config.drivers.forEach(driver => {
			if (!driver.pair) return;
			const driverDir = path.join(rootDir, 'drivers', driver.id);
			const driverPairDir = path.join(driverDir, 'pair');
			const templateLockPath = path.join(driverPairDir, 'template-lock.json');
			const templateLock = fse.pathExistsSync(templateLockPath) ? fse.readJsonSync(templateLockPath) : {};

			driver.pair.map((view, index) => {
				if (!view.rf_template) return;
				const templateName = view.rf_template.match(templateNameRegex);
				const template = (templateName[2] ? templateConfig[templateName[2]][templateName[3]] : null) ||
					templateConfig.generic[templateName[3]];
				if (template) {
					view.id = view.id || templateName[3];
					const resultLock = Scripts.copyDriverTemplate(
						driver,
						template,
						path.join(driverPairDir, view.id + '.html'),
						templateLock[view.id],
					);
					if (resultLock) {
						templateLock[view.id] = resultLock;
					}
					return { view, template };
				} else {
					console.error(`Unable to find config for template ${view.rf_template}.`);
				}
			}).forEach(({ view, template } = {}, index) => {
				if (view && template) {
					Scripts.setTemplateOptions(config, template, view, index, driver);
				}
			});

			if (Object.keys(templateLock).length) {
				fse.writeJsonSync(templateLockPath, templateLock, { spaces: '\t' });
			}
			const commonPath = path.join(__dirname, '../common');
			const driverPath = path.join(driverDir, 'driver.js');
			const deviceFiles = [...new Set([driver.rf.deviceClass || 'device.js']
				.concat((driver.rf.devices || []).map(subDevice => subDevice.deviceClass || 'device.js')))];
			if (!fse.pathExistsSync(driverPath)) {
				fse.copySync(path.join(commonPath, 'driver.js'), driverPath);
			}
			deviceFiles.forEach(fileName => {
				if (!fileName) return;
				const devicePath = path.join(driverDir, fileName);
				if (!fse.pathExistsSync(devicePath)) {
					fse.copySync(path.join(commonPath, 'device.js'), devicePath);
				}
			});
		});
	}

	static copyDriverTemplate(driver, template, templatePath, templateLock) {
		fse.ensureFileSync(templatePath);
		const currTemplateString = fse.pathExistsSync(templatePath) ? fse.readFileSync(templatePath, 'utf8') : null;
		// let templateString = fse.readFileSync(path.join(__dirname, '../templates', template.template));
		// let templateChecksum = crypto.createHash('md5').update(templateString.match(parseTemplateRegex)[1]).digest('hex');
		if (currTemplateString && templateLock) {
			const versionBump = semverDiff(templateLock.version, template.version || '0.0.0');
			if (versionBump) {
				if (currTemplateString) {
					const currTemplateHashString = currTemplateString.match(parseTemplateRegex);
					if (!(currTemplateHashString && currTemplateHashString[1])) {
						console.log(`Template ${driver.id}:${template.id} corrupt and does not contain START and END template indicators.`);
						console.log(`Skipping ${driver.id}:${template.id} template update from ${templateLock.version} to ${template.version} (${versionBump} version).`);
						return;
					}
					if (crypto.createHash('md5').update(currTemplateHashString[1]).digest('hex') !== templateLock.hash) {
						console.log(`Skipping ${driver.id}:${template.id} template update from ${templateLock.version} to ${template.version} (${versionBump} version) because the template contains manual changes!`);
						return;
					}
					console.log(`Updating ${driver.id}:${template.id} template from ${templateLock.version} to ${template.version} (${versionBump} version).`);
					const templateString = Scripts.getTemplateFromPath(path.join(__dirname, '../templates', template.template));
					const templateHashString = templateString.match(parseTemplateRegex);
					const templateChecksum = crypto.createHash('md5').update(templateHashString[1]).digest('hex');
					currTemplateString.replace(currTemplateHashString[1], templateHashString[1]);
					fse.writeFileSync(templatePath, currTemplateString);
					return {
						version: template.version,
						hash: templateChecksum,
					}
				}
			} else {
				return;
			}
		}
		const templateString = Scripts.getTemplateFromPath(path.join(__dirname, '../templates', template.template));
		const templateHashString = templateString.match(parseTemplateRegex);
		const templateChecksum = crypto.createHash('md5').update(templateHashString[1]).digest('hex');
		if (currTemplateString) {
			const currTemplateHashString = currTemplateString.match(parseTemplateRegex);
			if (!(currTemplateHashString && currTemplateHashString[1])) {
				console.log(`Template ${driver.id}:${template.id} corrupt and does not contain START en END template indicators.`);
				console.log(`Skipping ${driver.id}:${template.id} template update to version ${template.version} because the template contains manual changes!`);
				return;
			}
			console.log(`Updating ${driver.id}:${template.id} template to version ${template.version}.`);
			fse.writeFileSync(templatePath, currTemplateString.replace(currTemplateHashString[1], templateHashString[1]));
			return {
				version: template.version,
				hash: templateChecksum,
			}
		}
		console.log(`Generating ${driver.id}:${template.id} template version ${template.version}`);
		fse.writeFileSync(templatePath, templateString);
		return {
			version: template.version,
			hash: templateChecksum,
		}
	}

	static getTemplateFromPath(templatePath) {
		if (!templateCache.has(templatePath)) {
			templateCache.set(templatePath, fse.readFileSync(templatePath, 'utf8'));
		}
		return templateCache.get(templatePath);
	}

	static setTemplateOptions(config, template, view, index, driver) {
		if (template.options && template.options.navigation) {
			view.navigation = view.navigation || {};
			if (!view.navigation.hasOwnProperty('prev') && template.options.navigation.prev) {
				const prevView = (driver.pair[index - 1] || {}).id;
				if (prevView) view.navigation.prev = prevView;
			}
			if (!view.navigation.hasOwnProperty('next') && template.options.navigation.next) {
				const nextView = (driver.pair[index + 1] || {}).id;
				if (nextView) view.navigation.next = nextView;
			}
		}
		if (template.locales) {
			Scripts.addLocales(config, template.locales, [driver, view, config]);
		}
	}

	static addLocales(config, locales, fnOpts) {
		const flattenValues = (obj) => {
			return Object.values(obj)
				.reduce((result, val) => result.concat(typeof val === 'object' ? flattenValues(val) : val), []);
		};
		const traverse = (obj, appLocale, path = []) => {
			for (const key in obj) {
				if (typeof obj[key] === 'function') {
					obj[key] = obj[key](...(fnOpts || [config]));
				}
				if (typeof obj[key] === 'string') {
					if (typeof appLocale[key] === 'string') {
						if (appLocale[key].slice(-1) !== '\u0000\u0000') {
							continue;
						}
					} else if (typeof appLocale[key] === 'object' && flattenValues(appLocale[key]).some(val => val.slice(-1) !== '\u0000\u0000')) {
						console.log(`Skipping manually edited locale at ${path.concat(key).join('.')}. Old value is an object with manually edited entries.`);
						continue;
					}
					appLocale[key] = `${obj[key]}\u0000\u0000`;
				} else if (typeof obj[key] === 'object') {
					if (typeof appLocale[key] === 'string' && appLocale[key].slice(-1) !== '\u0000\u0000') {
						console.log(`Skipping all keys after ${path.concat(key).join('.')} due to manual entry`);
						continue;
					}
					appLocale[key] = typeof appLocale[key] === 'object' ? appLocale[key] || {} : {};
					traverse(obj[key], appLocale[key], path.concat(key));
				}
			}
		};
		config.locales = config.locales || {};
		traverse(locales, config.locales);
	}

	static addPermissionsToConfig(config) {
		config.permissions = config.permissions || [];
		if (config.signals) {
			Object.keys(config.signals).forEach(signalType => {
				if (Object.values(config.signals[signalType]).length && config.permissions.indexOf(`homey:wireless:${signalType}`) === -1) {
					config.permissions.push(`homey:wireless:${signalType}`);
				}
			});
		}
	}
};
