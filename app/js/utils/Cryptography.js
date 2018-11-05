import { Conversion } from './Conversion'
import { Web3Util } from './Web3Util'
import { Notifications } from './Notifications'
import { default as uniqid } from 'uniqid'
import { salt } from '../credentials'

// Elliptic for elliptic curve cryptography
const EC = require('elliptic').ec
const ec = new EC('secp256k1')

// Eccrypto for ECIES
const eccrypto = require('eccrypto')

export class Cryptography {
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
			// TODO: Implement asking for password
			let password = 'secret'

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
		window.localStorage.setItem('ecAccounts.' + bcAccount.address, ecAccount.address)

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
		let ecAccountAddress = window.localStorage.getItem('ecAccounts.' + bcAddress)

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

		// This is the same: (eccrypto always adds 04 in front of x and y point of public key)
		// console.log('0x' + Buffer(eccrypto.getPublic(privateKey)).toString('hex'));
		// console.log('0x04' + (keyPair.getPublic().x.toString(16)) + (keyPair.getPublic().y.toString(16)));

		let pkHex = '0x' + privateKey.toString('hex')
		let account = Web3Util.web3.eth.accounts.privateKeyToAccount(pkHex)
		let xHex = '0x' + publicKey.x.toString(16)
		let yHex = '0x' + publicKey.y.toString(16)

		// Save the account in the wallet
		wallet.add(account)
		wallet.save(this.walletPassword)

		return {
			private: pkHex,
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
	 * @return {Promise<Buffer>}
	 */
	static async encryptString (str, publicKeyBuffer) {
		console.debug('Encrypting ' + str + ' with:', publicKeyBuffer)

		// Encrypt the message
		let result = await eccrypto.encrypt(publicKeyBuffer, Buffer(str))

		// Retrieve the elements of the encrypted message and pack them into an serializable object
		let message = [
			result.iv.toString('hex'),
			result.ephemPublicKey.toString('hex'),
			result.ciphertext.toString('hex'),
			result.mac.toString('hex')
		]
		let jsonStr = JSON.stringify(message)

		console.debug('Encryption successful: ', jsonStr)

		return jsonStr
	}

	/**
	 * Decrypt the string using the supplied private key buffer
	 *
	 * @param str
	 * @param privateKeyBuffer
	 * @return {Promise<Buffer>}
	 */
	static async decryptString (str, privateKeyBuffer) {
		console.debug('Trying to decrypt ' + str + ' with:', privateKeyBuffer)

		try {
			// Extract the elements of the json string and convert them to Buffers
			let arr = JSON.parse(str)
			let message = {
				iv:             Buffer(Conversion.hexToUint8Array(arr[0])),
				ephemPublicKey: Buffer(Conversion.hexToUint8Array(arr[1])),
				ciphertext:     Buffer(Conversion.hexToUint8Array(arr[2])),
				mac:            Buffer(Conversion.hexToUint8Array(arr[3]))
			}

			// Try to decrypt the message
			let result = await eccrypto.decrypt(privateKeyBuffer, message)
			let resultString = result.toString()

			console.debug('Decryption successful: ', resultString)

			return resultString
		} catch (e) {
			console.debug('Decryption failed; returning null')
			return null
		}
	}

	/**
	 * Get a random 64 char hex string
	 *
	 * @returns {*}
	 */
	static getRandomString () {
		return Web3Util.web3.utils.sha3(uniqid() + salt + uniqid() + Math.round(Math.random() * Math.pow(10, 20))).substr(2)
	}
}
