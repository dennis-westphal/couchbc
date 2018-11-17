import { default as IpfsApi } from 'ipfs-api'
import { ipfsHost, ipfsGatewayUrl, ipnsResolveTimeout, ipfsNsPath } from '../constants'
import { default as bs58 } from 'bs58'
import { Cryptography } from './Cryptography'
import { default as $ } from 'jquery'

export class IpfsUtil {
	/**
	 * Get an IpfsApi connection
	 */
	static getConnection () {
		if (this.connection) {
			return this.connection
		}

		this.connection = IpfsApi(ipfsHost)

		return this.connection
	}

	/**
	 * Upload a string to IPFS. Returns the IPFS address of the string.
	 * @param str
	 * @return {Promise<string>}
	 */
	static async uploadString (str) {
		console.debug('Uploading string ', str)

		// Get an IPFS connection
		let ipfsConnection = this.getConnection()

		// Fill a file buffer with the string
		let filledBuffer = Buffer(str)

		return new Promise((resolve, reject) => {
			// Add the file to IPFS
			ipfsConnection.files.add(filledBuffer, (err, result) => {
				if (err) {
					console.error(err)

					reject()
					throw('Could not upload image to IPFS: ' + err)
				}

				console.debug('String uploaded to ' + result[0].hash)

				resolve(result[0].hash)
			})
		})
	}

	/**
	 * Upload an image from an HTML input element to IPFS. Returns the IPFS address of the image.
	 *
	 * @param inputElement
	 * @return {Promise<string>}
	 */
	static async uploadImage (inputElement) {
		// Return a promise that is resolved if the image upload succeeded
		return new Promise((resolve, reject) => {
			let reader = new window.FileReader()
			reader.onloadend = () => {
				// Get an IPFS connection
				let ipfsConnection = this.getConnection()

				// Fill a file buffer
				let filledBuffer = Buffer(reader.result)

				// Add the file to IPFS
				ipfsConnection.files.add(filledBuffer, (err, result) => {
					if (err) {
						console.error(err)

						reject()
						throw('Could not upload image to IPFS: ' + err)
					}

					console.debug('Image uploaded to ' + result[0].hash)

					resolve(result[0].hash)
				})
			}

			reader.readAsArrayBuffer(inputElement.files[0])
		})
	}

	/**
	 * Download a string from an IPFS address
	 *
	 * @param ipfsAddr
	 * @return {Promise<string>}
	 */
	static async downloadString (ipfsAddr) {
		// Return a promise that is resolved with the ipfs string downloaded
		return new Promise((resolve, reject) => {
			let ipfsConnection = this.getConnection()

			// Get the string from IPFS
			ipfsConnection.files.get(ipfsAddr, (err, files) => {
				if (err) {
					console.error(err)

					reject()
					// TODO: Catch exceptions in user initiated root function (problem: async/Promise!)
					throw('Could not download data from IPFS: ' + err)
				}

				resolve(files[0].content)
			})
		})
	}

	/**
	 * Download JSON encoded from the supplied SHA256 hex hash referencing an IPFS address, optionally decrypting it in the process
	 *
	 * @param hexHash   SHA256 hex encoded 0x prefixed hash
	 * @param ecAccount EC account used for decryption or null
	 * @return {Promise<object>}
	 */
	static async downloadDataFromHexHash (hexHash, ecAccount) {
		let ipfsAddress = this.hexHashToIpfsAddr(hexHash)

		let str = await this.downloadString(ipfsAddress)

		if (ecAccount) {
			str = await Cryptography.decryptString(str, ecAccount.private.buffer)
		}

		return JSON.parse(str)
	}

	/**
	 * Upload data, optionally encrypting it in the process. Returns the prefixed SHA256 hex hash part of IPFS address.
	 * If a single public key (buffer) is supplied, the message is encoded using that buffer.
	 * If an array of public key (buffers) is supplied, the message will be encrypted with all public keys and
	 * can be decrypted with any of the corresponding private keys
	 *
	 * @param data   Data that will be JSON-encoded and uploaded (encrypted)
	 * @param publicKeyBuffers Buffer containing one public key to be used for encryption, or array with all public key buffers
	 * @return {Promise<string>}
	 */
	static async uploadData (data, publicKeyBuffers) {
		let str = JSON.stringify(data)

		// Check if we got an array; if so encrypt using multiple public keys
		if (typeof publicKeyBuffers === 'object' && Array.isArray(publicKeyBuffers)) {
			str = await Cryptography.encryptStringMulti(str, publicKeyBuffers)
		} else if (publicKeyBuffers) {
			str = await Cryptography.encryptString(str, publicKeyBuffers)
		}

		let ipfsAddress = await this.uploadString(str)

		return this.ipfsAddrToHash(ipfsAddress)
	}

	/**
	 * Publish the specified data on IPNS. Returns the permanent hash for the key.
	 *
	 * @param hexHash
	 * @param keyName
	 * @returns {Promise<string>}
	 */
	static async publishOnIpns (keyName, hexHash) {
		let ipfsAddress = this.hexHashToIpfsAddr(hexHash)

		// Create the key
		let id = await this.getOrCreateKey(keyName)

		// Get an IPFS connection
		let ipfsConnection = this.getConnection()

		// Publish on IPNS
		await new Promise(resolve => {
			ipfsConnection.name.publish(ipfsAddress, {
				key: keyName
			}, (err, data) => {
				if (err) {
					console.error(err)
					throw('Could not publish data on IPNS')
				}

				resolve()
			})
		})

		return this.ipfsAddrToHash(id)
	}

	/**
	 * Resolve an IPNS hex hash to a IPFS hex hash
	 *
	 * @param hexHash
	 * @returns {Promise<string>}
	 */
	static async resolveFromIpns (hexHash) {
		let ipnsAddress = '/ipns/' + this.hexHashToIpfsAddr(hexHash)

		// Get an IPFS connection
		let ipfsConnection = this.getConnection()

		return new Promise(resolve => {
			ipfsConnection.name.resolve(ipnsAddress, {
				timeout: ipnsResolveTimeout
			}, (err, name) => {
				if (err) {
					console.error(err)
					throw('Could not resolve IPNS address')
				}

				let ipfsHash = IpfsUtil.ipfsAddrToHash(name.substr(6))

				resolve(ipfsHash)
			})
		})
	}

	/**
	 * Get the key with the specified name from the IPFS server, or create it.
	 * Keys are managed by IPFS servers, thus anybody with access to the server's API is able to modify content published at the return id.
	 * Returns the id of the key (IPFS address)
	 *
	 * @param name
	 * @returns {Promise<string>}
	 */
	static async getOrCreateKey (name) {
		// Get an IPFS connection
		let ipfsConnection = this.getConnection()

		// Try to fetch the key if it already exists
		let key = await new Promise(resolve => {
			ipfsConnection.key.list((err, keys) => {
				if (err) {
					console.error(err)
					throw('Could not fetch IPNS keys')
				}

				// Check all existing key if an id matches
				for (let key of keys) {
					if (key.name === name) {
						resolve(key.id)
						return
					}
				}

				resolve()
			})
		})

		// If we found a key (id), return it
		if (key) {
			console.debug('Found key with name ' + name, key)

			return key
		}

		// Otherwise, create a new key and return its id
		return await new Promise(resolve => {
			ipfsConnection.key.gen(name, {
				type: 'rsa', // EC keys no supported by IPNS
				size: 2048
			}, (err, key) => {
				if (err) {
					console.error(err)
					throw('Could not create IPNS key')
				}

				console.debug('Created key with name ' + name, key)
				resolve(key.id)
			})
		})
	}

	/**
	 * Download data referenced at the specified mutable IPFS NS hash
	 *
	 * @param id
	 * @returns {Promise<Object>}
	 */
	static async resolveFromIpfsNs (id) {
		let hexHash = await $.get(ipfsNsPath + id)
		console.debug('Got ipfs hex hash ' + hexHash + ' from IPFS NS')

		return hexHash
	}

	/**
	 * Add an address to IPFS NS at the specified ID and protect it with the specified public key.
	 * Modifications to the address at the specified ID will require a signed message following this.
	 *
	 * @param id
	 * @param hexHash
	 * @param ecAccount
	 * @returns {Promise<string>}
	 */
	static async addToIpfsNs (id, hexHash, ecAccount) {
		console.debug('Adding address ' + hexHash + ' to ' + id + ' using public key', ecAccount.public)

		return new Promise(resolve => {
			$.ajax({
				url:         ipfsNsPath + id,
				method:      'post',
				data:        JSON.stringify({
					address:    hexHash,
					publicKeyX: ecAccount.public.x.substr(2),
					publicKeyY: ecAccount.public.y.substr(2)
				}),
				contentType: 'application/json',
				success:     hash => {
					console.debug('Added IPFS NS ID ' + id + ' with hex hash ' + hexHash)
					resolve(hash)
				}
			})
		})
	}

	/**
	 * Update the address at the specified id. Adds a signature for authentication using the specified ecAccount.
	 *
	 * @param id
	 * @param hexHash
	 * @param ecAccount
	 * @returns {Promise<string>}
	 */
	static async updateOnIpfsNs (id, hexHash, ecAccount) {
		let signature = Cryptography.dsaSign(id + '-' + hexHash, ecAccount)

		console.debug('Updating address ' + hexHash + ' for ' + id + ' using signature ' + signature + ' from public key ', ecAccount.public)

		return new Promise(resolve => {
			$.ajax({
				url:         ipfsNsPath + id,
				method:      'put',
				data:        JSON.stringify({
					address:   hexHash,
					signature: signature
				}),
				contentType: 'application/json',
				success:     hash => {
					console.debug('Updated IPFS NS ID ' + id + ' with hex hash ' + hexHash)
					resolve(hash)
				}
			})
		})
	}

	/**
	 * Get an image URL for an IPFS image, using the specified address (either multihash or 0x prefixed hex hash)
	 *
	 * @param address
	 * @return {string}
	 */
	static getImageUrl (address) {
		// Check if we need to decode an IPFS hex hash
		if (address.substr(0, 2) === '0x') {
			return ipfsGatewayUrl + this.hexHashToIpfsAddr(address)
		}

		return ipfsGatewayUrl + address
	}

	// IPFS utilities
	/**
	 * Get a hex 0x prefixed hash from an IPFS address. Should only be used with SHA256 addresses.
	 *
	 * @param address
	 * @return {string}
	 */
	static ipfsAddrToHash (address) {
		return '0x' + (bs58.decode(address).slice(2).toString('hex'))
	}

	/**
	 * Get an IPFS address from an hex 0x prefixed hash. Should only be used with SHA256 hashes.
	 *
	 * @param hexHash
	 * @return {string}
	 */
	static hexHashToIpfsAddr (hexHash) {
		return bs58.encode(Buffer.from('1220' + hexHash.substr(2), 'hex'))
	}
}
