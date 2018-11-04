import { Loading } from '../components/Loading'
import { Cryptography } from '../utils/Cryptography'
import { PubSub } from '../utils/PubSub'
import { Conversion } from '../utils/Conversion'
import { Apartment } from './Apartment'
import { Web3Util } from '../utils/Web3Util'
import { IpfsUtil } from '../utils/IpfsUtil'
import { default as uniqid } from 'uniqid'

export class Rental {
	constructor () {
		this.id = 0
		this.interactionPublicKey_x = ''
		this.interactionPublicKey_y = ''
		this.interactionAddress = ''

		this.detailsIpfsHash = ''
		this.detailsHash = ''
		this.detailsForMediatorIpfsHash = ''
		this.contactDataIpfsHash = ''
		this.contactDataForMediatorIpfsHash = ''

		this.fee = 0
		this.deposit = 0

		this.tenant = ''
		this.mediator = ''

		this.status = ''
		this.depositStatus = ''

		this.depositDeduction = ''

		this.details = {}
		this.detailsForMediator = {}
		this.ownerData = {}
		this.ownerDataForMediator = {}
	}

	static async addRequest (account, data) {
		let rental = new Rental()
		rental.tenant = account.address
		rental.details.apartment = data.apartment
		rental.details.fromDay = data.fromDay
		rental.details.tillDay = data.tillDay
		rental.details.contact = data.contact
		rental.fee = data.fee
		rental.deposit = data.deposit
		rental.status = 'pending'

		// TODO: Assign manually
		Object.assign(rental, data)

		// Show the load message. Wait for the response, as following steps might freeze the browser for a second.
		await Loading.show('Adding rental request')

		// Get or create the tenant ec account
		Loading.add('account', 'Initializing elliptic cryptography account')
		let ecAccount = await Cryptography.getOrCreateEcAccount(account)
		Loading.success('account')

		// Subscribe to the answer topic
		Loading.add('subscribe', 'Subscribing to interaction key responses')
		PubSub.subscribeToTopic(
			'issue-interaction-key',

			// Decrypt response with own EC account => private key
			ecAccount.address
		).then(() => {
			Loading.success('subscribe')
		})

		// Send a new interaction key request
		Loading.add('publish', 'Sending encrypted interaction key request')
		await PubSub.publishMessage(
			// Send the tenants public key
			JSON.stringify({
				x: ecAccount.public.x,
				y: ecAccount.public.y
			}),

			// Topic to send the message to
			'request-interaction-key',

			// Encrypt with owner's interaction key
			Conversion.getUint8ArrayBufferFromXY(rental.apartment.ownerPublicKey_x, rental.apartment.ownerPublicKey_y)
		)
		Loading.success('publish')

		// Add the request to the pending requests
		Loading.add('save', 'Saving pending rental requests')
		rental.saveInLocalStorage()
		Loading.success('save')

		Loading.hide()

		return rental
	}

	/**
	 * Save the (pending) rental request in local storage to allow restoring it after a browser refresh
	 */
	saveInLocalStorage () {
		let pendingRentalRequests = JSON.parse(window.localStorage.setItem('pendingRentalRequests') || '[]')

		pendingRentalRequests.push({
			// Assign a unique id to the request so we know which one to remove from local storage later on
			id:        uniqid(),
			tenant:    this.tenant,
			apartment: this.apartment.id,
			fee:       this.fee,
			deposit:   this.deposit,
			details:   this.details
		})

		// Save the tenant's data in local storage for autocompletion of further actions
		window.localStorage.setItem('userName', this.details.contact.name)
		window.localStorage.setItem('userPhone', this.details.contact.phone)
		window.localStorage.setItem('userEmail', this.details.contact.email)

		// Save the requests in local storage
		window.localStorage.setItem('pendingRentalRequests', JSON.stringify(pendingRentalRequests))
	}

	/**
	 * Send the request for the rental to the blockchain
	 *
	 * @returns {Promise<*>}
	 */
	async sendRequest () {
		// Show the load message. Wait for the response, as following steps might freeze the browser for a second.
		await Loading.show('Sending rental request')

		Loading.add('account', 'Fetching or creating tenant account')
		let ecAccount = Cryptography.getOrCreateEcAccount(this.tenant)
		Loading.success('account')

		// Get a public key buffer from the interaction key for encryption of the details
		let
			publicKeyBuffer = Conversion.getUint8ArrayBufferFromXY(this.interactionPublicKey_x, this.interactionPublicKey_y)

		Loading.add('upload', 'Uploading details to IPFS')
		let detailsIpfsAddress = await IpfsUtil.uploadData(this.details, publicKeyBuffer)
		this.detailsIpfsHash = IpfsUtil.ipfsAddrToHash(detailsIpfsAddress)
		Loading.success('upload')

		Loading.add('compile', 'Compiling data')
		let detailsString = JSON.stringify(this.details)
		this.detailsHash = Web3Util.web3.utils.sha3(JSON.stringify())

		let params = [
			this.fee,
			this.deposit,
			this.interactionPublicKey_x,
			this.interactionPublicKey_y,
			this.interactionAddress,
			this.apartmentHash,
			this.detailsIpfsHash,
			this.detailsHash,
			ecAccount.public.x,
			ecAccount.public.y
		]
		Loading.success('compile')

		// Estimate gas and call the requestRental function
		Loading.add('add.blockchain', 'Sending rental request to blockchain')
		let method = Web3Util.contract.methods.requestRental(...parameters)
		return new Promise((resolve, reject) => {
			method.estimateGas().then(gasAmount => {
				method.send({from: account.address, gas: gasAmount})
					.on('receipt', () => {
						Loading.success('add.blockchain')
						Loading.hide()

						this.status = 'requested'
						this.removeFromLocalStorage()

						resolve()
					})
					.on('error', (error) => {
						console.error(error)
						Loading.error('add.blockchain')
						Loading.hide()

						this.removeFromLocalStorage()

						reject(error)
					})
			})
		})
	}

	/**
	 * Get the apartment hash based on the apartment id and a generated nonce
	 * @returns {string}
	 */
	get apartmentHash () {
		return Web3Util.web3.utils.sha3(JSON.stringify([this.apartment.id, this.getApartmentNonce()]))
	}

	/**
	 * Get a nonce to be used in the generation of the apartment hash.
	 * Is stored locally to allow later proving of knowledge of this nonce to prove the apartment contained in a hash
	 * @returns {*}
	 */
	getApartmentNonce () {
		// Get the nonce id based on the interaction key
		let nonceId = 'nonce.' + (Web3Util.web3.utils.sha3(this.interactionPublicKey_x + this.interactionPublicKey_y))

		// Check if we already have a none
		let nonce = window.localStorage.getItem(nonceId)

		if (nonce !== null) {
			return nonce
		}

		// Generate a random number
		// While this doesn't strictly generate a number only used used, it's sufficient for our purposes
		nonce = Math.round(Math.random() * Math.pow(10, 20))

		window.localStorage.setItem(nonceId, nonce)

		return nonce
	}

	/**
	 * Fetch all rentals for the provided accounts
	 *
	 * @param accounts
	 * @returns {Promise<Array>}
	 */
	static async fetchAll (accounts) {
		let rentals = []
		let promises = []

		// Restore pending rentals from local storage
		promises.push(this.restoreFromLocalStorage().then(localRentals => {
			rentals = rentals.concat(localRentals)
		}))

		// Fetch rentals from blockchain
		for (let account of accounts) {
			// Skip accounts that aren't tenant accounts
			if (account.type !== 'tenant') {
				continue
			}

			// Fetch the rentals for the tenant
			promises.push(this.findByTenant(account.address).then(localRentals => {
				rentals = rentals.concat(localRentals)
			}))
		}

		// Wait till all rentals have been fetched
		await Promise.all(promises)

		return rentals
	}

	/**
	 * Restores all pending rentals for the provided accounts from local storage and returns them
	 *
	 * @returns {Promise<Array>}
	 */
	static async restoreFromLocalStorage (accounts) {
		let addresses = accounts.map(account => {
			return account.address
		})

		let pendingRentalRequests = JSON.parse(window.localStorage.setItem('pendingRentalRequests') || '[]')

		let promises = []
		let rentals = []

		// Process all stored pending requests
		for (let request of pendingRentalRequests) {
			// Skip requests for which we don't have accounts
			if (addresses.indexOf(request.tenant) === -1) {
				continue
			}

			let rental = new Rental()
			rental.localStorageId = request.id
			rental.tenant = request.tenant
			rental.fee = request.fee
			rental.deposit = request.deposit
			rental.details = request.details

			// Fetch the apartment
			promises.push(new Promise(async (resolve, reject) => {
				rental.apartment = await Apartment.findById(request.apartment)
				rentals.push(rental)

				resolve()
			}))
		}

		// Wait till all rentals have been populated
		await Promise.all(promises)

		return rentals
	}

	/**
	 * Remove the current request from local storage
	 */
	removeFromLocalStorage () {
		let pendingRentalRequests = JSON.parse(window.localStorage.setItem('pendingRentalRequests') || '[]')

		let filteredRequests = pendingRentalRequests.filter(request => request.id !== this.localStorageId)

		window.localStorage.setItem('pendingRentalRequests', JSON.stringify(filteredRequests))
	}

	static async findByTenant (address) {
		let rentals = []
		let promises = []

		// Get the number of rentals
		let numRentals = await Web3Util.contract.methods.getNumTenantRentals(address).call()

		for (let i = 0; i < numRentals; i++) {
			promises.push(new Promise(async (resolve, reject) => {
				// Fetch the rental from the blockchain
				let rentalData = await Web3Util.contract.methods.getTenantRental(address, i)

				// Create a new rental and assign the fetched data
				let rental = new Rental()
				Object.assign(rental, rentalData)
				rental.tenant = address

				// TODO: Get rental details; possibly from local storage (in IPFS: encrypted with interaction key)

				rentals.push(rental)
				resolve()
			}))
		}

		return rentals
	}
}
