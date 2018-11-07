import { Loading } from '../components/Loading'
import { Cryptography } from '../utils/Cryptography'
import { PubSub } from '../utils/PubSub'
import { Conversion } from '../utils/Conversion'
import { Apartment } from './Apartment'
import { Web3Util } from '../utils/Web3Util'
import { IpfsUtil } from '../utils/IpfsUtil'
import { Notifications } from '../utils/Notifications'

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

	/**
	 * Add a new rental request
	 *
	 * @param account
	 * @param data
	 * @returns {Promise<Rental>}
	 */
	static async addRequest (account, data) {
		let rental = new Rental()
		rental.tenant = account.address
		rental.apartment = data.apartment
		rental.details.apartmentId = data.apartment.id
		rental.details.fromDay = data.fromDay
		rental.details.tillDay = data.tillDay
		rental.details.contact = data.contact
		rental.fee = parseInt(data.fee)
		rental.deposit = parseInt(data.apartment.deposit)
		rental.status = 'pending'

		// Assign a random local id so we can associate for now so we can identify the request later on
		rental.localStorageId = Cryptography.getRandomString()

		// Show the load message. Wait for the response, as following steps might freeze the browser for a second.
		await Loading.show('Adding rental request')

		// Get or create the tenant ec account
		Loading.add('account', 'Initializing elliptic cryptography account')
		let ecAccount = await Cryptography.getOrCreateEcAccount(account)
		Loading.success('account')
		console.log(account, ecAccount)

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
				id: rental.localStorageId,
				x:  ecAccount.public.x,
				y:  ecAccount.public.y
			}),

			// Topic to send the message to
			'request-interaction-key',

			// Encrypt with owner's interaction key
			Conversion.getUint8ArrayBufferFromXY(rental.apartment.ownerPublicKey_x, rental.apartment.ownerPublicKey_y)
		)
		Loading.success('publish')

		// Add the request to the pending requests
		Loading.add('save', 'Saving pending rental requests')
		rental.savePendingRequest()
		Loading.success('save')

		Loading.hide()

		return rental
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
		let ecAccount = await Cryptography.getOrCreateEcAccount(Web3Util.getAccount(this.tenant))
		Loading.success('account')

		// Get a public key buffer from the interaction key for encryption of the details
		let
			publicKeyBuffer = Conversion.getUint8ArrayBufferFromXY(this.interactionPublicKey_x, this.interactionPublicKey_y)

		Loading.add('upload', 'Uploading details to IPFS')
		this.detailsIpfsHash = await IpfsUtil.uploadData(this.details, publicKeyBuffer)
		Loading.success('upload')

		Loading.add('compile', 'Compiling data')
		this.detailsHash = this.createDetailsHash()
		this.apartmentHash = this.createApartmentHash()

		let parameters = [
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
		let value = Conversion.finneyToWei(this.fee + this.deposit)

		console.log(parameters, value)

		Loading.success('compile')

		// Estimate gas and call the requestRental function
		Loading.add('request.blockchain', 'Sending rental request to blockchain')
		let method = Web3Util.contract.methods.requestRental(...parameters)
		return new Promise((resolve, reject) => {
			method.estimateGas({from: this.tenant, value: value})
				.then(gasAmount => {
					method.send({from: this.tenant, gas: 4000000, value: value})
						.on('receipt', () => {
							Notifications.show('Rental request sent')
							Loading.success('request.blockchain')
							Loading.hide()

							this.status = 'requested'
							this.removePendingRequest()
							this.saveLocalData()

							resolve()
						})
						.on('error', (error) => {
							console.error(error)
							Loading.error('request.blockchain')
							Loading.hide()

							this.removePendingRequest()

							reject(error)
						})
				})
				.catch(error => {
					console.error(error)
					Loading.error('request.blockchain')
					Loading.hide()

					this.removePendingRequest()

					reject(error)
				})
		})
	}

	/**
	 * Save the (pending) rental request in local storage to allow restoring it after a browser refresh
	 */
	savePendingRequest () {
		let pendingRentalRequests = JSON.parse(window.localStorage.getItem('pendingRentalRequests') || '[]')

		pendingRentalRequests.push({
			localStorageId: this.localStorageId,
			tenant:         this.tenant,
			fee:            this.fee,
			deposit:        this.deposit,
			details:        this.details
		})

		// Save the tenant's data in local storage for autocompletion of further actions
		window.localStorage.setItem('userName', this.details.contact.name)
		window.localStorage.setItem('userPhone', this.details.contact.phone)
		window.localStorage.setItem('userEmail', this.details.contact.email)

		// Save the requests in local storage
		window.localStorage.setItem('pendingRentalRequests', JSON.stringify(pendingRentalRequests))
	}

	/**
	 * Remove the pending request from local storage
	 */
	removePendingRequest () {
		let pendingRentalRequests = JSON.parse(window.localStorage.getItem('pendingRentalRequests') || '[]')

		let filteredRequests = pendingRentalRequests.filter(request => request.id !== this.localStorageId)

		window.localStorage.setItem('pendingRentalRequests', JSON.stringify(filteredRequests))
	}

	async accept () {

	}

	/**
	 * Create the details hash based on the JSON encoded details string
	 * @returns {string}
	 */
	createDetailsHash () {
		return Web3Util.web3.utils.sha3(JSON.stringify(this.details))
	}

	/**
	 * Create the apartment hash based on the apartment id and a generated nonce
	 * @returns {string}
	 */
	createApartmentHash () {
		return Web3Util.web3.utils.sha3(this.apartment.id + '-' + this.getApartmentNonce())
	}

	/**
	 * Get a nonce to be used in the generation of the apartment hash.
	 * The nonce is stored in the rental, but not persisted in any way.
	 * @returns {number}
	 */
	getApartmentNonce () {
		if (this.apartmentNonce) {
			return this.apartmentNonce
		}

		// Generate a random number
		// While this doesn't strictly generate a number only used used, it's sufficient for our purposes
		this.apartmentNonce = Math.round(Math.random() * Math.pow(10, 20))

		return this.apartmentNonce
	}

	/**
	 * Fetch all rentals for the provided accounts and interaction addresses
	 *
	 * @param accounts
	 * @param interactionAddresses
	 * @returns {Promise<Array>}
	 */
	static async fetchAll (accounts, interactionAddresses) {
		let rentals = []
		let promises = []

		// Restore pending rentals from local storage
		promises.push(new Promise(async (resolve) => {
			let pendingRequests = await this.fetchPendingRequests(accounts)

			rentals = rentals.concat(pendingRequests)

			resolve()
		}))

		// Fetch rentals from blockchain
		for (let account of accounts) {
			// Skip accounts that aren't tenant accounts
			if (account.type !== 'tenant') {
				continue
			}

			// Fetch the rentals for the tenant
			promises.push(new Promise(async (resolve) => {
				let tenantRentals = await this.findByTenant(account.address)

				rentals = rentals.concat(tenantRentals)

				resolve()
			}))
		}

		// Fetch interaction address rentals
		for (let interactionAddress of interactionAddresses) {
			promises.push(new Promise(async (resolve) => {
				let ownerRental = await this.findByInteractionAddress(interactionAddress)

				if (ownerRental) {
					rentals.push(ownerRental)
				}

				resolve()
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
	static async fetchPendingRequests (accounts) {
		let addresses = accounts.map(account => {
			return account.address
		})

		let pendingRentalRequests = JSON.parse(window.localStorage.getItem('pendingRentalRequests') || '[]')

		let promises = []
		let rentals = []

		// Process all stored pending requests
		for (let request of pendingRentalRequests) {
			// Skip requests for which we don't have accounts
			if (addresses.indexOf(request.tenant) === -1) {
				continue
			}

			let rental = new Rental()
			rental.localStorageId = request.localStorageId
			rental.tenant = request.tenant
			rental.role = 'tenant'
			rental.fee = request.fee
			rental.deposit = request.deposit
			rental.details = request.details
			rental.status = 'pending'

			// Fetch the apartment
			promises.push(new Promise(async (resolve, reject) => {
				rental.apartment = await Apartment.findById(request.details.apartmentId)
				rentals.push(rental)

				resolve()
			}))
		}

		// Wait till all rentals have been populated
		await Promise.all(promises)

		return rentals
	}

	/**
	 * Save data about the rental locally to be used by the tenant
	 */
	saveLocalData () {
		let rentalData = {
			details:        this.details,
			apartmentNonce: this.apartmentNonce
		}

		let allLocalData = JSON.parse(window.localStorage.getItem('rentalsData') || '{}')

		// Add the local data, addressed through the interaction address (as we don't have a rental id yet at this point)
		allLocalData[this.interactionAddress] = rentalData

		window.localStorage.setItem('rentalsData', JSON.stringify(allLocalData))
	}

	/**
	 * Retrieve the locally stored data
	 */
	loadLocalData () {
		let allLocalData = JSON.parse(window.localStorage.getItem('rentalsData') || '{}')

		if (allLocalData[this.interactionAddress]) {
			Object.assign(this, allLocalData[this.interactionAddress])
		}
	}

	/**
	 * Find rentals for the provided tenant address
	 *
	 * @param address
	 * @returns {Promise<Array>}
	 */
	static async findByTenant (address) {
		let rentals = []
		let promises = []

		// Get the number of rentals
		let numRentals = await Web3Util.contract.methods.getNumTenantRentals(address).call()

		for (let i = 0; i < numRentals; i++) {
			promises.push(new Promise(async (resolve, reject) => {
				// Fetch the rental from the blockchain
				let rentalData = await Web3Util.contract.methods.getTenantRental(address, i).call()

				// Create a new rental and assign the fetched data
				let rental = new Rental()
				Object.assign(rental, rentalData)
				rental.tenant = address
				rental.role = 'tenant'

				// Fetch the locally stored data
				rental.loadLocalData()

				// Fetch the apartment
				rental.apartment = await Apartment.findById(rental.details.apartmentId)

				rentals.push(rental)
				resolve()
			}))
		}

		return rentals
	}

	/**
	 * Find a rental for the provided interaction address
	 *
	 * @param address
	 * @returns {Promise<Array>}
	 */
	static async findByInteractionAddress (address) {
		// Check if we have a rental
		let hasRental = await Web3Util.contract.methods.hasInteractionAddressRental(address).call()
		if (!hasRental) {
			return null
		}

		let rentalData = await Web3Util.contract.methods.getInteractionAddressRental(address).call()

		// Create a new rental and assign the fetched data
		let rental = new Rental()
		console.log(rentalData)
		Object.assign(rental, rentalData)
		rental.role = 'owner'

		// Fetch the apartment
		rental.apartment = await Apartment.findById(rental.details.apartmentId)

		// Check if we need to verify the request data
		if (rental.status === 'requested') {
			// If the rental request could not be verified, ignore it
			return (await rental.verifyRequestData())
				? rental
				: null
		}

		return rental
	}

	/**
	 * Verify that the request data matches the provided hashes and details
	 *
	 * @returns {boolean}
	 */
	verifyRequestData () {
		// Check request details hash
		let detailsHash = this.createDetailsHash()
		if (this.detailsHash !== detailsHash) {
			console.error('Details hash mismatch: ' + this.detailsHash + ' (supplied) vs ' + detailsHash + ' (generated)')
			return false
		}

		// Check fee and deposit match apartment data
		let calculatedFee = this.apartment.calculateFee(this.details.fromDay, this.details.tillDay)
		if (this.fee !== calculatedFee) {
			console.error('Fee mismatch: ' + this.fee + ' (supplied) vs ' + calculatedFee + ' (calculated)')
			return false
		}
		if (this.deposit !== this.apartment.deposit) {
			console.error('Deposit mismatch: ' + this.deposit + ' (supplied) vs ' + this.apartment.deposit + ' (apartment)')
			return false
		}

		let apartmentHash = this.createApartmentHash()
		if (this.apartmentHash !== apartmentHash) {
			console.error('Apartment hash mismatch: ' + this.apartmentHash + ' (supplied) vs ' + apartmentHash + ' (generated)')
			return false
		}

		return true
	}
}
