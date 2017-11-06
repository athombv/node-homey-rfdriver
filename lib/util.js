'use strict';

const Homey = require('homey');

/**
 * @class Util
 */
class Util {

	/**
	 * Turns a bit string into a bit array
	 * @param {String} inputBitString a bit string only containing numbers
	 * @example
	 * // returns [0, 1, 1, 2, 0, 1]
	 * Util.bitStringToBitArray('011201');
	 * @returns {Number[]|Error} result The bitArray or a error object when invalid input is given
	 * @memberOf Util
	 */
	static bitStringToBitArray(inputBitString) {
		const bitArray = inputBitString.split('').map(Number);
		if (bitArray.find(isNaN)) {
			return new Error(`[Error] Bitstring (${inputBitString}) contains non-integer values`);
		}
		return bitArray;
	}


	/**
	 * Turns a bit array into a bit string
	 * @param {Number[]} inputBitArray a bit array only containing numbers
	 * @example
	 * // returns '011201'
	 * Util.bitArrayToString([0, 1, 1, 2, 0, 1]);
	 * @returns {String|Error} result The bitString or a error object when invalid input is given
	 * @memberOf Util
	 */
	static bitArrayToString(inputBitArray) {
		const bitArray = inputBitArray.map(Number);
		if (bitArray.find(isNaN)) {
			return new Error(`[Error] Bitarray (${inputBitArray}) contains non-integer values`);
		}
		return bitArray.join('');
	}

	/**
	 * Turns a bit array into a base-10 number
	 * @param {Number[]} inputBitArray a bit array only containing the numbers 0 and 1
	 * @example
	 * // returns 25
	 * Util.bitArrayToNumber([0, 1, 1, 0, 0, 1]);
	 * @returns {Number|Error} result The number representation or a error object when invalid input is given
	 * @memberOf Util
	 */
	static bitArrayToNumber(inputBitArray) {
		const bitArray = inputBitArray.map(Number);
		if (bitArray.find(nr => nr !== 0 && nr !== 1)) {
			return new Error(`[Error] Bitarray (${inputBitArray}) contains non-binary values`);
		}
		return parseInt(bitArray.join(''), 2);
	}

	/**
	 * Turns a number into a bit array
	 * @param {Number} inputNumber the number to turn into a base-2 bit array
	 * @param {Number} length the length that the result array should have (e.g. 8 bits)
	 * @example
	 * // returns [0, 1, 1, 0, 0, 1]
	 * Util.numberToBitArray(25, 6);
	 * @returns {Number[]|Error} result The bitArray or a error object when invalid input is given
	 * @memberOf Util
	 */
	static numberToBitArray(inputNumber, length) {
		const number = Number(inputNumber);
		if (isNaN(number) || number % 1 !== 0) {
			return new Error(`[Error] inputNumber (${inputNumber}) is a non-integer value`);
		}
		return number
			.toString(2)
			.padStart(length, '0')
			.slice(-length)
			.split('')
			.map(Number);
	}

	/**
	 * Calculates the XOR of two bit arrays and returns the result as a bit array
	 * @param {Number[]} arrayA a bit array only containing the numbers 0 and 1
	 * @param {Number[]} arrayB a second bit array of equal length which only contains the numbers 0 and 1
	 * @example
	 * // returns [0, 0, 1, 1, 0, 0]
	 * Util.bitArrayXOR([0, 1, 1, 0, 0, 1], [0, 1, 0, 1, 0, 1]);
	 * @returns {Number|Error} result The number representation or a error object when invalid input is given
	 * @memberOf Util
	 */
	static bitArrayXOR(arrayA, arrayB) {
		if (arrayA.length !== arrayB.length) {
			return new Error(`[Error] bitarrays [${arrayA}] and [${arrayB}] do not have the same length`);
		}
		if (arrayA.find(nr => nr !== 0 && nr !== 1) || arrayB.find(nr => nr !== 0 && nr !== 1)) {
			return new Error(`[Error] Bitarray [${arrayA}] and/or [${arrayB}] contain non-binary values`);
		}
		return arrayA.map((val, index) => val !== arrayB[index] ? 1 : 0);
	}

	/**
	 * Generates a random base-2 bit array
	 * @param {Number} length the length that the result array should have (e.g. 8 bits)
	 * @example
	 * // returns [0, 1, 1, 0, 0, 1]
	 * Util.generateRandomBitString(6);
	 * @returns {Number[]} result The bitArray
	 * @memberOf Util
	 */
	static generateRandomBitString(length) {
		return new Array(length)
			.fill(null)
			.map(() => Math.round(Math.random()))
			.join('');
	}

	/**
	 * Translation function that checks if the value is a translation object and if so returns the correct translation key
	 * @param {Object|String} subject The translation object or translation string
	 * @returns {String} result The result of the translation
	 */
	static __(subject) {
		if (typeof subject === 'object' && subject.constructor.name === 'Object') {
			return subject[Homey.ManagerI18n.getLanguage()] || subject['en'];
		}
		return Homey.__(subject);
	}
}

module.exports = Util;