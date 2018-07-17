// Import the page's CSS. Webpack will know what to do with it.
import '../css/materialize.css';
import '../css/app.css';

// Import libraries we need.
import '../js/materialize.js';
import {default as Vue} from 'vue';
import {default as Web3} from 'web3';

// Import our contract artifacts and turn them into usable abstractions.
import rent_artifacts from '../../build/contracts/Rent.json';

// Save the account and the rent contract
let account;
let rentContract;

function showMessage(message) {
	M.toast({html: message});
}

let app = new Vue({
	el:      '#app',
	data:    () => ({
		page:             'start',
		accountChecked:   false,
		registered:       false,
		balance:          '',
		newUserData:      {
			name:    '',
			street:  '',
			zip:     '',
			city:    '',
			country: '',
		},
		newApartmentData: {
			title:         '',
			street:        '',
			zip:           '',
			city:          '',
			country:       '',
			pricePerNight: 0,
			deposit:       0,
		},
		apartments:       [],
	}),
	methods: {
		register:       clickEvent => {
			clickEvent.preventDefault();

			// Using the ES2015 spread operator does not work on vue data objects
			let params = [
				app.newUserData.name,
				app.newUserData.street,
				app.newUserData.zip,
				app.newUserData.city,
				app.newUserData.country];

			// Estimate gas and call the register function
			let method = rentContract.methods.register(...params);
			method.estimateGas().then(gasAmount => {
				method.send({gas: gasAmount});
			});

			rentContract.once('Registered', {filter: {userAddress: account}},
					(error, event) => {
						if (error) {
							showMessage('Could not process registration');
							console.error(error);
							return;
						}

						showMessage('Registered successfully');

						app.accountChecked = true;
						app.registered = true;

						// Change the page if we're currently on the registration page
						if (app.page === 'register') {
							app.page = 'apartments';
						}

						app.refreshBalance();
					});
		},
		addApartment:   clickEvent => {
			clickEvent.preventDefault();

			// Using the ES2015 spread operator does not work on vue data objects
			let parameters = [
				app.newApartmentData.title,
				app.newApartmentData.street,
				app.newApartmentData.zip,
				app.newApartmentData.city,
				app.newApartmentData.country,
				app.newApartmentData.pricePerNight,
				app.newApartmentData.deposit];

			// Estimate gas and call the addApartment function
			let method = rentContract.methods.addApartment(...parameters);
			method.estimateGas().then(gasAmount => {
				method.send({gas: gasAmount});
			});

			rentContract.once('ApartmentAdded',
					{filter: {userAddress: account}}, (error, event) => {
						if (error) {
							showMessage('Could not add apartment');
							console.error(error);
							return;
						}

						showMessage('Apartment added');

						// Change the page if we're currently on the add apartment page
						if (app.page === 'add-apartment') {
							app.page = 'apartments';
						}

						// Clear the form
						Object.assign(app.$data.newApartmentData,
								app.$options.data.call(app).newApartmentData);
					});
		},
		loadApartments: () => {
			rentContract.methods.getApartmentsNum().
					call((error, result) => {
						if (error) {
							console.error(error);
							return;
						}

						app.apartments = [];

						let numApartments = parseInt(result);
						for (let i = 0; i < numApartments; i++) {
							rentContract.methods.getApartment(i).
									call((error, result) => {
										if (error) {
											console.error(error);
											return;
										}

										app.apartments.push(result);
									});
						}
					});
		},

		checkAccount:   () => {
			rentContract.methods.isRegistered().call((error, result) => {
				if (error) {
					console.error(error);
					return;
				}

				app.accountChecked = true;
				app.registered = result;

				if (app.registered) {
					showMessage('Successfully logged in');

					app.refreshBalance();
				}
			});
		},
		refreshBalance: () => {
			rentContract.methods.getBalance().call((error, balance) => {
				if (error) {
					console.error(error);
					return;
				}

				app.balance = parseInt(balance);
			});
		},

		start: () => {
			// Get the contract from the artifacts
			rentContract = new web3.eth.Contract(rent_artifacts.abi,
					rent_artifacts.networks[4447].address);

			//Rent.setProvider(web3.currentProvider);

			web3.eth.getAccounts((error, accounts) => {
				if (error) {
					showMessage('There was an error fetching your accounts');
					console.error(error);
					return;
				}

				if (accounts.length === 0) {
					showMessage(
							'Couldn\'t get any accounts! Make sure your Ethereum client is configured correctly.');
					return;
				}

				// Set the default account
				account = accounts[0].toLowerCase();
				web3.eth.defaultAccount = account;
				rentContract.options.from = account;

				app.checkAccount();

				rentContract.events.ApartmentAdded({}, (error, event) => {
					if (error) {
						return;
					}

					app.loadApartments();
				});

				app.loadApartments();
			});
		},
	},
});

window.addEventListener('load', () => {
	// We can't use Metamask's web3 currently as subscriptions through websockets are still in dev
	if (typeof web3 !== 'undefined' && false) {
		// Use Mist/MetaMask's provider
		window.web3 = new Web3(web3.currentProvider);
	} else {
		console.warn(
				'No web3 detected. Falling back to ws://127.0.0.1:9545. You should remove this fallback when you deploy live, as it\'s inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask');
		// fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
		window.web3 = new Web3(
				new Web3.providers.WebsocketProvider('ws://127.0.0.1:9545'));
	}

	app.start();
});