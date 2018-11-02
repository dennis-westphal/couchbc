import {Loading} from '../components/Loading';
import {Cryptography} from '../utils/Cryptography';
import {PubSub} from '../utils/PubSub';
import {Conversion} from '../utils/Conversion';

export class Rental {
	constructor() {
		this.id = 0;
		this.apartment = null;
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
		rental.status = 'pending';
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
			bcAccountAddress:  this.tenant.address,
			apartment:         this.apartment.id,
			apartmentIpfsHash: this.apartmentHash,
			details:           this.details
		});

		// Save the tenant's data in local storage for autocompletion of further actions
		window.localStorage.setItem('userName', this.details.contact.name);
		window.localStorage.setItem('userPhone', this.details.contact.phone);
		window.localStorage.setItem('userEmail', this.details.contact.email);

		// Save the requests in local storage
		window.localStorage.setItem('pendingRentalRequests', JSON.stringify(pendingRentalRequests));
	}

	/**
	 * Restores all pending rental requests from local storage
	 */
	static restoreFromLocalStorage() {

	}
}