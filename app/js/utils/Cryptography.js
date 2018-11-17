import { Conversion } from './Conversion'
import { Web3Util } from './Web3Util'
import { Notifications } from './Notifications'
import { default as uniqid } from 'uniqid'
import { salt } from '../credentials'
import AES from 'crypto-js/aes'

// Elliptic for elliptic curve cryptography
const EC = require('elliptic').ec
const ec = new EC('secp256k1')
const SHA256 = require('crypto-js/sha256')

// Eccrypto for ECIES
const eccrypto = require('eccrypto')

export class Cryptography {
	/**
	 * Request a password from the user. For test purposes, always returns "secret".
	 * In production, should instead display a modal and ask for the password.
	 * @param name
	 * @returns {Promise<string>}
	 */
	static async getUserPassword (name) {
		return 'secret'
	}

	/**
	 * Get the wallet. Asks user for password if wallet hasn't been decrypted or created yet
	 *
	 * @return {web3.eth.accounts.wallet}
	 */
	static async getWallet () {
		if (this.wallet) {
			return this.wallet
		}

		// Check if we have a wallet; if so, ask user for password
		if (window.localStorage.getItem('web3js_wallet')) {
			let password = await this.getUserPassword('Wallet password')

			let wallet = Web3Util.web3.eth.accounts.wallet.load(password)

			// TODO: Retry password till we have a wallet

			this.walletPassword = password
			this.wallet = wallet
			return wallet
		}

		// Otherwise, ask user to specify password for new wallet
		// TODO: Implement asking for password
		let password = 'secret'

		this.walletPassword = password
		this.wallet = Web3Util.web3.eth.accounts.wallet.create()

		return this.wallet
	}

	/**
	 * Get or create an EC account to be used in association with the bc address
	 * Returns an object with:
	 * {
	 *   private: {
	 *       hex:       "0x0000...",     (0x + 64 hex encoded bytes) = 130 chars
	 *       buffer:    Uint8Array(129)  Buffer to be used with eccrypto
	 *   }
	 *   public: {
	 *       x:         "0x0000...",     (0x + 32x hex encoded bytes = 66 chars)
	 *       y:         "0x0000...",     (0x + 32y bytes hex = 66 chars)
	 *       buffer:    Uint8Array(65)   Buffer to be used with eccrypto
	 *   }
	 *   address:     "0x0000..."        (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
	 * }
	 */
	static async getOrCreateEcAccount (bcAccount) {
		if (typeof bcAccount.address === 'undefined') {
			console.error('Invalid bcAccount', bcAccount)

			return null
		}

		// Try to catch the ec account associated with the address
		let ecAccount = await this.getEcAccountForBcAccount(bcAccount.address)

		// Check if we found an EC account; if we did, return the public key
		if (ecAccount != null) {
			return ecAccount
		}

		// Check if the account is already registered at the blockchain as owner or tenant account;
		// in this case we should already have a public key for it => show an error
		if (bcAccount.type === 'owner' || bcAccount.type === 'tenant') {
			Notifications.show('Could not get public key for existing ' + bcAccount.type + ' account')

			return null
		}

		// Otherwise, generate an EC account
		ecAccount = await this.generateEcAccount()

		// Store the EC account address in local storage to associate it with the current bc account
		window.localStorage.setItem('ecAccount.' + bcAccount.address, ecAccount.address)

		// Return the account
		return ecAccount
	}

	/**
	 * Get the EC account associated with the specified blockchain address in local storage.
	 * Returns null if no account is associated with the address or an object with:
	 * {
	 *   private: {
	 *       hex:       "0x0000...",     (0x + 64 hex encoded bytes) = 130 chars
	 *       buffer:    Uint8Array(129)  Buffer to be used with eccrypto
	 *   }
	 *   public: {
	 *       x:         "0x0000...",     (0x + 32x hex encoded bytes = 66 chars)
	 *       y:         "0x0000...",     (0x + 32y bytes hex = 66 chars)
	 *       buffer:    Uint8Array(65)   Buffer to be used with eccrypto
	 *   }
	 *   address:     "0x0000..."        (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
	 * }
	 */
	static async getEcAccountForBcAccount (bcAddress) {
		// Local storage is acting as hashmap: BC account address => EC account address

		// The account address is used to find the key; the address contained within is NOT the same as the account address
		let ecAccountAddress = window.localStorage.getItem('ecAccount.' + bcAddress)

		if (ecAccountAddress) {
			return await this.getEcAccount(ecAccountAddress)
		}

		return null
	}

	/**
	 * Get an EC account for the given EC account address from the wallet
	 *
	 * Returns null if no Ec account was found or an object with:
	 * {
	 *   private: {
	 *       hex:       "0x0000...",     (0x + 64 hex encoded bytes) = 130 chars
	 *       buffer:    Uint8Array(129)  Buffer to be used with eccrypto
	 *   }
	 *   public: {
	 *       x:         "0x0000...",     (0x + 32x hex encoded bytes = 66 chars)
	 *       y:         "0x0000...",     (0x + 32y bytes hex = 66 chars)
	 *       buffer:    Uint8Array(65)   Buffer to be used with eccrypto
	 *   }
	 *   address:     "0x0000..."        (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
	 * }
	 */
	static async getEcAccount (address) {
		// Get the wallet
		let wallet = await this.getWallet()

		// Check if an Ec account exists at the address
		if (typeof wallet[address] === 'undefined') {
			return null
		}

		return this.getEcAccountForWalletAccount(wallet[address])
	}

	/**
	 * Generate a new account used for EC cryptography.
	 * Stores the generated account in the user's encrypted wallet.
	 *
	 * Returns an object with:
	 * {
	 *   private: {
	 *       hex:       "0x0000...",     (0x + 64 hex encoded bytes) = 130 chars
	 *       buffer:    Uint8Array(129)  Buffer to be used with eccrypto
	 *   }
	 *   public: {
	 *       x:         "0x0000...",     (0x + 32x hex encoded bytes = 66 chars)
	 *       y:         "0x0000...",     (0x + 32y bytes hex = 66 chars)
	 *       buffer:    Uint8Array(65)   Buffer to be used with eccrypto
	 *   }
	 *   address:     "0x0000..."
	 *     (0x + 32 bytes hex address as would be used in blockchain account. Can be used for signature validation and to fetch account from wallet.)
	 * }
	 */
	static async generateEcAccount () {
		// Get the wallet
		let wallet = await this.getWallet()

		let keyPair = ec.genKeyPair()

		let privateKey = keyPair.getPrivate().toBuffer()
		let publicKey = keyPair.getPublic()

		let pkHex = '0x' + privateKey.toString('hex')
		let account = Web3Util.web3.eth.accounts.privateKeyToAccount(pkHex)
		let xHex = '0x' + publicKey.x.toString(16).padStart(64, 0) // String padding needed as otherwise hex numbers starting with 0 will be cut off
		let yHex = '0x' + publicKey.y.toString(16).padStart(64, 0)

		// Save the account in the wallet
		wallet.add(account)
		wallet.save(this.walletPassword)

		return {
			private: {
				hex:    pkHex,
				buffer: privateKey
			},
			public:  {
				x:      xHex,
				y:      yHex,
				buffer: Conversion.getUint8ArrayBufferFromXY(xHex, yHex)
			},
			address: account.address
		}
	}

	/**
	 * Get an EC account for the specified wallet account.
	 * Does not save or fetch the account from the wallet; the EC account is purely generated in memory.
	 *
	 * Returns an object with:
	 * {
	 *   private: {
	 *       hex:       "0x0000...",     (0x + 64 hex encoded bytes) = 130 chars
	 *       buffer:    Uint8Array(129)  Buffer to be used with eccrypto
	 *   }
	 *   public: {
	 *       x:         "0x0000...",     (0x + 32x hex encoded bytes = 66 chars)
	 *       y:         "0x0000...",     (0x + 32y bytes hex = 66 chars)
	 *       buffer:    Uint8Array(65)   Buffer to be used with eccrypto
	 *   }
	 *   address:     "0x0000..."        (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
	 * }
	 *
	 * @param account
	 * @return {{private: {hex: string, buffer: Uint8Array}, public: {x: string, y: string, buffer: Uint8Array}, address: string}}
	 */
	static getEcAccountForWalletAccount (account) {
		// Get the public key for the private key
		let privateKeyArray = Conversion.hexToUint8Array(account.privateKey.substr(2))

		let publicKeyHex = Buffer(eccrypto.getPublic(privateKeyArray)).toString('hex')

		let xHex = '0x' + publicKeyHex.substr(2, 64)
		let yHex = '0x' + publicKeyHex.substr(66)

		return {
			private: {
				hex:    account.privateKey,
				buffer: Buffer(privateKeyArray)
			},
			public:  {
				x:      xHex,
				y:      yHex,
				buffer: Conversion.getUint8ArrayBufferFromXY(xHex, yHex)
			},
			address: account.address
		}
	}

	/**
	 * Encrypt the string using the supplied public key buffer
	 *
	 * @param str
	 * @param publicKeyBuffer
	 * @return {Promise<string>}
	 */
	static async encryptString (str, publicKeyBuffer) {
		console.debug('Encrypting ' + str + ' with:', publicKeyBuffer)

		// Encrypt the string and get the encrypted message
		let message = await this._getEncryptedMessage(str, publicKeyBuffer)

		let jsonStr = JSON.stringify(message)

		console.debug('Encryption successful: ', jsonStr)

		return jsonStr
	}

	/**
	 * Encrypt the string using all of the supplied public key buffers.
	 * Creates a shared key (AES) which is used for encryption of the actual data and encrypts the shared key with the public key.
	 * Using an AES key for the actual encryption is faster than generating a new public/private key pair.
	 *
	 * @param str
	 * @param publicKeyBuffers
	 * @return {Promise<string>}
	 */
	static async encryptStringMulti (str, publicKeyBuffers) {
		console.debug('Encrypting ' + str + ' with: ', publicKeyBuffers)

		// Generate a shared key
		let sharedKey = this.getRandomString()

		console.debug('Using shared key ' + sharedKey + ' for AES content encryption and public keys for encryption of shared key')

		// Encrypt the string with the shared key
		let cipherText = AES.encrypt(str, sharedKey)

		// Encrypt the shared key with all publicKeyBuffers
		let messages = []
		for (let publicKeyBuffer of publicKeyBuffers) {
			messages.push(await this._getEncryptedMessage(sharedKey, publicKeyBuffer))
		}

		// Return a string representation of a multidimensional array containing the ciphertext and the messages (with the encrypted shared key)
		let jsonStr = JSON.stringify([
			cipherText,
			messages
		])

		console.debug('Encryption successful: ', jsonStr)

		return jsonStr
	}

	/**
	 * Encrypt a string and return an encrypted message. Should only be used internally.
	 *
	 * @param str
	 * @param publicKeyBuffer
	 * @returns {Promise<string[]>}
	 * @private
	 */
	static async _getEncryptedMessage (str, publicKeyBuffer) {
		// Encrypt the message
		let result = await eccrypto.encrypt(publicKeyBuffer, Buffer(str))

		// Retrieve the elements of the encrypted message and pack them into an serializable object
		return [
			result.iv.toString('hex'),
			result.ephemPublicKey.toString('hex'),
			result.ciphertext.toString('hex'),
			result.mac.toString('hex')
		]
	}

	/**
	 * Decrypt the string using the supplied private key buffer
	 *
	 * @param str
	 * @param privateKeyBuffer
	 * @return {Promise<string>}
	 */
	static async decryptString (str, privateKeyBuffer) {
		console.debug('Trying to decrypt ' + str)

		// Parse the json array
		let json = JSON.parse(str)

		// Check if we we have a two dimensional array;
		// in this case we got a cipher text containing an AES secret and messages with the encrypted AES key
		// Decrypt the string accordingly
		if (json.length === 2) {
			console.debug('Trying to decrypt AES shared key', json[0])

			// Try to decrypt the AES shared key from all pubkey encrypted messages
			for (let messageArray of json[1]) {
				let sharedKey = await this._decryptMessageArray(messageArray, privateKeyBuffer)

				// When the sharedKey is not null, we have found the key and can attempt to decrypt the cipher text with it
				if (sharedKey) {
					let result = AES.decrypt(json[0], sharedKey).toString()

					console.debug('Decryption using shared key ' + sharedKey + ' done:', result)

					return result
				}
			}
		}

		// If we got an array with 4 elements, we got a regular pubkey encrypted message
		if (json.length === 4) {
			return await this._decryptMessageArray(json, privateKeyBuffer)
		}

		// Otherwise, something is not right with the string; log an error and return null
		console.error('Unrecognized string format:', json)
	}

	/**
	 * Try to decrypt the string with all of the provided private key buffers. Returns null of encryption failed.
	 *
	 * @param str
	 * @param privateKeyBuffers
	 * @returns {Promise<string>}
	 */
	static async decryptStringMulti (str, privateKeyBuffers) {
		for (let privateKeyBuffer of privateKeyBuffers) {
			let result = await this.decryptString(str, privateKeyBuffer)

			if (result) {
				return result
			}
		}

		return null
	}

	static async _decryptMessageArray (messageArray, privateKeyBuffer) {
		console.debug('Using private key for decryption', privateKeyBuffer)

		try {
			// Extract the elements of the array and convert them to Buffers
			let message = {
				iv:             Buffer(Conversion.hexToUint8Array(messageArray[0])),
				ephemPublicKey: Buffer(Conversion.hexToUint8Array(messageArray[1])),
				ciphertext:     Buffer(Conversion.hexToUint8Array(messageArray[2])),
				mac:            Buffer(Conversion.hexToUint8Array(messageArray[3]))
			}

			// Try to decrypt the message
			let result = await eccrypto.decrypt(privateKeyBuffer, message)
			let resultString = result.toString()

			console.debug('Decryption successful:', resultString)

			return resultString
		} catch (e) {
			console.debug(e)
			console.debug('Decryption failed; returning null.')
			return null
		}
	}

	/**
	 * Get a DSA signature for the provided string. Returns a JSON encoded string with r & s as unprefixed hex
	 *
	 * @param str
	 * @param ecAccount
	 * @returns {string}
	 */
	static dsaSign (str, ecAccount) {
		// Get the key pair
		let keyPair = ec.keyFromPrivate(ecAccount.private.hex.substr(2))

		// Get the message hash
		let messageHash = SHA256(str).words

		let signature = keyPair.sign(messageHash)

		return JSON.stringify({
			r: signature.r.toString(16),
			s: signature.s.toString(16)
		})
	}

	/**
	 * Fetch a value from local storage and decrypt it using the supplied AES secret
	 *
	 * @param key
	 * @param secret
	 * @returns {string|null}
	 */
	static getLocalEncrypted (key, secret) {
		let value = window.localStorage.getItem(key)

		if (value == null || value.length === 0) {
			return null
		}

		return AES.decrypt(value, secret)
	}

	/**
	 * Set a value in local storage and encrypt it using the supplied AES secret
	 *
	 * @param key
	 * @param value
	 * @param secret
	 */
	static setLocalEncrypted (key, value, secret) {
		let encrypted = AES.encrypt(value, secret)

		window.localStorage.setItem(key, encrypted)
	}

	/**
	 * Get a random 32 byte (0x prefixed) hex string (=> 66 chars)
	 *
	 * @returns {*}
	 */
	static getRandomString () {
		return '0x' + Web3Util.web3.utils.sha3(uniqid() + salt + uniqid() + Math.round(Math.random() * Math.pow(10, 20))).substr(2)
	}
}
