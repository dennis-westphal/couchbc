import {Loading} from '../components/Loading';
import {Cryptography} from '../utils/Cryptography';
import {PubSub} from '../utils/PubSub';
import {Conversion} from '../utils/Conversion';
import {Apartment} from './Apartment';
import {Web3Util} from '../utils/Web3Util';

export class Rental {
	constructor() {
		this.id = 0;
		this.interactionPublicKey_x = '';
		this.interactionPublicKey_y = '';
		this.interactionAddress = '';
		this.apartmentHash = '';

		this.detailsIpfsHash = '';
		this.detailsHash = '';
		this.detailsForMediatorIpfsHash = '';
		this.contactDataIpfsHash = '';
		this.contactDataForMediatorIpfsHash = '';

		this.fee = 0;
		this.deposit = 0;

		this.tenant = '';
		this.mediator = '';

		this.status = '';
		this.depositStatus = '';

		this.depositDeduction = '';

		this.details = {};
		this.detailsForMediator = {};
		this.ownerData = {};
		this.ownerDataForMediator = {};
	}

	static async addRequest(account, data) {
		let rental = new Rental();
		rental.tenant = account.address;
		rental.details.apartment = data.apartment;
		rental.details.fromDay = data.fromDay;
		rental.details.tillDay = data.tillDay;
		rental.details.contact = data.contact;
		rental.fee = data.fee;
		rental.deposit = data.deposit;
		rental.status = 'pending';

		// TODO: Assign manually
		Object.assign(rental, data);

		// Show the load message. Wait for the response, as following steps might freeze the browser for a second.
		await Loading.show('Requesting rental');

		// Get or create the tenant ec account
		Loading.add('account', 'Initializing elliptic cryptography account');
		let ecAccount = await Cryptography.getOrCreateEcAccount(account);
		Loading.success('account');

		// Subscribe to the answer topic
		Loading.add('subscribe', 'Subscribing to interaction key responses');
		PubSub.subscribeToTopic(
			'issue-interaction-key',

			// Decrypt response with own EC account => private key
			ecAccount.address
		).then(() => {
			Loading.success('subscribe');
		});

		// Send a new interaction key request
		Loading.add('publish', 'Sending encrypted interaction key request');
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
		);
		Loading.success('publish');

		// Add the request to the pending requests
		Loading.add('save', 'Saving pending rental requests');
		rental.saveInLocalStorage();
		Loading.success('save');

		Loading.hide();

		return rental;
	}

	/**
	 * Save the (pending) rental request in local storage to allow restoring it after a browser refresh
	 */
	saveInLocalStorage() {
		let pendingRentalRequests = JSON.parse(window.localStorage.setItem('pendingRentalRequests') || '[]');

		pendingRentalRequests.push({
			tenant:    this.tenant,
			apartment: this.apartment.id,
			fee:       this.fee,
			deposit:   this.deposit,
			details:   this.details
		});

		// Save the tenant's data in local storage for autocompletion of further actions
		window.localStorage.setItem('userName', this.details.contact.name);
		window.localStorage.setItem('userPhone', this.details.contact.phone);
		window.localStorage.setItem('userEmail', this.details.contact.email);

		// Save the requests in local storage
		window.localStorage.setItem('pendingRentalRequests', JSON.stringify(pendingRentalRequests));
	}

	/**
	 * Fetch all rentals for the provided accounts
	 *
	 * @param accounts
	 * @returns {Promise<Array>}
	 */
	static async fetchAll(accounts) {
		let rentals = [];
		let promises = [];

		// Restore pending rentals from local storage
		promises.push(this.restoreFromLocalStorage().then(localRentals => {
			rentals = rentals.concat(localRentals);
		}));

		// Fetch rentals from blockchain
		for (let account of accounts) {
			// Skip accounts that aren't tenant accounts
			if (account.type !== 'tenant') {
				continue;
			}

			// Fetch the rentals for the tenant
			promises.push(this.findByTenant(account.address).then(localRentals => {
				rentals = rentals.concat(localRentals);
			}));
		}

		// Wait till all rentals have been fetched
		await Promise.all(promises);

		return rentals;
	}

	/**
	 * Restores all pending rentals for the provided accounts from local storage and returns them
	 *
	 * @returns {Promise<Array>}
	 */
	static async restoreFromLocalStorage(accounts) {
		let addresses = accounts.map(account => {
			return account.address;
		});

		let pendingRentalRequests = JSON.parse(window.localStorage.setItem('pendingRentalRequests') || '[]');

		let promises = [];
		let rentals = [];

		// Process all stored pending requests
		for (let request of pendingRentalRequests) {
			// Skip requests for which we don't have accounts
			if (addresses.indexOf(request.tenant) === -1) {
				continue;
			}

			let rental = new Rental();
			rental.tenant = request.tenant;
			rental.fee = request.fee;
			rental.deposit = request.deposit;
			rental.details = request.details;

			// Fetch the apartment
			promises.push(new Promise(async (resolve, reject) => {
				rental.apartment = await Apartment.findById(request.apartment);
				rentals.push(rental);

				resolve();
			}));
		}

		// Wait till all rentals have been populated
		await Promise.all(promises);

		return rentals;
	}

	static async findByTenant(address) {
		let rentals = [];
		let promises = [];

		// Get the number of rentals
		let numRentals = await Web3Util.contract.methods.getNumTenantRentals(address).call();

		for (let i = 0; i < numRentals; i++) {
			promises.push(new Promise(async (resolve, reject) => {
				// Fetch the rental from the blockchain
				let rentalData = await Web3Util.contract.methods.getTenantRental(address, i);

				// Create a new rental and assign the fetched data
				let rental = new Rental();
				Object.assign(rental, rentalData);
				rental.tenant = address;

				// TODO: Get rental details; possibly from local storage (in IPFS: encrypted with interaction key)

				rentals.push(rental);
				resolve();
			}));
		}

		return rentals;
	}
}