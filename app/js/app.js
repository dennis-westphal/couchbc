// Define the server address (for now)
const websocketAddress = 'wss://couchbc.com';
const ipfsAddr = {'host': 'couchbc.com', 'port': 443, 'protocol': 'https'};
const ipfsGatewayUrl = '/ipfs/';

// Import the page's SCSS. Webpack will know what to do with it.
import '../scss/app.scss';

// Import libraries we need.
import {default as $} from 'jquery';
import {default as Vue} from 'vue';
import {default as Web3} from 'web3';
import {default as IpfsApi} from 'ipfs-api';
import {default as bs58} from 'bs58';
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
// Will also include Buffer.Buffer as Buffer
const crypto = require('crypto'); //
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
		wallet: null,

		accounts:             [],
		defaultTenantAccount: null,
		defaultOwnerAccount:  null,

		page: 'start',

		newUserData:      {
			name:    '',
			street:  '',
			zip:     '',
			city:    '',
			country: '',
		},
		newApartmentData: {
			account:       '',
			title:         '',
			street:        '',
			zip:           '',
			city:          '',
			country:       '',
			pricePerNight: 0,
			deposit:       0,
			primaryImage:  '',
			images:        [],
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
		changeSearchAddress: (addressData, placeResultData, id) => {
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

		redrawMenu:             () => {
			let menu = $('#menu');

			menu.foundation('_destroy');
			app.$nextTick(() => {
				new Foundation.DropdownMenu(menu);
			});
		},
		register:               clickEvent => {
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
		uploadString:           str => {
			// Get an IPFS connection
			let ipfsConnection = IpfsApi(ipfsAddr);

			// Fill a file buffer with the string
			let filledBuffer = Buffer(str);

			return new Promise((resolve, reject) => {
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
			});
		},
		uploadImage:            inputElement => {
			// Return a promise that is resolved if the image upload succeeded
			return new Promise((resolve, reject) => {
				let reader = new FileReader();
				reader.onloadend = () => {
					// Get an IPFS connection
					let ipfsConnection = IpfsApi(ipfsAddr);

					// Fill a file buffer
					let filledBuffer = Buffer(reader.result);

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
		changeApartmentAddress: (addressData, placeResultData, id) => {
			app.newApartmentData.street = addressData.route;
			app.newApartmentData.number = addressData.street_number;
			app.newApartmentData.city = addressData.locality;
			app.newApartmentData.country = addressData.country;
		},
		addApartment:           async clickEvent => {
			let keyPairA = ec.genKeyPair();
			let keyPairB = ec.genKeyPair();

			/*let privateKeyA = keyPairA.getPrivate().toBuffer();
			let publicKeyA = keyPairA.getPublic();
			let privateKeyB = keyPairB.getPrivate().toBuffer();
			let publicKeyB = keyPairB.getPublic();*/

			var privateKeyA = keyPairA.getPrivate().toBuffer(); // Uint8Array(32)
			var publicKeyA = app.getUint8ArrayFromPoint(keyPairA.getPublic());  // Uint8Array(32)
			//var publicKeyA = app.getUint8ArrayFromPoint(keyPairA.getPublic());  // Uint8Array(32)
			var privateKeyB = keyPairB.getPrivate().toBuffer();  // Uint8Array(32)
			var publicKeyB = app.getUint8ArrayFromPoint(keyPairB.getPublic());  // Uint8Array(32)

			console.log(eccrypto.getPublic(privateKeyA));
			console.log(app.getUint8ArrayFromPoint(keyPairA.getPublic()));

			// This is the same: (eccrypto always adds 04 in front of x and y point of public key)
			console.log('0x' + Buffer(eccrypto.getPublic(privateKeyA)).toString('hex'));
			console.log('0x' + app.getUint8ArrayFromPoint(keyPairA.getPublic()).toString('hex'));

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

			let details = {
				title:         app.newApartmentData.title,
				street:        app.newApartmentData.street,
				zip:           app.newApartmentData.zip,
				city:          app.newApartmentData.city,
				country:       app.newApartmentData.country,
				pricePerNight: app.newApartmentData.pricePerNight,
				deposit:       app.newApartmentData.deposit,
				primaryImage:  '',
				images:        [],
			};

			// Upload images
			let promises = [];

			// Upload primary image
			let primaryImageInputElement = document.getElementById('add-apartment-primary-image');
			if (primaryImageInputElement.files[0]) {
				promises.push(new Promise((resolve, reject) => {
					app.uploadImage(primaryImageInputElement).then(hash => {
						details.primaryImage = app.ipfsAddrToHash(hash);

						resolve();
					});
				}));
			}

			// Upload other images
			$('.page.add-apartment image.add-image').each((index, element) => {
				if (element.files[0]) {
					let index = $(element).data('index');

					promises.push(new Promise((resolve, reject) => {
						app.uploadImage(element).then(hash => {
							details.images[index] = app.ipfsAddrToHash(hash);

							resolve();
						});
					}));
				}
			});

			// Only proceed when all images have been uploaded
			await Promise.all(promises);

			// Upload the details
			let detailsAddress = await app.uploadString(JSON.stringify(details));
			let cityHash = web3.utils.keccak256(JSON.stringify({
				'city':    app.newApartmentData.city,
				'country': app.newApartmentData.country,
			}));

			let parameters = [
				'0x' + (keyPairA.getPublic().x.toString(16)),
				'0x' + (keyPairA.getPublic().y.toString(16)),
				app.ipfsAddrToHash(detailsAddress),
				cityHash,
			];

			// Estimate gas and call the addApartment function
			let method = rentContract.methods.addApartment(...parameters);
			method.estimateGas().then(gasAmount => {
				method.send({from: app.newApartmentData.account.address, gas: gasAmount});
			});

			rentContract.once('ApartmentAdded',
					{filter: {owner: app.newApartmentData.account.address}}, (error, event) => {
						console.log(event.returnValues);

						if (error) {
							showMessage('Could not add apartment');
							console.error(error);
							return;
						}

						showMessage('Apartment added');

						// Change the page if we're currently on the add apartment page
						//if (app.page === 'add-apartment') {
						//	app.page = 'apartments';
						//}

						// Clear the form
						Object.assign(app.$data.newApartmentData, app.$options.data.call(app).newApartmentData);
					});
		},
		addApartmentImage:      (apartment) => {
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
		getTotalPrice:          (apartment) => {
			let days = app.getUnixDay(app.apartmentsTill) - app.getUnixDay(app.apartmentsFrom);

			if (days > 0) {
				return app.pricePerNight * days;
			}

			return null;
		},
		getImageUrl:            (image) => {
			return ipfsGatewayUrl + image;
		},
		getBlockie:             account => {
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
		getRandomColor:         () => {
			let oneBlack = Math.random() * 10;

			let r = oneBlack <= 0.3333 ? 0 : Math.floor(Math.random() * 255);
			let g = (oneBlack <= 0.6666 && oneBlack > 0.3333) ? 0 : Math.floor(Math.random() * 255);
			let b = oneBlack > 0.6666 ? 0 : Math.floor(Math.random() * 255);

			return 'rgba(' + r + ', ' + g + ', ' + b + ', 0.15';
		},
		getApartmentStyle:      (apartment) => {
			// Don't apply a specific style if we have an image
			if (apartment.primaryImage) {
				return '';
			}

			return 'background-color: ' + app.getRandomColor();
		},
		changeApartmentFilter:  (apartmentsFrom, apartmentsTill) => {
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
		loadApartments:         (fromDay, tillDay) => {
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
		loadApartmentData:      (apartment) => {
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
		loadUserApartments:     () => {
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
		disableApartment:       apartment => {
			// Estimate gas and call the disableApartment function
			let method = rentContract.methods.disableApartment(apartment.id);
			method.estimateGas().then(gasAmount => {
				method.send({gas: gasAmount});
			});
		},
		showApartmentRentals:   apartment => {
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

		start: () => {
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

				app.determineAccounts(accounts);

				app.registerEvents();

				$(document).foundation();
			});
		},

		// Check all accounts for existing owner / tenant profiles and interaction keys
		determineAccounts: accounts => {
			for (let account of accounts) {
				rentContract.methods.getAddressType().call({from: account}, (error, type) => {
					app.accounts.push({
						'address': account,
						'type':    type,
					});

					// TODO: Determine accounts with interaction keys (locally)
				});
			}
		},

		registerEvents: () => {
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

		changeImageSrc: event => {
			let input = event.target;
			let previewImg = $(input).next('img.preview');

			// If we don't have a file, hide the preview
			if (typeof(input.files) !== 'object' || typeof(input.files[0]) === 'undefined') {
				previewImg.hide();

				return;
			}

			let reader = new FileReader();

			reader.onload = function(e) {
				previewImg.attr('src', e.target.result).show();
			};

			reader.readAsDataURL(input.files[0]);
		},

		// Cryptography

		/**
		 * Get the wallet. Asks user for password if wallet hasn't been decrypted or created yet
		 *
		 * @return {web3.eth.accounts.wallet}
		 */
		getWallet: async () => {
			if (app.wallet) {
				return wallet;
			}

			// Check if we have a wallet; if so, ask user for password
			if (window.localStorage.getItem('web3js_wallet')) {
				// TODO: Implement asking for password
				let password = 'secret';

				let wallet = web3.eth.accounts.wallet.load(password);

				// TODO: Retry password till we have a wallet

				app.walletPassword = password;
				app.wallet = wallet;
				return wallet;
			}

			// Otherwise, ask user to specify password for new wallet
			// TODO: Implement asking for password
			let password = 'secret';

			app.walletPassword = password;
			app.wallet = web3.eth.accounts.wallet.create();

			return app.wallet;
		},

		// Get or create a public key to be used for an owner account
		getOrCreateOwnerPublicKey: account => {
			let publicKey = app.getPublicKeyForAddress(account.address);

			// Check if we have a public key in local storage; if we do, return it
			if (publicKey != null) {
				return publicKey;
			}

			// Check if the account is already registered at the blockchain as owner account;
			// in this case we should already have a public key for it => show an error
			if (account.type === 'owner') {
				showMessage('Could not get public key for existing owner account');

				return null;
			}

			let keyPair = app.generateKeyPair();

			// Store the account in the localStorage; for now unencrypted
		},

		// Get the public key for the account from secure storage
		// Returns null if no public key exists
		getPublicKeyForAccount: account => {
			// Local storage is acting as hashmap: account address => keypair wallet address
			// (Keypair may already have been added to wallet, but not to

			// The account address is used to find the key; the address contained within is NOT the same as the account address
			let keyPair = window.localStorage.getItem('keyPairs.' + account.address);

		},

		/**
		 * Get an Ec account for the given address from the wallet
		 *
		 * Returns null if no Ec account was found or an object with:
		 * {
		 *   private: "0x0000...",
		 *   public: {
		 *     x:         "0x0000...",    (0x + 32x hex encoded bytes = 66 chars)
		 *     y:         "0x0000...",    (0x + 32y bytes hex = 66 chars)
		 *     combined:  "0x0400000..."  (0x04 + 32x bytes hex 32y bytes hex = 135 chars)
		 *   }
		 *   address:     "0x0000..."     (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
		 * }
		 */
		getEcAccount: async address => {
			// Get the wallet
			let wallet = await app.getWallet();

			// Check if an Ec account exists at the address
			if (typeof(wallet[address]) === 'undefined') {
				return null;
			}

			return app.getEcAccountForWalletAccount(wallet[address]);
		},

		/**
		 * Generate an account used for ec cryptography.
		 * Stores the generated account in the user's encrypted wallet.
		 *
		 * Returns an object with:
		 * {
		 *   private: "0x0000...",
		 *   public: {
		 *     x:         "0x0000...",    (0x + 32x hex encoded bytes = 66 chars)
		 *     y:         "0x0000...",    (0x + 32y bytes hex = 66 chars)
		 *     combined:  "0x0400000..."  (0x04 + 32x bytes hex 32y bytes hex = 135 chars)
		 *   }
		 *   address:     "0x0000..."     (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
		 * }
		 */
		generateEcAccount: async () => {
			// Get the wallet
			let wallet = await app.getWallet();

			let keyPair = ec.genKeyPair();

			let privateKey = keyPair.getPrivate().toBuffer();
			let publicKey = keyPair.getPublic();

			// This is the same: (eccrypto always adds 04 in front of x and y point of public key)
			//console.log('0x' + Buffer(eccrypto.getPublic(privateKey)).toString('hex'));
			//console.log('0x04' + (keyPair.getPublic().x.toString(16)) + (keyPair.getPublic().y.toString(16)));

			let pkHex = privateKey.toString(16);
			let xHex = publicKey.x.toString(16);
			let yHex = publicKey.y.toString(16);
			let account = web3.eth.accounts.privateKeyToAccount('0x' + pkHex);

			// Save the account in the wallet
			wallet.add(account);
			wallet.save(app.walletPassword);

			return {
				private: '0x' + pkHex,
				public:  {
					x:        '0x' + xHex,
					y:        '0x' + yHex,
					combined: '0x04' + xHex + yHex,
				},
				address: account.address,
			};
		},

		/**
		 * Get an account to the specified private key.
		 *
		 * Returns an object with:
		 * {
		 *   private: "0x0000...",
		 *   public: {
		 *     x:         "0x0000...",    (0x + 32x hex encoded bytes = 66 chars)
		 *     y:         "0x0000...",    (0x + 32y bytes hex = 66 chars)
		 *     combined:  "0x0400000..."  (0x04 + 32x bytes hex 32y bytes hex = 135 chars)
		 *   }
		 *   address:     "0x0000..."     (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
		 * }
		 *
		 * @param account
		 * @return {{private: string, public: {x: string, y: string, combined: string}, address: *}}
		 */
		getEcAccountForWalletAccount: account => {
			// Get the public key for the private key
			let privateKeyArray = app.hexToUint8Array(account.privateKey.substr(2));

			let publicKeyHex = Buffer(eccrypto.getPublic(privateKeyArray)).toString('hex');

			let pkHex = account.privateKey.substr(2);
			let xHex = publicKeyHex.substr(2, 64);
			let yHex = publicKeyHex.substr(66);

			return {
				private: '0x' + pkHex,
				public:  {
					x:        '0x' + xHex,
					y:        '0x' + yHex,
					combined: '0x04' + xHex + yHex,
				},
				address: account.address,
			};
		},

		/**
		 * Get an uint8array to use with eccrypto from a public point
		 * @param point
		 * @return {Uint8Array}
		 */
		getUint8ArrayFromPoint: point => {
			let arr = new Uint8Array(65);
			arr[0] = 4;
			arr.set(point.x.toBuffer(), 1);
			arr.set(point.y.toBuffer(), 33);

			return new Uint8Array(arr);
		},

		/**
		 * Get an uint8array to use with eccrypto from a x and y hex coordinates (without 0x prefix)
		 * @param x
		 * @param y
		 * @return {Uint8Array}
		 */
		getUint8ArrayFromXY: (x, y) => {
			let arr = new Uint8Array(65);
			arr[0] = 4;
			arr.set(app.hexToUint8Array(x), 1);
			arr.set(app.hexToUint8Array(y), 33);

			return arr;
		},

		/**
		 * Convert a hex string to an Uint8 array
		 *
		 * @param hex
		 * @return {Uint8Array}
		 */
		hexToUint8Array: (hex) => {
			let arr = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

			return arr;
		},

		// Date
		getUnixDay: date => {
			return Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
		},

		// Units
		weiToEth:    wei => {
			return Math.floor(wei / Math.pow(10, 15)) / Math.pow(10, 3);
		},
		ethToWei:    eth => {
			return eth * Math.pow(10, 18);
		},
		weiToFinney: wei => {
			return Math.floor(wei / Math.pow(10, 15));
		},
		finneyToWei: finney => {
			return finney * Math.pow(10, 15);
		},

		// IPFS utilities
		ipfsAddrToHash: address => {
			return '0x' + (bs58.decode(address).toString('hex')).substr(4);
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