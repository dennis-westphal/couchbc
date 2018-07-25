// Import the page's CSS. Webpack will know what to do with it.
import '../css/materialize.css';
import '../css/app.css';

// Import libraries we need.
import '../js/materialize.js';
import {default as Vue} from 'vue';
import {default as Web3} from 'web3';

// Import our contract artifacts and turn them into usable abstractions.
import rent_artifacts from '../../build/contracts/Rent.json';

import Datepicker from 'vuejs-datepicker';

// Save the account and the rent contract
let account;
let rentContract;

function showMessage(message) {
	M.toast({html: message});
}

let app = new Vue({
	el:         '#app',
	data:       () => ({
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
		apartmentsFrom:   '',
		apartmentsTill:   '',
	}),
	watch:      {
		apartmentsFrom: () => {
			app.changeApartmentFilter();
		},
		apartmentsTill: () => {
			app.changeApartmentFilter();
		},
	},
	methods:    {
		register:              clickEvent => {
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
		addApartment:          clickEvent => {
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
						Object.assign(app.$data.newApartmentData, app.$options.data.call(app).newApartmentData);
					});
		},
		changeApartmentFilter: (apartmentsFrom, apartmentsTill) => {

			// Only apply filter if we have dates
			if (typeof(app.apartmentsFrom) !== 'object' ||
					typeof(app.apartmentsTill) !== 'object') {
				app.loadApartments();
				return;
			}

			app.loadApartments(
					app.getUnixDay(app.apartmentsFrom),
					app.getUnixDay(app.apartmentsTill),
			);
		},
		loadApartments:        (fromDay, tillDay) => {
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
									call((error, apartment) => {
										if (error) {
											console.error(error);
											return;
										}

										// Check if we need to apply a filter
										if (typeof(fromDay) === 'undefined') {
											app.apartments.push(apartment);
											return;
										}

										rentContract.methods.isAvailable(apartment.id, fromDay, tillDay).
												call((error, available) => {
													if (available) {
														app.apartments.push(apartment);
													}
												});
									});
						}
					});
		},

		checkAccount:      () => {
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
		refreshBalance:    () => {
			rentContract.methods.getBalance().call((error, balance) => {
				if (error) {
					console.error(error);
					return;
				}

				app.balance = parseInt(balance);
			});
		},
		updateUserRentals: () => {

		},
		rent:              (apartment) => {
			let fromDay = app.getUnixDay(app.apartmentsFrom);
			let tillDay = app.getUnixDay(app.apartmentsTill);
			let cost = apartment.pricePerNight * (tillDay - fromDay) + apartment.deposit;

			let method = rentContract.methods.rent(apartment.id, fromDay, tillDay);

			// If we got enough balance, we can just send it
			if (cost <= app.balance) {
				method.estimateGas().then(gasAmount => {
					method.send({gas: gasAmount});
				});
			}

			// Determine the required value to aquire the balance and send it along
			rentContract.methods.getBalanceCost(cost - app.balance).call((error, costInWei) => {
				method.estimateGas({value: costInWei}).then(gasAmount => {
					method.send({gas: gasAmount, value: costInWei});
				});
			});
		},

		start:      () => {
			// Get the contract from the artifacts
			rentContract = new web3.eth.Contract(rent_artifacts.abi, rent_artifacts.networks[4447].address);

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

				rentContract.events.Rented({}, (error, event) => {
					console.log(error, event);
				});

				app.loadApartments();
			});

			// Initialize datepickers
			let elements = document.querySelectorAll('.datepicker');
			M.Datepicker.init(elements, {
				format:   'yyyy-mm-dd',
				onSelect: app.changeApartmentFilter,
			});
		},
		getUnixDay: function(date) {
			return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
		},
	},
	components: {
		'datepicker': Datepicker,
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