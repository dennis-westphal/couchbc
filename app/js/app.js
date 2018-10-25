// Define the server address (for now)
const websocketAddress = 'wss://couchbc.com';
const ipfsAddr = 'fmberlin.ddns.net';
const ipfsPort = 5051;
const ipfsGatewayUrl = '/ipfs/';

// Import the page's SCSS. Webpack will know what to do with it.
import '../scss/app.scss';

// Import libraries we need.
import {default as $} from 'jquery';
import {default as Vue} from 'vue';
import {default as Web3} from 'web3';
import {default as NodeBuffer} from 'buffer';
import {default as IpfsApi} from 'ipfs-api';
import Toasted from 'vue-toasted';
import VueGoogleAutocomplete from 'vue-google-autocomplete';

// Import our contract artifacts and turn them into usable abstractions.
import rent_artifacts from '../../build/contracts/Rent.json';

import Datepicker from 'vuejs-datepicker';
import moment from 'moment';

// Blockies for account icons
require('./blockies.min.js');

// Foundation for site style and layout
require('foundation-sites');

// Elliptic for elliptic curve cryptography
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

// Eccrypto for ECIES
const eccrypto = require('eccrypto');

// Save the rent contract
let rentContract;

const defaultToastOptions = {
	duration: 3000,
};

function showMessage(message, options) {
	Vue.toasted.show(message, $.extend({}, defaultToastOptions, options));
}

Vue.use(Toasted);

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
		accounts:             [],
		rentalAccount:        null,
		ownerAccount:         null,
		interactionOwnerKeys: [],

		page: 'start',

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
		currentApartment: null,
		currentRental:    null,
		deductAmount:     0,
		apartmentRentals: [],
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
		rentalAccount:  (rentalAccount) => {
			web3.eth.defaultAccount = app.rentalAccount;
			rentContract.options.from = app.rentalAccount;

			// Check if the eth account has an account
			//app.checkAccount();

			// Load the apartments
			//app.loadApartments();
		},
	},
	methods:    {
		changeAddress: (addressData, placeResultData, id) => {
			if (typeof(addressData.locality) !== 'undefined' && typeof(addressData.country) !== 'undefined') {
				app.searchApartment(addressData.country, addressData.locality);
			}
		},

		searchApartment: (country, city) => {


			// Test
			app.refuseRental();
		},

		refuseRental: (rental) => {

			let testId = 25;

			let key = ec.genKeyPair();

			// TODO: Sometimes this is just 65 chars long instead of 66. Find out why.
			let testPrivateKey = '0x' + key.getPrivate().toString(16);

			let data = 'refuse:' + testId;

			let testAccount = web3.eth.accounts.privateKeyToAccount(testPrivateKey);
			let testSign = web3.eth.accounts.sign(data, testPrivateKey);

			console.log(testAccount);

			let params = [
				testId,
				testSign.signature,
			];

			console.log(params);
			console.log(web3.eth.accounts.recover(data, testSign.v, testSign.r, testSign.s));

			let method = rentContract.methods.refuseRental(...params);

			method.estimateGas({from: app.accounts[0]}).then(gasAmount => {
				method.send({from: app.accounts[0], gas: gasAmount});
			});
		},

		redrawMenu:            () => {
			let menu = $('#menu');

			menu.foundation('_destroy');
			app.$nextTick(() => {
				new Foundation.DropdownMenu(menu);
			});
		},
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
		uploadString:          async str => {
			// Get an IPFS connection
			let ipfsConnection = new IpfsApi(ipfsAddr, ipfsPort);

			// Fill a file buffer with the string
			let filledBuffer = NodeBuffer.from(str);

			// Add the file to IPFS
			ipfsConnection.files.add(filledBuffer, (err, result) => {
				if (err) {
					console.error(err);
					showMessage('Could not upload string to IPFS');

					reject();
					return;
				}

				console.log('String uploaded to ' + result[0].hash);

				resolve(result[0].hash);
			});
		},
		uploadImage:           async inputElement => {
			// Return a promise that is resolved if the image upload succeeded
			return new Promise((resolve, reject) => {
				let reader = new FileReader();
				reader.onloadend = () => {
					// Get an IPFS connection
					let ipfsConnection = new IpfsApi(ipfsAddr, ipfsPort);

					// Fill a file buffer
					let filledBuffer = NodeBuffer.Buffer(reader.result);

					// Add the file to IPFS
					ipfsConnection.files.add(filledBuffer, (err, result) => {
						if (err) {
							console.error(err);
							showMessage('Could not upload file to apartment image');

							reject();
							return;
						}

						console.log('Image uploaded to ' + result[0].hash);

						resolve(result[0].hash);
					});
				};

				reader.readAsArrayBuffer(inputElement.files[0]);
			});
		},
		addApartment:          async clickEvent => {
			let keyPairA = ec.genKeyPair();
			let keyPairB = ec.genKeyPair();

			let privateKeyA = keyPairA.getPrivate().toBuffer();
			let publicKeyA = eccrypto.getPublic(privateKeyA);
			let privateKeyB = keyPairB.getPrivate().toBuffer();
			let publicKeyB = eccrypto.getPublic(privateKeyB);

// Encrypting the message for B.
			eccrypto.encrypt(publicKeyB, Buffer('msg to b')).then(function(encrypted) {
				// B decrypting the message.
				eccrypto.decrypt(privateKeyB, encrypted).then(function(plaintext) {
					console.log('Message to part B:', plaintext.toString());
				});
			});

// Encrypting the message for A.
			eccrypto.encrypt(publicKeyA, Buffer('msg to a')).then(function(encrypted) {
				// A decrypting the message.
				eccrypto.decrypt(privateKeyA, encrypted).then(function(plaintext) {
					console.log('Message to part A:', plaintext.toString());
				});
			});

			return;

			let inputElement = document.getElementById('add-apartment-image');

			let imageHash = (inputElement.files[0])
					? await app.uploadImage(inputElement)
					: '';

			let details = {
				'title':         app.newApartmentData.title,
				'street':        app.newApartmentData.street,
				'zip':           app.newApartmentData.zip,
				'city':          app.newApartmentData.city,
				'country':       app.newApartmentData.country,
				'primaryImage':  imageHash,
				'pricePerNight': app.newApartmentData.pricePerNight,
				'deposit':       app.newApartmentData.deposit,
			};

			let detailsHash = await app.uploadString(JSON.stringify(details));

			let apartmentParameters = [];

		},
		addApartmentToBc:      (image) => {
			// Using the ES2015 spread operator does not work on vue data objects
			let parameters = [
				app.newApartmentData.title,
				app.newApartmentData.street,
				app.newApartmentData.zip,
				app.newApartmentData.city,
				app.newApartmentData.country,
				image || '',
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
		addApartmentImage:     (apartment) => {
			let inputElement = document.getElementById('add-apartment-image');

			// Check if we need to upload an image to IPFS
			app.uploadImage(inputElement).then(hash => {
				if (error) {
					console.error(error);
					showMessage('Could not upload image');
					return;
				}

				let method = rentContract.methods.addApartmentImage(apartment.id, hash);

				method.estimateGas().then(gasAmount => {
					method.send({gas: gasAmount});
				});
			});
		},
		getTotalPrice:         (apartment) => {
			let days = app.getUnixDay(app.apartmentsTill) - app.getUnixDay(app.apartmentsFrom);

			if (days > 0) {
				return app.pricePerNight * days;
			}

			return null;
		},
		getImageUrl:           (image) => {
			return ipfsGatewayUrl + image;
		},
		getRandomColor:        () => {
			let oneBlack = Math.random() * 10;

			let r = oneBlack <= 0.3333 ? 0 : Math.floor(Math.random() * 255);
			let g = (oneBlack <= 0.6666 && oneBlack > 0.3333) ? 0 : Math.floor(Math.random() * 255);
			let b = oneBlack > 0.6666 ? 0 : Math.floor(Math.random() * 255);

			return 'rgba(' + r + ', ' + g + ', ' + b + ', 0.15';
		},
		getApartmentStyle:     (apartment) => {
			// Don't apply a specific style if we have an image
			if (apartment.primaryImage) {
				return '';
			}

			return 'background-color: ' + app.getRandomColor();
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
							app.loadApartmentData(apartment);
							return;
						}

						rentContract.methods.isAvailable(apartment.id, fromDay, tillDay).call((error, available) => {
							if (available) {
								app.loadApartmentData(apartment);
							}
						});
					});
				}
			});
		},
		loadApartmentData:     (apartment) => {
			// Load the address data for the apartment
			rentContract.methods.getPhysicalAddress(apartment.physicalAddress).call((error, physicalAddress) => {
				// Ensure we add an apartment to the list twice by checking if it already exists in the apartments
				for (let exitingApartment of app.apartments) {
					if (exitingApartment.id === apartment.id) {
						return;
					}
				}

				// Add the apartment with the address to the apartment list
				apartment.address = physicalAddress;
				app.apartments.push(apartment);

				// Load apartment images
				apartment.images = [];
				for (let i = 0; i < apartment.numImages; i++) {
					rentContract.methods.getApartmentImage(apartment.id, i).call(image => {
						apartment.images.push(image);
					});
				}
			});
		},
		loadUserApartments:    () => {
			// TODO: images

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
			// Estimate gas and call the disableApartment function
			let method = rentContract.methods.disableApartment(apartment.id);
			method.estimateGas().then(gasAmount => {
				method.send({gas: gasAmount});
			});
		},
		showApartmentRentals:  apartment => {
			app.currentApartment = apartment;
			app.apartmentRentals = [];

			rentContract.methods.getApartmentRentalsNum(apartment.id).call((error, result) => {
				if (error) {
					console.error(error);
					return;
				}

				let numRentals = parseInt(result);
				let promises = [];

				for (let i = 0; i < numRentals; i++) {
					promises.push(rentContract.methods.getApartmentRental(apartment.id, i).call((error, rental) => {
						rental.from = new Date(rental.fromDay * 1000 * 60 * 60 * 24);
						rental.till = new Date(rental.tillDay * 1000 * 60 * 60 * 24);
						app.apartmentRentals.push(rental);
					}));
				}

				Promise.all(promises).then(() => {
					app.page = 'apartment-rentals';
				});
			});
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

					// Refresh the user balance
					app.refreshBalance();

					// Load the user rentals
					app.updateUserRentals();

					// Load the user apartments
					app.loadUserApartments();
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
		refundDeposit:     rental => {
			app.currentRental = rental;
			app.page = 'refund-deposit';
		},
		doRefundDeposit:   () => {
			let method = rentContract.methods.refundDeposit(app.currentRental.rentalId, parseInt(app.deductAmount));
			method.estimateGas().then(gasAmount => {
				method.send({gas: gasAmount});

				showMessage('Deposit refund started...');
			});
		},
		claimDeposit:      rental => {
			let method = rentContract.methods.claimDeposit(rental.rentalId);
			method.estimateGas().then(gasAmount => {
				method.send({gas: gasAmount});

				showMessage('Deposit claim started...');
			});
		},
		rent:              apartment => {
			let fromDay = app.getUnixDay(app.apartmentsFrom);
			let tillDay = app.getUnixDay(app.apartmentsTill);
			let cost = apartment.pricePerNight * (tillDay - fromDay) + parseInt(apartment.deposit);

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

				app.addApartment();

				$(document).foundation();
			});
		},
		registerEvents: function() {
			rentContract.events.Test({}, (error, event) => {
				console.log(event.returnValues);
			});
			rentContract.events.TestAddr({}, (error, event) => {
				console.log(event.returnValues);
			});

			return;

			rentContract.events.ApartmentAdded({userAddress: app.account}, (error, event) => {
				if (error) {
					console.error(error);
					showMessage('Apartment could not be added');
					return;
				}

				showMessage('Apartment successfully added');

				app.loadApartments();
				app.loadUserApartments();
			});

			rentContract.events.ApartmentEnabled({userAddress: app.account}, (error, event) => {
				if (error) {
					console.error(error);
					showMessage('Apartment could not be enabled');
					return;
				}
				showMessage('Apartment successfully enabled');

				app.loadApartments();
				app.loadUserApartments();
			});
			rentContract.events.ApartmentDisabled({userAddress: app.account}, (error, event) => {
				if (error) {
					console.error(error);
					showMessage('Apartment could not be disabled');
					return;
				}
				showMessage('Apartment successfully disabled');

				app.loadApartments();
				app.loadUserApartments();
			});

			rentContract.events.ImageAdded({userAddress: app.account}, (error, event) => {
				if (error) {
					console.error(error);
					showMessage('Image could not be added');
					return;
				}

				showMessage('Image successfully added');

				// Add the image to the apartment
				for (let currentApartment of app.apartments) {
					if (currentApartment.id === event.returnValues.apartmentId) {
						app.apartments.images.push(event.returnValues.apartmentId);
						return;
					}
				}

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

				if (app.page === 'apartments') {
					app.page = 'rentals';
				}

				app.updateUserRentals();
				app.refreshBalance();
			});

			rentContract.events.DepositRefunded({ownerAddress: app.account}, (error, event) => {
				if (error) {
					console.error(error);
					showMessage('Deposit could not be refunded');
					return;
				}

				showMessage('Deposit successfully refunded');

				app.deductAmount = 0;

				if (app.page === 'refund-deposit') {
					app.page = 'user-apartments';
				}

				app.refreshBalance();
			});
			rentContract.events.DepositRefunded({tenantAddress: app.account}, (error, event) => {
				if (error) {
					console.error(error);
					return;
				}

				showMessage('Deposit claimable for rental ' + event.returnValues.rentalId + ' (' +
						event.returnValues.deductedAmount + ' credits have been deducted)');

				app.deductAmount = 0;

				if (app.page === 'refund-deposit') {
					app.page = 'user-apartments';
				}

				app.updateUserRentals();
			});
			rentContract.events.DepositClaimed({userAddress: app.account}, (error, event) => {
				if (error) {
					console.error(error);
					showMessage('Deposit could not be claimed');
					return;
				}

				showMessage('Deposit successfully claimed');
				app.refreshBalance();
				app.updateUserRentals();
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
		'datepicker':  Datepicker,
		'autoaddress': VueGoogleAutocomplete,
	},
});

window.addEventListener('load', () => {
	// We can't use Metamask's web3 currently as subscriptions through websockets are still in dev
	if (typeof web3 !== 'undefined' && false) {
		// Use Mist/MetaMask's provider
		window.web3 = new Web3(web3.currentProvider);
	} else {
		console.warn(
				'No web3 detected. Falling back to ' + websocketAddress +
				'. You should remove this fallback when you deploy live, as it\'s inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask');
		// fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
		window.web3 = new Web3(
				new Web3.providers.WebsocketProvider(websocketAddress));
	}

	app.start();
});