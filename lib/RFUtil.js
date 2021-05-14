/* eslint-disable node/no-unsupported-features/node-builtins */
/* eslint-disable no-restricted-globals */

'use strict';

const util = require('util');

/**
 * @hideconstructor
 */
class RFUtil {

  /**
   * @param a
   * @param b
   * @returns {boolean}
   */
  static deepEqual(a, b) {
    return util.isDeepStrictEqual(a, b);
  }

  /**
   * Generates a random base-2 bit array
   * @param {Number} length the length that the result array should have (e.g. 8 bits)
   * @example
   * // returns [0, 1, 1, 0, 0, 1]
   * RFUtil.generateRandomBitString(6);
   * @returns {Number[]} result The bitArray
   */
  static generateRandomBitString(length) {
    return new Array(length)
      .fill(null)
      .map(() => Math.round(Math.random()))
      .join('');
  }

  /**
   * Turns a bit string into a bit array
   * @param {String} inputBitString a bit string only containing numbers
   * @example
   * // returns [0, 1, 1, 2, 0, 1]
   * RFUtil.bitStringToBitArray('011201');
   * @returns {Number[]|Error} result The bitArray
   */
  static bitStringToBitArray(inputBitString) {
    const bitArray = inputBitString.split('').map(Number);
    if (bitArray.find(isNaN)) {
      throw new Error(`[Error] Bitstring (${inputBitString}) contains non-integer values`);
    }
    return bitArray;
  }


  /**
   * Turns a bit array into a bit string
   * @param {Number[]} inputBitArray a bit array only containing numbers
   * @example
   * // returns '011201'
   * RFUtil.bitArrayToString([0, 1, 1, 2, 0, 1]);
   * @returns {String|Error} result The bitString
   */
  static bitArrayToString(inputBitArray) {
    const bitArray = inputBitArray.map(Number);
    if (bitArray.find(isNaN)) {
      throw new Error(`[Error] Bitarray (${inputBitArray}) contains non-integer values`);
    }
    return bitArray.join('');
  }

  /**
   * Turns a bit array into a base-10 number
   * @param {Number[]} inputBitArray a bit array only containing the numbers 0 and 1
   * @example
   * // returns 25
   * RFUtil.bitArrayToNumber([0, 1, 1, 0, 0, 1]);
   * @returns {Number} result The number representation
   */
  static bitArrayToNumber(inputBitArray) {
    const bitArray = inputBitArray.map(Number);
    if (bitArray.find(nr => nr !== 0 && nr !== 1)) {
      throw new Error(`[Error] Bitarray (${inputBitArray}) contains non-binary values`);
    }
    return parseInt(bitArray.join(''), 2);
  }

  /**
   * Turns a number into a bit array
   * @param {Number} inputNumber the number to turn into a base-2 bit array
   * @param {Number} length the length that the result array should have (e.g. 8 bits)
   * @example
   * // returns [0, 1, 1, 0, 0, 1]
   * RFUtil.numberToBitArray(25, 6);
   * @returns {Number[]} result The bitArray or a error object when invalid input is given
   */
  static numberToBitArray(inputNumber, length) {
    const number = Number(inputNumber);
    if (isNaN(number) || number % 1 !== 0) {
      throw new Error(`[Error] inputNumber (${inputNumber}) is a non-integer value`);
    }
    return number
      .toString(2)
      .padStart(length, '0')
      .slice(-length)
      .split('')
      .map(Number);
  }

  /**
   * Generates an UUID v4 String
   * @returns {String} uuid v4
   */
  static generateUUIDv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0; const
        v = c === 'x' ? r : ((r & 0x3) | 0x8);
      return v.toString(16);
    });
  }

}

module.exports = RFUtil;
