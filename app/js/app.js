// Import the page's CSS. Webpack will know what to do with it.
import '../css/materialize.css';
import '../css/app.css';

// Import libraries we need.
import '../js/materialize.js';
import {default as Vue} from 'vue';
import {default as Web3} from 'web3';
import {default as contract} from 'truffle-contract';

// Import our contract artifacts and turn them into usable abstractions.
import rent_artifacts from '../../build/contracts/Rent.json';

// Get the contract from the artifacts
let Rent = contract(rent_artifacts);

// Save the account and the rent contract
let account;
let rentContract;

function showMessage(message) {
	M.toast({html: message});
}

let app = new Vue({
	el:      '#app',
	data:    {
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
	},
	methods: {
		register:       function(event) {
			event.preventDefault();

			// Call the register function
			// Using the ES2015 spread operator does not work on vue data objects
			rentContract.register(
					this.newUserData.name,
					this.newUserData.street,
					this.newUserData.zip,
					this.newUserData.city,
					this.newUserData.country,
			);

			// Only watch for the event if we registered just now
			rentContract.Registered({}).watch((err, result) => {
				console.log(err, result);

				if (result.args.userAddress === account) {
					showMessage('Registered successfully');

					app.accountChecked = true;
					app.registered = result;

					// Change the page if we're currently on the registration page
					if (app.page === 'register') {
						app.page = 'apartments';
					}

					app.refreshBalance();

					return;
				}

				showMessage('Could not process registration');
			});
		},
		addApartment:   function(event) {
			event.preventDefault();

			// Call the register function
			// Using the ES2015 spread operator does not work on vue data objects
			rentContract.addApartment(
					this.newApartmentData.title,
					this.newApartmentData.street,
					this.newApartmentData.zip,
					this.newApartmentData.city,
					this.newApartmentData.country,
					this.newApartmentData.pricePerNight,
					this.newApartmentData.deposit,
			);
		},
		loadApartments: function() {
			rentContract.getApartmentsNum().then(function(result) {
				app.apartments = [];

				let numApartments = result.toNumber();
				for (let i = 0; i < numApartments; i++) {
					rentContract.getApartment(i).then(function(result) {
						console.log(result);
					});
				}
			});
		},

		checkAccount:   function() {
			rentContract.isRegistered().then(function(result) {
				app.accountChecked = true;
				app.registered = result;

				if (app.registered) {
					showMessage('Successfully logged in');

					app.refreshBalance();
				}
			});
		},
		refreshBalance: function() {
			rentContract.getBalance().then(function(balance) {
				app.balance = balance.toNumber();
			});
		},

		start: function() {
			Rent.setProvider(web3.currentProvider);

			web3.eth.getAccounts(function(err, accs) {
				if (err != null) {
					alert('There was an error fetching your accounts.');
					return;
				}

				if (accs.length == 0) {
					alert('Couldn\'t get any accounts! Make sure your Ethereum client is configured correctly.');
					return;
				}

				account = accs[0];

				web3.eth.defaultAccount = account;

				Rent.deployed().then(function(deployedContract) {
					rentContract = deployedContract;

					app.checkAccount();
					app.loadApartments();

					rentContract.ApartmentAdded({}).watch((err, result) => {
						if (err) {
							console.log(err);
							return;
						}

						app.loadApartments();

						if (result.args.userAddress === account) {
							// TODO: Only show this after adding the apartment
							showMessage('Apartment added');
							return;
						}

						showMessage('Could not process registration');
					});
				});
			});
		},
	},
});

window.addEventListener('load', function() {
	// Checking if Web3 has been injected by the browser (Mist/MetaMask)
	if (typeof web3 !== 'undefined') {
		// Use Mist/MetaMask's provider
		window.web3 = new Web3(web3.currentProvider);
	} else {
		console.warn(
				'No web3 detected. Falling back to http://127.0.0.1:7545. You should remove this fallback when you deploy live, as it\'s inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask');
		// fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
		window.web3 = new Web3(
				new Web3.providers.HttpProvider('http://127.0.0.1:7545'));
	}

	app.start();
});
