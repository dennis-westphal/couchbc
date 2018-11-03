export class Conversion {
	/**
	 * Get an uint8array buffer to use with eccrypto from a public point
	 * @param point
	 * @return {Uint8Array}
	 */
	static getUint8ArrayBufferFromPoint (point) {
		let arr = new Uint8Array(65)
		arr[0] = 4
		arr.set(point.x.toBuffer(), 1)
		arr.set(point.y.toBuffer(), 33)

		return Buffer(new Uint8Array(arr))
	}

	/**
	 * Get an uint8array buffer to use with eccrypto from a x and y 0x prefixed hex coordinates
	 * @param x
	 * @param y
	 * @return {Uint8Array}
	 */
	static getUint8ArrayBufferFromXY (x, y) {
		let arr = new Uint8Array(65)
		arr[0] = 4
		arr.set(this.hexToUint8Array(x.substr(2)), 1)
		arr.set(this.hexToUint8Array(y.substr(2)), 33)

		return Buffer(arr)
	}

	/**
	 * Convert a hex string to an Uint8 array
	 *
	 * @param hex
	 * @return {Uint8Array}
	 */
	static hexToUint8Array (hex) {
		return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
	}

	// Date
	/**
	 * Convert a date to a unix day integer
	 * @param date
	 * @returns {number}
	 */
	static dateToUnixDay (date) {
		return Math.floor(date.getTime() / (1000 * 60 * 60 * 24))
	}

	// Units
	/**
	 * Convert wei to eth
	 *
	 * @param wei
	 * @returns {number}
	 */
	static weiToEth (wei) {
		return Math.floor(wei / Math.pow(10, 15)) / Math.pow(10, 3)
	}

	/**
	 * Convert eth to wei
	 *
	 * @param eth
	 * @returns {number}
	 */
	static ethToWei (eth) {
		return eth * Math.pow(10, 18)
	}

	/**
	 * Convert wei to finney
	 *
	 * @param wei
	 * @returns {number}
	 */
	static weiToFinney (wei) {
		return Math.floor(wei / Math.pow(10, 15))
	}

	/**
	 * Convert finney to wei
	 *
	 * @param finney
	 * @returns {number}
	 */
	static finneyToWei (finney) {
		return finney * Math.pow(10, 15)
	}

	/**
	 * Convert finney to eth
	 *
	 * @param finney
	 * @returns {number}
	 */
	static finneyToEth (finney) {
		return finney / 1000
	}
}
