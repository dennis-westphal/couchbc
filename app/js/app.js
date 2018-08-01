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
import moment from 'moment';

require('./blockies.min.js');

// Save the rent contract
let rentContract;

function showMessage(message) {
	M.toast({html: message});
}

Vue.filter('formatDate', function(date) {
	if (date) {
		return moment(date).format('DD.MM.YYYY');
	}
});
Vue.filter('formatDateTime', function(date) {
	if (date) {
		return moment(date).format('DD.MM.YYYY hh:mm');
	}
});

let app = new Vue({
	el:         '#app',
	data:       () => ({
		accounts:         [],
		account:          null,
		page:             'start',
		registered:       false,
		balance:          0,
		ethBalance:       0,
		transferEth:      0,
		transferCredits:  0,
		payoutEth:        0,
		payoutCredits:    0,
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
		userApartments:   [],
		rentals:          [],
		apartmentsFrom:   '',
		apartmentsTill:   '',
		disabledDates:    {
			to: new Date(),
		},
	}),
	watch:      {
		apartmentsFrom: () => {
			app.changeApartmentFilter();
		},
		apartmentsTill: () => {
			app.changeApartmentFilter();
		},
		transferEth:    (eth) => {
			rentContract.methods.weiToCredits(app.ethToWei(eth)).call((error, credits) => {
				if (error) {
					console.error(error);
					return;
				}

				app.transferCredits = credits;
			});
		},
		payoutCredits:  (credits) => {
			rentContract.methods.creditsToWei(credits).call((error, wei) => {
				if (error) {
					console.error(error);
					return;
				}

				app.payoutEth = app.weiToEth(wei);
			});
		},
		account:        (account) => {
			web3.eth.defaultAccount = app.account;
			rentContract.options.from = app.account;

			// Check if the eth account has an account
			app.checkAccount();

			// Load the apartments
			app.loadApartments();

			// Load the user apartments
			app.loadUserApartments();
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

			rentContract.once('Registered', {filter: {userAddress: app.account}},
					(error, event) => {
						if (error) {
							showMessage('Could not process registration');
							console.error(error);
							return;
						}

						showMessage('Registered successfully');

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
					{filter: {userAddress: app.account}}, (error, event) => {
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
			// TODO: When this is called twice at the same time, it will show duplicate apartments
			// => The callbacks are executed in parallel

			rentContract.methods.getApartmentsNum().call((error, result) => {
				if (error) {
					console.error(error);
					return;
				}

				app.apartments = [];

				let numApartments = parseInt(result);
				for (let i = 0; i < numApartments; i++) {
					rentContract.methods.getApartment(i).call((error, apartment) => {
						if (error) {
							console.error(error);
							return;
						}

						// Check if we need to apply a filter
						if (typeof(fromDay) === 'undefined') {
							app.apartments.push(apartment);
							return;
						}

						rentContract.methods.isAvailable(apartment.id, fromDay, tillDay).call((error, available) => {
							if (available) {
								app.apartments.push(apartment);
							}
						});
					});
				}
			});
		},
		loadUserApartments:    () => {
			rentContract.methods.getUserApartmentsNum().call((error, result) => {
				if (error) {
					console.error(error);
					return;
				}

				app.userApartments = [];

				let numApartments = parseInt(result);
				for (let i = 0; i < numApartments; i++) {
					rentContract.methods.getUserApartment(i).call((error, apartment) => {
						if (error) {
							console.error(error);
							return;
						}

						rentContract.methods.getApartmentRentalsNum(apartment.id).call((error, numRentals) => {
							apartment.rentals = numRentals;
							app.userApartments.push(apartment);
						});
					});
				}
			});
		},
		disableApartment:      apartment => {

		},
		showApartmentRentals:  apartment => {

		},

		getBlockie: account => {
			if (account) {
				return {
					'background-image': 'url(\'' + blockies.create({
						seed: account,
					}).toDataURL() + '\')',
				};
			}
			else {
				return {};
			}
		},

		checkAccount:      () => {
			rentContract.methods.isRegistered().call((error, result) => {
				if (error) {
					console.error(error);
					return;
				}

				app.registered = result;

				if (app.registered) {
					showMessage('Successfully logged in');

					app.refreshBalance();
					app.updateUserRentals();
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

			app.refreshEthBalance();
		},
		switchAccount:     index => {
			app.account = app.accounts[index];
			let params = new URLSearchParams(location.search);
			params.set('a', index);
			window.history.replaceState({}, '', `${location.pathname}?${params}`);
		},
		refreshEthBalance: () => {
			web3.eth.getBalance(app.account).then((weiBalance) => {
				app.ethBalance = app.weiToEth(weiBalance);
			});
		},
		doTransfer:        () => {
			let wei = app.ethToWei(app.transferEth);

			let method = rentContract.methods.transfer();
			method.estimateGas({value: wei}).then(gasAmount => {
				method.send({gas: gasAmount, value: wei});

				showMessage('Transfer started...');
			});
		},
		doPayout:          () => {
			let method = rentContract.methods.payout(app.payoutCredits);
			method.estimateGas().then(gasAmount => {
				method.send({gas: gasAmount + 21000});

				showMessage('Payout started...');
			});
		},
		updateUserRentals: () => {
			rentContract.methods.getUserRentalsNum().call((error, numRentals) => {
				if (error) {
					console.error(error);
					return;
				}

				if (numRentals === 0) {
					return;
				}

				app.rentals = [];

				for (let i = 0; i < numRentals; i++) {
					rentContract.methods.getUserRental(i).call((error, rental) => {
						rentContract.methods.getApartment(rental.apartmentId).call((error, apartment) => {
							rental.apartment = apartment;
							rental.from = new Date(rental.fromDay * 1000 * 60 * 60 * 24);
							rental.till = new Date(rental.tillDay * 1000 * 60 * 60 * 24);

							app.rentals.push(rental);
						});
					});
				}
			});
		},
		depositClaimable:  rental => {
			return false;
		},
		claimDeposit:      rental => {
			return false;
		},
		rent:              apartment => {
			let fromDay = app.getUnixDay(app.apartmentsFrom);
			let tillDay = app.getUnixDay(app.apartmentsTill);
			let cost = apartment.pricePerNight * (tillDay - fromDay) + apartment.deposit * 1;

			let method = rentContract.methods.rent(apartment.id, fromDay, tillDay);

			// If we got enough balance, we can just send it
			if (cost <= app.balance) {
				method.estimateGas().then(gasAmount => {
					method.send({gas: gasAmount});
				});
				return;
			}

			// Determine the required value to aquire the balance and send it along
			rentContract.methods.creditsToWei(cost - app.balance).call((error, costInWei) => {
				if (error) {
					console.error('Could not determine wei cost', error);
					showMessage('Could not book apartment');
					return;
				}

				method.estimateGas({value: costInWei}).then(gasAmount => {
					console.log('Sending ' + (costInWei + 21000) + ' wei along with transaction to pay for rent...');
					method.send({gas: gasAmount + 21000, value: costInWei});
				});
			});
		},

		start:          () => {
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

				app.accounts = accounts;

				// Use the first account unless specified otherwise in the params
				const params = new URLSearchParams(location.search);
				app.account = accounts[params.get('a') || 0];

				app.registerEvents();
			});

			// Initialize datepickers
			let elements = document.querySelectorAll('.datepicker');
			M.Datepicker.init(elements, {
				format:   'yyyy-mm-dd',
				onSelect: app.changeApartmentFilter,
			});

			// Initialize dropdown trigger
			M.Dropdown.init(document.querySelectorAll('.dropdown-trigger'));
		},
		registerEvents: function() {
			rentContract.events.ApartmentAdded({}, (error, event) => {
				if (error) {
					console.error(error);
					showMessage('Apartment could not be added');
					return;
				}

				app.loadApartments();
				app.loadUserApartments();
			});

			rentContract.events.Rented({userAddress: app.account}, (error, event) => {
				if (error) {
					console.error(error);
					showMessage('Apartment could not be rented');
					return;
				}

				showMessage('Apartment successfully rented');

				app.apartmentsFrom = '';
				app.apartmentsTill = '';

				app.updateUserRentals();
				app.refreshBalance();
			});

			rentContract.events.Transferred({userAddress: app.account}, (error, event) => {
				if (error) {
					console.error(error);
					showMessage('Failed to buy credits');
					return;
				}
				showMessage('Credits successfully bought');

				app.transferEth = 0;

				app.balance = event.returnValues.newBalance;
				app.refreshEthBalance();
			});

			rentContract.events.Paidout({userAddress: app.account}, (error, event) => {
				if (error) {
					console.error(error);
					showMessage('Failed to pay out credits');
					return;
				}
				showMessage('Successfully paid out credits');

				app.payoutCredits = 0;

				app.balance = event.returnValues.newBalance;
				app.refreshEthBalance();
			});
		},
		getUnixDay:     date => {
			return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
		},
		weiToEth:       wei => {
			return Math.floor(wei / Math.pow(10, 15)) / Math.pow(10, 3);
		},
		ethToWei:       eth => {
			return eth * Math.pow(10, 18);
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