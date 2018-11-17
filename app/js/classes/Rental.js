import { Loading } from '../components/Loading'
import { Cryptography } from '../utils/Cryptography'
import { PubSub } from '../utils/PubSub'
import { Conversion } from '../utils/Conversion'
import { Apartment } from './Apartment'
import { Web3Util } from '../utils/Web3Util'
import { IpfsUtil } from '../utils/IpfsUtil'
import { Notifications } from '../utils/Notifications'
import { Tenant } from './Tenant'

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

		this.account = null
		this.tenantAddress = ''
		this.mediatorAddress = ''
		this.ownerAddress = ''

		this.status = ''
		this.depositStatus = ''

		this.depositDeduction = ''

		this.details = {}
		this.detailsForMediator = {}
		this.ownerData = {
			name:  '',
			phone: '',
			email: ''
		}
		this.ownerDataForMediator = {}
	}

	/**
	 * Set an owner account for this rental.
	 * This has to be a previously unused account
	 *
	 * @param ownerAccount
	 */
	set ownerAccount (ownerAccount) {
		if (ownerAccount.type !== 'unknown') {
			console.warn('Used account may not be selected as owner address', ownerAccount)

			return
		}

		this.ownerAddress = ownerAccount.address
	}

	/**
	 * Get the owner account used in this rental
	 *
	 * @returns {*}
	 */
	get ownerAccount () {
		return Web3Util.getAccount(this.ownerAddress)
	}

	/**
	 * Get the public key buffer for the rental's interaction key
	 *
	 * @returns {Uint8Array}
	 */
	get interactionKeyBuffer () {
		return Conversion.getUint8ArrayBufferFromXY(this.interactionPublicKey_x, this.interactionPublicKey_y)
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
		rental.tenantAddress = account.address
		rental.apartment = data.apartment
		rental.details.apartmentId = data.apartment.id
		rental.details.fromDay = data.fromDay
		rental.details.tillDay = data.tillDay
		rental.details.contact = data.contact
		rental.fee = parseInt(data.fee)
		rental.deposit = parseInt(data.apartment.deposit)
		rental.role = 'tenant'
		rental.status = 'pending'

		// Assign a random local id so we can associate for now so we can identify the request later on
		rental.localStorageId = Cryptography.getRandomString()

		// Show the load message. Wait for the response, as following steps might freeze the browser for a second.
		await Loading.show('Adding rental request')

		// Get or create the tenant ec account
		Loading.add('account', 'Initializing elliptic cryptography account')
		let ecAccount = await Cryptography.getOrCreateEcAccount(account)
		Loading.success('account')

		// Subscribe to the answer topic
		Loading.add('subscribe', 'Subscribing to interaction key responses')
		await PubSub.subscribeToTopic(
			'issue-interaction-key',

			// Decrypt response with own EC account => private key
			ecAccount.address
		)
		Loading.success('subscribe')

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

			// Encrypt with owner's public key
			rental.apartment.ownerKeyBuffer
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
		// Only send the request if it is still pending
		if (this.status !== 'pending') {
			return
		}

		// Show the load message. Wait for the response, as following steps might freeze the browser for a second.
		await Loading.show('Sending rental request')

		// Add the apartmentSecret to the details to allow the owner to verify the apartment hash and the tenant to later retrieve it from local storage.
		// The apartmentSecret is used to proof to the blockchain which apartment was involved in a rental when a tenant rates the apartment.
		this.details.apartmentSecret = Cryptography.getRandomString()

		Loading.add('account', 'Fetching or creating tenant account')
		let ecAccount = await Cryptography.getOrCreateEcAccount(Web3Util.getAccount(this.tenantAddress))
		Loading.success('account')

		// Upload the data to IPFS
		Loading.add('upload', 'Uploading details to IPFS')
		this.detailsIpfsHash = await IpfsUtil.uploadData(this.details, this.interactionKeyBuffer)
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
		Loading.success('compile')

		// Estimate gas and call the requestRental function
		Loading.add('request.blockchain', 'Sending rental request to blockchain')
		let method = Web3Util.contract.methods.requestRental(...parameters)
		return new Promise((resolve, reject) => {
			method.estimateGas({from: this.tenantAddress, value: value})
				.then(gasAmount => {
					method.send({from: this.tenantAddress, gas: gasAmount, value: value})
						.on('receipt', () => {
							Notifications.show('Rental request sent')
							Loading.success('request.blockchain')
							Loading.hide()

							this.status = 'requested'
							this.removePendingRequest()
							this.saveLocalTenantData()

							// Mark the account as used by a tenant
							Web3Util.getAccount(this.tenantAddress).type = 'tenant'

							resolve()
						})
						.on('error', (error) => {
							console.error(error, parameters)
							Loading.error('request.blockchain')
							Loading.hide()

							this.removePendingRequest()

							reject(error)
						})
				})
				.catch(error => {
					console.error(error, parameters)
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
			tenantAddress:  this.tenantAddress,
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

		let filteredRequests = pendingRentalRequests.filter(request => request.localStorageId !== this.localStorageId)

		window.localStorage.setItem('pendingRentalRequests', JSON.stringify(filteredRequests))
	}

	/**
	 * Create the details hash based on the JSON encoded details string
	 * @returns {string}
	 */
	createDetailsHash () {
		return Web3Util.web3.utils.sha3(JSON.stringify(this.details))
	}

	/**
	 * Create the apartment hash based on the apartment id and the (random) apartmentSecret
	 * @returns {string}
	 */
	createApartmentHash () {
		return Web3Util.web3.utils.sha3(this.apartment.id + '-' + this.details.apartmentSecret)
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
			if (addresses.indexOf(request.tenantAddress) === -1) {
				continue
			}

			let rental = new Rental()
			rental.localStorageId = request.localStorageId
			rental.tenantAddress = request.tenantAddress
			rental.role = 'tenant'
			rental.fee = parseInt(request.fee)
			rental.deposit = parseInt(request.deposit)
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
	 * Save details about the rental locally to be used by the tenant
	 */
	saveLocalTenantData () {
		let allLocalData = JSON.parse(window.localStorage.getItem('tenantRentalDetails') || '{}')

		// Add the local data, addressed through the interaction address (as we don't have a rental id yet at this point)
		allLocalData[this.interactionAddress] = this.details

		window.localStorage.setItem('tenantRentalDetails', JSON.stringify(allLocalData))
	}

	/**
	 * Retrieve the locally stored rental details
	 */
	loadLocalTenantData () {
		let allLocalData = JSON.parse(window.localStorage.getItem('tenantRentalDetails') || '{}')

		if (allLocalData[this.interactionAddress]) {
			Object.assign(this.details, allLocalData[this.interactionAddress])
		}
	}

	/**
	 * Save details about the rental locally to be used by the owner
	 */
	saveLocalOwnerData () {
		let allLocalData = JSON.parse(window.localStorage.getItem('ownerRentalData') || '{}')

		// Add the local data, addressed through the interaction address (as we don't have a rental id yet at this point)
		allLocalData[this.id] = this.ownerData

		window.localStorage.setItem('ownerRentalData', JSON.stringify(allLocalData))
	}

	/**
	 * Retrieve the locally stored rental details
	 */
	loadLocalOwnerData () {
		let allLocalData = JSON.parse(window.localStorage.getItem('ownerRentalData') || '{}')

		if (allLocalData[this.id]) {
			Object.assign(this.details, allLocalData[this.id])
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
				rental.tenantAddress = address
				rental.account = Web3Util.getAccount(address)
				rental.role = 'tenant'
				rental.fee = parseInt(rentalData.fee)
				rental.deposit = parseInt(rentalData.deposit)

				// Fetch the locally stored data
				rental.loadLocalTenantData()

				// Fetch the apartment
				rental.apartment = await Apartment.findById(rental.details.apartmentId)

				// If we have an accepted rental, fetch the owner contact data
				if (rental.status === 'accepted') {
					let ecAccount = await Cryptography.getEcAccountForBcAccount(address)
					rental.ownerData = await IpfsUtil.downloadDataFromHexHash(rental.contactDataIpfsHash, ecAccount)
				}

				rentals.push(rental)
				resolve()
			}))
		}

		await Promise.all(promises)

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
		Object.assign(rental, rentalData)
		rental.interactionAddress = address
		rental.account = Web3Util.getAccount(address)
		rental.role = 'owner'

		// Fetch the EC account to decrypt the details
		let ecAccount = await Cryptography.getEcAccount(address)

		// Fetch the rental details
		rental.details = await IpfsUtil.downloadDataFromHexHash(rental.detailsIpfsHash, ecAccount)
		rental.fee = parseInt(rentalData.fee)
		rental.deposit = parseInt(rentalData.deposit)

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

		console.debug('Verified rental request details', this)

		return true
	}

	/**
	 * Cancel a rental request. Prevents it from being submitted to the blockchain.
	 */
	cancel () {
		this.removePendingRequest()
		this.status = 'canceled'
	}

	/**
	 * Withdraw a rental request.
	 *
	 * @return {Promise<void>}
	 */
	async withdraw () {
		// Show the load message. Wait for the response, as following steps might freeze the browser for a second.
		await Loading.show('Withdrawing rental request')

		let parameters = [
			this.id
		]

		// Estimate gas and call the withdrawRentalRequest function
		Loading.add('withdraw.blockchain', 'Sending withdrawal to blockchain')
		let method = Web3Util.contract.methods.withdrawRentalRequest(...parameters)
		return new Promise((resolve, reject) => {
			method.estimateGas({from: this.tenantAddress})
				.then(gasAmount => {
					method.send({from: this.tenantAddress, gas: gasAmount + 21000})
						.on('receipt', () => {
							Notifications.show('Withdrawal sent')
							Loading.success('withdraw.blockchain')
							Loading.hide()

							this.status = 'withdrawn'

							resolve()
						})
						.on('error', (error) => {
							console.error(error, parameters)
							Loading.error('withdraw.blockchain')
							Loading.hide()

							reject(error)
						})
				})
				.catch(error => {
					console.error(error, parameters)
					Loading.error('withdraw.blockchain')
					Loading.hide()

					reject(error)
				})
		})
	}

	/**
	 * Accept a rental as the owner. Authenticates using the interaction EC account referenced in the interaction address.
	 *
	 * @return {Promise<void>}
	 */
	async accept () {
		// Show the load message. Wait for the response, as following steps might freeze the browser for a second.
		await Loading.show('Accepting rental request')

		// Fetch the tenant
		Loading.add('tenant', 'Fetching tenant public key for encryption of contact data')
		let tenant = await Tenant.findByAddress(this.tenantAddress)
		Loading.success('tenant')

		// Upload the owner details to IPFS, encrypted with the tenant's public key
		Loading.add('upload', 'Uploading contact data to IPFS')
		let ownerDataHash = await IpfsUtil.uploadData(this.ownerData, tenant.publicKeyBuffer)
		Loading.success('upload')

		// Create the string we must sign for authentication
		let acceptString = 'accept:' + this.id + '-' +
			ownerDataHash.substr(2) + '-' +
			this.ownerAddress.substr(2).toLowerCase() // Use the lower case of the address as this is how it is converted on the blockchain

		// Get the account to sign the message and thus used for authentication against the interaction address
		let ecAccount = await Cryptography.getEcAccount(this.interactionAddress)

		Loading.add('sign', 'Signing accept message')
		let sign = Web3Util.web3.eth.accounts.sign(acceptString, ecAccount.private.hex)
		let signature = sign.signature
		Loading.success('sign')

		let parameters = [
			this.id,
			ownerDataHash,
			signature
		]

		// Estimate gas and call the acceptRental function
		Loading.add('accept.blockchain', 'Sending message to blockchain')
		let method = Web3Util.contract.methods.acceptRental(...parameters)
		return new Promise((resolve, reject) => {
			method.estimateGas({from: this.ownerAddress})
				.then(gasAmount => {
					method.send({from: this.ownerAddress, gas: gasAmount + 21000})
						.on('receipt', async () => {
							// Mark the account as used in an interaction
							this.ownerAccount.type = 'interaction'

							this.status = 'accepted'

							Loading.success('accept.blockchain')

							Loading.add('availability', 'Uploading changed apartment availability')
							this.apartment.rentedTimes.push({
								fromDay: this.details.fromDay,
								tillDay: this.details.tillDay
							})
							await this.apartment.uploadAvailability()
							Loading.success('availability')
							Loading.hide()

							Notifications.show('Rental request accepted')
							resolve()
						})
						.on('error', (error, parameters) => {
							console.error(error)
							Loading.error('accept.blockchain')
							Loading.hide()

							reject(error)
						})
				})
				.catch(error => {
					console.error(error, parameters)
					Loading.error('accept.blockchain')
					Loading.hide()

					reject(error)
				})
		})
	}

	/**
	 * Refuse a rental as the owner. Authenticates using the interaction EC account referenced in the interaction address.
	 *
	 * @return {Promise<void>}
	 */
	async refuse () {
		// Show the load message. Wait for the response, as following steps might freeze the browser for a second.
		await Loading.show('Refusing rental request')

		// Create the string we must sign for authentication
		let refuseString = 'refuse:' + this.id

		// Get the account to sign the message and thus used for authentication against the interaction address
		let ecAccount = await Cryptography.getEcAccount(this.interactionAddress)

		Loading.add('sign', 'Signing refuse message')
		let sign = Web3Util.web3.eth.accounts.sign(refuseString, ecAccount.private.hex)
		let signature = sign.signature
		console.debug('Created signature', sign)
		Loading.success('sign')

		let parameters = [
			this.id,
			signature
		]

		// Estimate gas and call the refuseRental function
		Loading.add('refuse.blockchain', 'Sending message to blockchain')
		let method = Web3Util.contract.methods.refuseRental(...parameters)

		return new Promise((resolve, reject) => {
			method.estimateGas({from: this.ownerAddress})
				.then(gasAmount => {
					method.send({from: this.ownerAddress, gas: gasAmount + 21000})
						.on('receipt', () => {
							Notifications.show('Rental request refused')
							Loading.success('refuse.blockchain')
							Loading.hide()

							// Mark the account as used in an interaction
							this.ownerAccount.type = 'interaction'

							this.status = 'refused'

							resolve()
						})
						.on('error', (error, parameters) => {
							console.error(error)
							Loading.error('refuse.blockchain')
							Loading.hide()

							reject(error)
						})
				})
				.catch(error => {
					console.error(error, parameters)
					Loading.error('refuse.blockchain')
					Loading.hide()

					reject(error)
				})
		})
	}

	/**
	 * Review the tenant for the rental and optionally request a deduction from the deposit
	 *
	 * @param score
	 * @param text
	 * @param deduction
	 * @param reason
	 * @returns {Promise<void>}
	 */
	async reviewTenant (score, text, deduction, reason) {
		// Wait till the loading screen is shown
		await Loading.show('Adding tenant review' + ((deduction > 0) ? ' and deduction request' : ''))

		// Fetch the tenant first as we need him for all following steps
		Loading.add('tenant', 'Fetching tenant details for encryption')
		let tenant = await Tenant.findByAddress(this.tenantAddress)
		Loading.success('tenant')

		let promises = []

		Loading.add('review.upload', 'Encrypting and uploading review text to IPFS')
		let reviewTextHash = Web3Util.web3.utils.sha3(text)
		let reviewIpfsHash = ''
		promises.push(new Promise(async resolve => {
			// Upload the review to IPFS, encrypted it with the tenant's public key
			reviewIpfsHash = await IpfsUtil.uploadData(text, tenant.publicKeyBuffer)

			Loading.success('review.upload')
			resolve()
		}))

		let deductionReasonIpfsHash = ''
		let contactDataForMediatorIpfsHash = ''
		// If we have requested a deduction, also upload the deduction reason and the contact data for the mediator
		if (deduction > 0) {
			Loading.add('reason.upload', 'Encrypting and uploading deduction reason to IPFS')

			// Fetch the mediator to get his public key. The mediator is always also a tenant, which is why we fetch him through the Tenant class.
			Loading.add('mediator', 'Fetching mediator details for encryption')
			let mediator = await Tenant.findByAddress(this.mediatorAddress)
			Loading.success('mediator')

			// Upload the deduction reason
			promises.push(new Promise(async resolve => {
				// Upload the review to IPFS, encrypted it with the tenant's and the mediator's public key
				deductionReasonIpfsHash = await IpfsUtil.uploadData(text, [tenant.publicKeyBuffer, mediator.publicKeyBuffer])

				Loading.success('reason.upload')
				resolve()
			}))

			Loading.add('contact.upload', 'Encrypting and uploading contact data for mediator to IPFS')

			// Upload the contact data for the mediator
			promises.push(new Promise(async resolve => {
				// Upload the review to IPFS, encrypted it with the tenant's and the mediator's public key
				contactDataForMediatorIpfsHash = await IpfsUtil.uploadData(this.ownerData, mediator.publicKeyBuffer)

				Loading.success('contact.upload')
				resolve()
			}))
		}

		// Wait till all uploads have finished
		await Promise.all(promises)

		let parameters = [
			this.id,
			score,
			reviewTextHash,
			reviewIpfsHash,
			deduction,
			deductionReasonIpfsHash,
			contactDataForMediatorIpfsHash
		]

		// Estimate gas and endRental function
		Loading.add('endRental.blockchain', 'Sending message to blockchain')
		let method = Web3Util.contract.methods.endRental(...parameters)

		return new Promise((resolve, reject) => {
			method.estimateGas({from: this.ownerAddress})
				.then(gasAmount => {
					method.send({from: this.ownerAddress, gas: gasAmount + 21000})
						.on('receipt', () => {
							Notifications.show('Tenant review added')
							Loading.success('endRental.blockchain')
							Loading.hide()

							// Mark the account as used in an interaction
							this.ownerAccount.type = 'interaction'

							this.status = 'refused'

							resolve()
						})
						.on('error', (error, parameters) => {
							console.error(error)
							Loading.error('endRental.blockchain')
							Loading.hide()

							reject(error)
						})
				})
				.catch(error => {
					console.error(error, parameters)
					Loading.error('endRental.blockchain')
					Loading.hide()

					reject(error)
				})
		})
	}

	reviewApartment (score, text) {

	}
}
