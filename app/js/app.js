// Define the server address (for now)
const websocketAddress = 'wss://couchbc.com';
const ipfsHost = {'host': 'couchbc.com', 'port': 443, 'protocol': 'https'};
const ipfsGatewayUrl = '/ipfs/';

// Salt used for randomnesss generation. Change this in your application.
const salt = '4iMXBkp9o8q5lX0i264U9D3Zyas73m52';

// Constants used for google api requests (maps, places, geocoding)
const googleApiKey = 'AIzaSyBpuJvuXMUnbkZjS0XIQz_8hhZDdjNRvBE';
const googleApiProject = 'couchbc-1540415979753';
const pullInterval = 2000; // Pull every X milliseconds

// Credentials for google pub/sub service account, retrieved from JSON. Service account must be limited to a role with the following permissions:
// pubsub.subscriptions.consume
// pubsub.subscriptions.create
// pubsub.topics.attachSubscription
// pubsub.topics.publish
const googlePubSubKey = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDegsPPx9ryV6/Y\nYhMCUoujq5qmUvJbh8SQJlv5OHDXf5yNSviiYABeS2e4jXxxB6y40DNBVUibyJz4\ns9t+iYsJVRyjnYXWflTXazVID1c39wtHouwIMX/hKBh5xwaFBlQFVA7AMIxOB3fe\nCU72thGVEWGFyOYlr2m7VbGaJSpZ03IFeS+RMt0Ta93wI9Exin6xfulR+a/caOw5\nDuT8SEc9MBVHqiglEh2IQibnuG27cD6nqXT5wWuvLHjcacEQUkcHtBCs3vKW561c\nKLDIoeU4/fiq2CTOtjqiQ/fVy6fzdPaZ7S/vB2qPzi5kWnbzW+S0sXnTTCnTFR1/\nv9YHy5a1AgMBAAECggEAFMDMg5Yn2R+Nkph/HmHVjVPljirBWQEeN7WkMWfuumK4\nFsON0hMzJZhR2bg0iZRGK0yb4zWRmpoI7fdUewZYFew+yhHYmEtbHWZt50UrBNjB\nUBKlghQf0b+8HKuP85tF/eM7pvhANczjhK2IlGEh3a3r0x8MPCqSqXrSIEbkHtF5\n0nNJu9cD3B0F0L1gCxw62Wa4LGBRGKzaHBaceU0vAPXQ38nCNakttqWL71zFe3Ki\nOXB9Nd8/g5ptZIVqpKRypwGN1vkTW2TCrRhj5PGFJTC6UzaitMoNJnB8WU3mfZpI\na8e960ZqBSCFltcKx/X9USPe+cptcMaObVFCuJZkhwKBgQDz6c+QjDdfwX/QiJ3t\nL6+MQ+jFqmF+eFsNq51ABfzEQMd5K28C9PBv6mrFZw8a6bGozFD7xvJyBVSsZ7Wz\nr9uLM/2Zx4mUOPSmQRC8u80et5AzCoBQMVQEmuluXUDphdT1CKg0wLysfoi7gVO9\n4o3yxxgQF32BbI6WmrM3MrZKNwKBgQDpiXM1o/mDQwRozK31k7zWAYzxdLAmdcsJ\nIKB3Fa2wlrppPbBO/TABw3tX1PBnGgbi6l9AfzOvDtem+WQ9ibaRzQuC1LXJZWuU\nllOn2pkXOSA6Wiwmz2ZxkEIbqqnezWrQ1fgUHtg/T8xnCkjZOv0XguCrWuB3+iL3\nZLeEDjnAcwKBgQCJpziHATr3BYMWsyM9ip3t8R1bAK8I6u+oJWQXj8l5EH4Cuipq\nZsWSw58CTQlPTPgApV5G2Z5WDwAcVGNNR0AFrY+/y8avKf2YHjxN50b5wOrWg2Sq\n3UvnVW3L5UEPCYKHzxzuuJ9CUh7kgzY5gbROgWHpIvinpBZMlH3z9uC9vQKBgG7h\nP74cGH9l9lX7uCx89I93NP//MxNPohK3VvizZkANkHwfOfKG66AqvAk7pNiO1u4t\n8QOiYVugZGt2xU0icXhQLkLz00vHx4hIx3dOppkMGm0aGxRiLHWG1JxmLzkFts1o\nidyjuHB25smVbHkXNMtQ7HLvNtw/+xIS077zMiBZAoGAQ0t5X6gvFkPZ1v6/lxqm\nxnLYxmk374HxYD661O1YLs1LtVLH0RnSgYLgrs2H8B0LUt+P5ghQaVBkMMP/w7zR\nKtob71gjfBC/ChTpLR22JPcjIkboElLTt8C1Zu8yUG3cE2qujRoFLA4Jmfzo2LbR\n6MayIlCRzjx98zkigypSDBA=\n-----END PRIVATE KEY-----\n';
const googlePubSubEmail = 'couchbc@couchbc-1540415979753.iam.gserviceaccount.com';
const googlePubSubScopes = [
	'https://www.googleapis.com/auth/cloud-platform',
	'https://www.googleapis.com/auth/pubsub',
];

// Requires that the topic has already been created in Google API (for example using API explorer)
const googlePublishUrl = 'https://pubsub.googleapis.com/v1/projects/' + googleApiProject +
		'/topics/{topic}:publish';
const googleSubscribeUrl = 'https://pubsub.googleapis.com/v1/projects/' + googleApiProject +
		'/subscriptions/{subscription}';
const googlePullUrl = 'https://pubsub.googleapis.com/v1/projects/' + googleApiProject +
		'/subscriptions/{subscription}:pull';
const googleAckUrl = 'https://pubsub.googleapis.com/v1/projects/' + googleApiProject +
		'/subscriptions/{subscription}:acknowledge';

// Import the page's SCSS. Webpack will know what to do with it.
import '../scss/app.scss';

// Import libraries we need.
import {default as $} from 'jquery';
import {default as Vue} from 'vue';
import {default as Web3} from 'web3';
import {default as IpfsApi} from 'ipfs-api';
import {default as bs58} from 'bs58';
import {default as uniqid} from 'uniqid';

// Vue elements
import Toasted from 'vue-toasted';
import VueFilter from 'vue-filter';
import Nl2br from 'vue-nl2br';

// Vue google map
import * as VueGoogleMaps from 'vue2-google-maps';

// Vue slideshow
import {VueFlux, FluxPagination, Transitions} from 'vue-flux';

// Import our contract artifacts and turn them into usable abstractions.
import rent_artifacts from '../../build/contracts/Rent.json';

import Datepicker from 'vuejs-datepicker';
import moment from 'moment';

// Blockies for account icons
require('./blockies.min.js');

// Foundation for site style and layout
require('foundation-sites');

// jQuery UI tooltips
require('webpack-jquery-ui/css.js');
require('webpack-jquery-ui/tooltip.js');

// Elliptic for elliptic curve cryptography
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

// Eccrypto for ECIES
const eccrypto = require('eccrypto');

// Google OAuth authorization for pub/sub
const {GoogleToken} = require('gtoken');
const gtoken = new GoogleToken({
	email: googlePubSubEmail,
	scope: googlePubSubScopes,
	key:   googlePubSubKey,
});

// Save the rent contract
let rentContract;

// Interval ids for subscriptions
let subscriptionIntervals = {};

const defaultToastOptions = {
	duration: 3000,
};

function showMessage(message, options) {
	Vue.toasted.show(message, $.extend({}, defaultToastOptions, options));
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

Vue.use(Toasted);
Vue.use(VueFilter);
Vue.use(VueGoogleMaps, {
	load:              {
		key:       googleApiKey,
		libraries: 'places',
	},
	installComponents: true,
});

let app = new Vue({
	el:         '#app',
	data:       () => ({
		fluxOptions:        {
			autoplay: true,
		},
		fluxTransitions:    {
			transitionFade: Transitions.transitionFade,
		},
		googleMapsGeocoder: null,

		wallet: null,

		accounts: [],

		page: 'start',

		newApartmentData: {
			account:       null,
			title:         '',
			description:   '',
			street:        '',
			number:        '',
			zip:           '',
			country:       '',
			city:          '',
			latitude:      0,
			longitude:     0,
			pricePerNight: 0,
			deposit:       0,
			primaryImage:  '',
			images:        [],
		},
		searchData:       {
			country:   null,
			city:      null,
			fromDate:  null,
			tillDate:  null,
			latitude:  0,
			longitude: 0,
		},
		apartments:       [],
		currentApartment: null,

		receivedMessages: [],
		topicMessages:    {},

		rentalRequestFrom: '',
		rentalRequestTill: '',
		rentalRequest:     {
			account:   null,
			fromDay:   0,
			tillDay:   0,
			apartment: null,
			name:      window.localStorage.getItem('userName') || '',
			phone:     window.localStorage.getItem('userPhone') || '',
			email:     window.localStorage.getItem('userEmail') || '',
			fee:       0,
			deposit:   0
		},

		userApartments:   [],
		rentals:          [],
		currentRental:    null,
		deductAmount:     0,
		apartmentRentals: [],
		disabledDates:    {
			to: new Date(),
		},
	}),
	watch:      {
		rentalRequestFrom: (newValue) => {
			if (newValue) {
				app.rentalRequest.fromDay = app.dateToUnixDay(newValue);
			}

			app.updateRentalRequestFee();
		},
		rentalRequestTill: (newValue) => {
			if (newValue) {
				app.rentalRequest.tillDay = app.dateToUnixDay(newValue);
			}

			app.updateRentalRequestFee();
		},
		rentalAccount:     (rentalAccount) => {
			web3.eth.defaultAccount = app.rentalAccount;
			rentContract.options.from = app.rentalAccount;

			// Check if the eth account has an account
			//app.checkAccount();

			// Load the apartments
			//app.loadApartments();
		},
	},
	methods:    {
		/**
		 * Extract address data from a gmaps places result
		 * @param placesResult
		 * @return {{latitude: number, longitude: number, country: string, zip: string, city: string, street: string, number: string}}
		 */
		extractAddressData: placesResult => {
			let addressData = {
				latitude:  placesResult.geometry.location.lat(),
				longitude: placesResult.geometry.location.lng(),
			};

			for (let component of placesResult.address_components) {
				if (component.types.indexOf('country') !== -1) {
					addressData.country = component.long_name;
					continue;
				}
				if (component.types.indexOf('postal_code') !== -1) {
					addressData.zip = component.long_name;
					continue;
				}
				if (component.types.indexOf('locality') !== -1) {
					addressData.city = component.long_name;
					continue;
				}
				if (component.types.indexOf('route') !== -1) {
					addressData.street = component.long_name;
					continue;
				}
				if (component.types.indexOf('street_number') !== -1) {
					addressData.number = component.long_name;
				}
			}

			return addressData;
		},

		/**
		 * Function called when user searches for apartments at an address
		 *
		 * @param placesResult
		 */
		changeSearchAddress: (placesResult) => {
			let addressData = app.extractAddressData(placesResult);

			if (addressData.country && addressData.city) {
				app.searchApartment(
						addressData.country,
						addressData.city,
						addressData.latitude,
						addressData.longitude,
				);
			}
		},

		searchApartment: async (country, city, latitude, longitude) => {
			app.searchData.country = country;
			app.searchData.city = city;
			app.searchData.latitude = latitude;
			app.searchData.longitude = longitude;

			let cityHash = app.getCountryCityHash(country, city);

			let numApartments = await rentContract.methods.getNumCityApartments(cityHash).call();

			app.apartments = [];

			// Fetch all apartments for the city
			for (let i = 0; i < numApartments; i++) {
				// Get the apartment for the city hash
				rentContract.methods.getCityApartment(cityHash, i).call().then(async apartment => {
					let promises = [];

					apartment.reviews = [];
					apartment.totalScore = 0;

					// If the apartment has reviews, fetch them
					if (apartment.numReviews > 0) {
						for (let j = 0; j < apartment.numReviews; j++) {
							// Add a promise that will only resolve when we have the review (with text)
							promises.push(
									new Promise(async (resolve, reject) => {
										let review = await rentContract.methods.getApartmentReview(apartment.id, j).call();
										let reviewText = await app.downloadDataFromHexHash(review.ipfsHash);

										apartment.totalScore += review.score;
										apartment.reviews.push({
											score: review.score,
											text:  reviewText,
										});

										resolve();
									}),
							);
						}
					}

					// Test reviews
					apartment.reviews.push({
						score: 4,
						text:  'Donec ullamcorper nulla non metus auctor fringilla. Etiam porta sem malesuada magna mollis euismod. Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor. Etiam porta sem malesuada magna mollis euismod. Curabitur blandit tempus porttitor. Cras mattis consectetur purus sit amet fermentum.\n' +
								       '\n' +
								       'Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum. Maecenas sed diam eget risus varius blandit sit amet non magna. Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor. Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Nullam quis risus eget urna mollis ornare vel eu leo. Aenean lacinia bibendum nulla sed consectetur. Vestibulum id ligula porta felis euismod semper.',
					});
					apartment.reviews.push({
						score: 3,
						text:  'Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum nibh, ut fermentum massa justo sit amet risus. Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum. Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum. Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Cras mattis consectetur purus sit amet fermentum. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Duis mollis, est non commodo luctus, nisi erat porttitor ligula, eget lacinia odio sem nec elit.\n' +
								       '\n' +
								       'Duis mollis, est non commodo luctus, nisi erat porttitor ligula, eget lacinia odio sem nec elit. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum. Maecenas sed diam eget risus varius blandit sit amet non magna.\n' +
								       '\n' +
								       'Nullam quis risus eget urna mollis ornare vel eu leo. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Donec ullamcorper nulla non metus auctor fringilla. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Vestibulum id ligula porta felis euismod semper.',
					});
					apartment.reviews.push({
						score: 3,
						text:  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam id dolor id nibh ultricies vehicula ut id elit. Cras mattis consectetur purus sit amet fermentum. Praesent commodo cursus magna, vel scelerisque nisl consectetur et. Vestibulum id ligula porta felis euismod semper. Vestibulum id ligula porta felis euismod semper.',
					});
					apartment.reviews.push({
						score: 5,
						text:  'Nulla vitae elit libero, a pharetra augue. Aenean lacinia bibendum nulla sed consectetur. Donec id elit non mi porta gravida at eget metus. Duis mollis, est non commodo luctus, nisi erat porttitor ligula, eget lacinia odio sem nec elit. Donec id elit non mi porta gravida at eget metus.\n' +
								       '\n' +
								       'Duis mollis, est non commodo luctus, nisi erat porttitor ligula, eget lacinia odio sem nec elit. Donec sed odio dui. Donec sed odio dui. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum.',
					});
					apartment.totalScore = 15;

					let details = await app.downloadDataFromHexHash(apartment.ipfsHash);
					apartment.position = await app.getMapsAddressPosition(
							details.street + ' ' + details.number + ', ' + details.city + ', ' + details.country,
					);

					// Add the apartment details to the apartment
					$.extend(apartment, details);

					// Wait till all reviews have been fetched, if any
					await Promise.all(promises);

					apartment.averageScore = (apartment.reviews.length > 0)
							? apartment.totalScore / apartment.reviews.length
							: 0;
					app.apartments.push(apartment);
				});
			}

			app.page = 'apartments';
		},

		/**
		 * Get the longitude and latitude for the supplied address as object {ltd: 0.00, lng: 0.00}
		 *
		 * @param address
		 * @return {Promise<object>}
		 */
		getMapsAddressPosition: async address => {
			if (app.googleMapsGeocoder === null) {
				app.googleMapsGeocoder = new google.maps.Geocoder();
			}

			return new Promise(function(resolve, reject) {
				app.googleMapsGeocoder.geocode({'address': address}, function(results, status) {
					if (status === 'OK') {
						resolve({
							lat: results[0].geometry.location.lat(),
							lng: results[0].geometry.location.lng(),
						});
					} else {
						console.error(status, results);

						showMessage('Could not find location of address ' + address);

						reject();
					}
				});
			});
		},

		/**
		 * Highlight an apartment
		 *
		 * @param apartment
		 */
		highlightApartment: apartment => {
			$('#apartments').toggleClass('highlighting', true);
			$('#apartment-' + apartment.id).toggleClass('highlighted', true);
		},

		/**
		 * End highlighting an apartment
		 *
		 * @param apartment
		 */
		unhighlightApartment: apartment => {
			$('#apartments').toggleClass('highlighting', false);
			$('#apartment-' + apartment.id).toggleClass('highlighted', false);
		},

		/**
		 * Show the apartment details
		 *
		 * @param apartment
		 */
		showApartment: apartment => {
			app.rentalRequest.apartment = apartment;

			app.page = 'apartment';
		},

		/**
		 * Update the fee for a rental request
		 */
		updateRentalRequestFee: () => {
			// Check if we have enough details to determine the rental fee
			if (app.rentalRequest.apartment === null ||
					app.rentalRequest.fromDay === 0 || app.rentalRequest.tillDay === 0 ||
					app.rentalRequest.tillDay <= app.rentalRequest.fromDay
			) {
				app.rentalRequest.fee = 0;

				return;
			}

			app.rentalRequest.fee = (app.rentalRequest.tillDay - app.rentalRequest.fromDay) * app.rentalRequest.apartment.pricePerNight;
		},

		requestRental: apartment => {
			// TODO for rental requests: store "pending" request in local storage; process as soon as interaction key received
			// Get the pending requests
			let pendingRequests = JSON.parse(window.localStorage.getItem('pendingRequests') || '[]');

			// Add the request to the pending requests
			let from = app.dateToUnixDay(app.rentalRequest.from);
			let till = app.dateToUnixDay(app.rentalRequest.till);
			pendingRequests.push({
				bcAccountAddress:  app.rentalRequest.account.address,
				from:              from,
				till:              till,
				apartment:         apartment.id,
				apartmentIpfsHash: apartment.ipfsHash,
				fee:               (till - from) * apartment.fee
			});

			return;

			let fromDay = app.dateToUnixDay(app.apartmentsFrom);
			let tillDay = app.dateToUnixDay(app.apartmentsTill);
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

		/**
		 * Get the URLs for images for the apartment
		 *
		 * @param apartment
		 */
		getApartmentImages: (apartment) => {
			let urls = [];

			// Check if we have a primary image we can add
			if (apartment.primaryImage) {
				urls.push(app.getImageUrl(apartment.primaryImage));
			}

			// Add all other images
			for (let ipfsHash of apartment.images) {
				urls.push(app.getImageUrl(ipfsHash));
			}

			return urls;
		},

		refuseRental: rental => {

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

		/**
		 * Upload a string to IPFS. Returns the IPFS address of the string.
		 * @param str
		 * @return {Promise<string>}
		 */
		uploadString: async str => {
			// Get an IPFS connection
			let ipfsConnection = IpfsApi(ipfsHost);

			// Fill a file buffer with the string
			let filledBuffer = Buffer(str);

			return new Promise((resolve, reject) => {
				// Add the file to IPFS
				ipfsConnection.files.add(filledBuffer, (err, result) => {
					if (err) {
						console.error(err);

						reject();
						throw('Could not upload image to IPFS: ' + err);
					}

					console.log('String uploaded to ' + result[0].hash);

					resolve(result[0].hash);
				});
			});
		},

		/**
		 * Upload an image to IPFS. Returns the IPFS address of the image.
		 *
		 * @param inputElement
		 * @return {Promise<string>}
		 */
		uploadImage:    async inputElement => {
			// Return a promise that is resolved if the image upload succeeded
			return new Promise((resolve, reject) => {
				let reader = new FileReader();
				reader.onloadend = () => {
					// Get an IPFS connection
					let ipfsConnection = IpfsApi(ipfsHost);

					// Fill a file buffer
					let filledBuffer = Buffer(reader.result);

					// Add the file to IPFS
					ipfsConnection.files.add(filledBuffer, (err, result) => {
						if (err) {
							console.error(err);

							reject();
							throw('Could not upload image to IPFS: ' + err);
						}

						console.log('Image uploaded to ' + result[0].hash);

						resolve(result[0].hash);
					});
				};

				reader.readAsArrayBuffer(inputElement.files[0]);
			});
		},
		/**
		 * Download a string from an IPFS address
		 *
		 * @param ipfsAddr
		 * @return {Promise<string>}
		 */
		downloadString: async ipfsAddr => {
			// Return a promise that is resolved with the ipfs string downloaded
			return new Promise((resolve, reject) => {
				let ipfsConnection = IpfsApi(ipfsHost);

				// Get the string from IPFS
				ipfsConnection.files.get(ipfsAddr, (err, files) => {
					if (err) {
						console.error(err);

						reject();
						// TODO: Catch exceptions in user initiated root function (problem: async/Promise!)
						throw('Could not download data from IPFS: ' + err);
					}

					resolve(files[0].content);
				});
			});
		},

		/**
		 * Upload data, optionally encrypting it in the process. Returns the prefixed SHA256 hex hash part of IPFS address.
		 *
		 * @param data   Data that will be JSON-encoded and uploaded (encrypted)
		 * @param publicKeyBuffer Buffer containing the public key to be used for encryption, if any
		 * @return {Promise<str>}
		 */
		uploadData: async (data, publicKeyBuffer) => {
			let str = JSON.stringify(data);

			if (publicKeyBuffer) {
				str = await app.encryptString(str, publicKeyBuffer);
			}

			let ipfsAddress = await app.uploadString(str);

			return app.ipfsAddrToHash(ipfsAddress);
		},

		/**
		 * Download JSON encoded from the supplied SHA256 hex hash referencing an IPFS address, optionally decrypting it in the process
		 *
		 * @param hexHash   SHA256 hex encoded 0x prefixed hash
		 * @param ecAccount EC account used for decryption or null
		 * @return {Promise<object>}
		 */
		downloadDataFromHexHash: async (hexHash, ecAccount) => {
			let ipfsAddress = app.hexHashToIpfsAddr(hexHash);

			let str = await app.downloadString(ipfsAddress);

			if (ecAccount) {
				str = await app.decryptString(str, ecAccount.private.buffer);
			}

			return JSON.parse(str);
		},

		/**
		 * React on a changed apartment address for new apartments
		 *
		 * @param placesResult
		 */
		changeApartmentAddress: (placesResult) => {
			let addressData = app.extractAddressData(placesResult);

			$.extend(app.newApartmentData, addressData);
		},

		selectNewApartmentAccount: account => {
			// Ignore selected accounts if they have been used by a tenant or interaction
			if (account.type === 'tenant' || account.type === 'interaction') {
				return;
			}
			app.newApartmentData.account = account;
		},

		addApartment: async clickEvent => {
			/*
			Test code for generating private / public keys

			let keyPairA = ec.genKeyPair();
			let keyPairB = ec.genKeyPair();

			var privateKeyA = keyPairA.getPrivate().toBuffer(); // Uint8Array(32)
			var publicKeyA = app.getUint8ArrayBufferFromPoint(keyPairA.getPublic());  // Uint8Array(32)
			var privateKeyB = keyPairB.getPrivate().toBuffer();  // Uint8Array(32)
			var publicKeyB = app.getUint8ArrayBufferFromPoint(keyPairB.getPublic());  // Uint8Array(32)

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
			*/

			let account = app.newApartmentData.account;

			let details = {
				title:         app.newApartmentData.title,
				description:   app.newApartmentData.description,
				street:        app.newApartmentData.street,
				number:        app.newApartmentData.number,
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
			$('.page.add-apartment input.add-image').each((index, element) => {
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
			let cityHash = app.getCountryCityHash(app.newApartmentData.country, app.newApartmentData.city);
			let ownerEcAccount = await app.getOrCreateOwnerEcAccount(account);

			let parameters = [
				ownerEcAccount.public.x,
				ownerEcAccount.public.y,
				app.ipfsAddrToHash(detailsAddress),
				cityHash,
			];

			// Estimate gas and call the addApartment function
			let method = rentContract.methods.addApartment(...parameters);
			method.estimateGas().then(gasAmount => {
				method.send({from: account.address, gas: gasAmount});
			});

			// Add a topic subscription to receive interaction key requests
			app.addTopicSubscription('request-interaction-key', ownerEcAccount.address);

			rentContract.once('ApartmentAdded',
					{filter: {owner: app.newApartmentData.account.address}}, (error, event) => {
						if (error) {
							showMessage('Could not add apartment');
							console.error(error);
							return;
						}

						showMessage('Apartment added');

						// Show the apartment listing for the city
						app.searchApartment(app.newApartmentData.country, app.newApartmentData.city,
								app.newApartmentData.latitude, app.newApartmentData.longitude);

						// Clear the form
						let account = app.newApartmentData.account;
						Object.assign(app.$data.newApartmentData, app.$options.data.call(app).newApartmentData);
						document.getElementById('apartment-address').value = '';
						document.getElementById('add-apartment-primary-image').value = '';
						app.newApartmentData.account = account;
					});
		},

		/**
		 * Get the hash for county and city by which apartments can be searched for
		 *
		 * @param country
		 * @param city
		 * @return string
		 */
		getCountryCityHash: (country, city) => {
			return web3.utils.keccak256(JSON.stringify({
				'country': country,
				'city':    city,
			}));
		},

		getTotalPrice: (apartment) => {
			let days = app.dateToUnixDay(app.apartmentsTill) - app.dateToUnixDay(app.apartmentsFrom);

			if (days > 0) {
				return app.pricePerNight * days;
			}

			return null;
		},

		/**
		 * Get an image URL for an IPFS image, using the specified address (either multihash or 0x prefixed hex hash)
		 *
		 * @param address
		 * @return {string}
		 */
		getImageUrl: (address) => {
			// Check if we need to decode an IPFS hex hash
			if (address.substr(0, 2) === '0x') {
				return ipfsGatewayUrl + app.hexHashToIpfsAddr(address);
			}

			return ipfsGatewayUrl + address;
		},

		/**
		 * Get style attributes for a blockie generated from an account address
		 *
		 * @param address
		 * @return {*}
		 */
		getBlockie:     address => {
			if (address) {
				return {
					'background-image': 'url(\'' + blockies.create({
						seed: address,
					}).toDataURL() + '\')',
				};
			}
			else {
				return {};
			}
		},
		/**
		 * Get a reandom color to use as background color for an apartment
		 *
		 * @return {string}
		 */
		getRandomColor: () => {
			let oneBlack = Math.random() * 10;

			let r = oneBlack <= 0.3333 ? 0 : Math.floor(Math.random() * 255);
			let g = (oneBlack <= 0.6666 && oneBlack > 0.3333) ? 0 : Math.floor(Math.random() * 255);
			let b = oneBlack > 0.6666 ? 0 : Math.floor(Math.random() * 255);

			return 'rgba(' + r + ', ' + g + ', ' + b + ', 0.15';
		},

		/**
		 * Get the style to use for an apartment. If no primary image is specified for the apartment, returns a random color.
		 *
		 * @param apartment
		 * @return {string}
		 */
		getApartmentStyle: (apartment) => {
			// Don't apply a specific style if we have an image
			if (apartment.primaryImage) {
				return '';
			}

			return 'background-color: ' + app.getRandomColor();
		},

		/**
		 * Get the width for displaying a stars image, using the provided maxWidth for the full width
		 *
		 * @param score
		 * @param maxWidth
		 * @return {number}
		 */
		getStarsWidth:         (score, maxWidth) => {
			return Math.round(score / 5 * maxWidth);
		},
		changeApartmentFilter: (apartmentsFrom, apartmentsTill) => {
			// Only apply filter if we have dates
			if (typeof(app.apartmentsFrom) !== 'object' ||
					typeof(app.apartmentsTill) !== 'object') {
				app.loadApartments();
				return;
			}

			app.loadApartments(
					app.dateToUnixDay(app.apartmentsFrom),
					app.dateToUnixDay(app.apartmentsTill),
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

		// Check all accounts for existing owner / tenant profiles and interaction keys
		determineAccounts: bcAccounts => {
			for (let bcAccount of bcAccounts) {
				rentContract.methods.getAddressType().call({from: bcAccount}, (error, type) => {
					let account = {
						'address': bcAccount,
						'type':    type,
					};

					app.accounts.push(account);

					if (app.newApartmentData.account === null && type === 'owner') {
						app.newApartmentData.account = account;
					} else if (app.rentalRequest.account === null && type === 'tenant') {
						app.rentalRequest.account = account;
					}

					// TODO: Determine accounts with interaction keys (locally)
				});
			}
		},

		/**
		 * Initiate the application
		 */
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

				app.registerSubscriptions();

				app.registerEvents();

				$(document).foundation();

				// Enable tooltips
				$(document).tooltip({
					selector:  '.tooltip[title]',
					container: 'body',
				});

				// Test subscriptions
				//app.subscribeToTopic('request-interaction-key');
				//app.publishMessage('abc', 'request-interaction-key');
				//app.publishMessage('def', 'request-interaction-key');
				//app.publishMessage('ghi', 'request-interaction-key');
			});
		},

		/**
		 * Register subscription listeners
		 */
		registerSubscriptions: () => {
			// Check if we have subscriptions
			let topicSubscriptions = window.localStorage.getItem('topicSubscriptions');

			// If we don't have subscriptions, we're done
			if (topicSubscriptions === null) {
				return;
			}

			// Parse topic subscriptions (should be hashmap topic => ecAccountAddress|null)
			topicSubscriptions = JSON.parse(topicSubscriptions);

			for (let topic in topicSubscriptions) {
				app.subscribeToTopic(topic, topicSubscriptions[topic]);
			}
		},

		/**
		 * Registere event listeners
		 */
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

		// Messaging

		/**
		 * Publish a message to the given topic, optionally encrypting it using the publicKeyBuffer
		 *
		 * @param message
		 * @param topic
		 * @param publicKeyBuffer
		 * @returns {Promise<*>}
		 */
		publishMessage: async (message, topic, publicKeyBuffer) => {
			let url = googlePublishUrl.replace('{topic}', topic);

			// Check if we need to encrypt the message
			if (publicKeyBuffer) {
				message = app.encryptString(message, publicKeyBuffer);
			}

			// Create the message
			let data = {
				messages: [
					{
						data: btoa(message),
					},
				],
			};

			// Get an access token
			let accessToken = await gtoken.getToken();

			// Send the request as ajax
			return $.ajax({
				url:         url,
				data:        JSON.stringify(data),
				dataType:    'json',
				contentType: 'application/json',
				method:      'POST',
				headers:     {
					'Authorization': 'Bearer ' + accessToken,
				},
			});
		},

		/**
		 * Add a topic subscription that will be restored when the page is reloaded, and subscribe to the topic
		 *
		 * @param topic
		 * @param ecAccountAddress
		 * @return {Promise<void>}
		 */
		addTopicSubscription: async (topic, ecAccountAddress) => {
			// Get the existing subscription registrations
			let topicSubscriptions = window.localStorage.getItem('topicSubscriptions');

			// Create or parse the hashmap
			topicSubscriptions = (topicSubscriptions === null)
					? {}
					: JSON.parse(topicSubscriptions);

			// Add the topic subscription
			topicSubscriptions[topic] = ecAccountAddress || null;

			// Store the topic subscriptions
			window.localStorage.setItem('topicSubscriptions', JSON.stringify(topicSubscriptions));

			app.subscribeToTopic(topic, ecAccountAddress);
		},

		/**
		 * Subscribe to a topic. If ecAccountAddress is given, tries to decrypt the message using the ec account stored at the specified address.
		 * @param topic
		 * @param ecAccountAddress
		 * @returns {Promise<void>}
		 */
		subscribeToTopic: async (topic, ecAccountAddress) => {
			// Check if we already have a subscription id for the topic; if so, we can start listening
			let subscription = window.localStorage.getItem('topic.' + topic + '.subscription');
			if (subscription) {
				app.listenToSubscription(JSON.parse(subscription));
				return;
			}

			// Create a new subscription
			subscription = {
				id:               app.getRandomSubscriptionId(),
				topic:            topic,
				ecAccountAddress: ecAccountAddress || null,
			};

			// Create the request
			let url = googleSubscribeUrl.replace('{subscription}', subscription.id);
			let data = {
				topic: 'projects/' + googleApiProject + '/topics/' + topic,
			};

			// Get an access token
			let accessToken = await gtoken.getToken();

			// Send the request
			await $.ajax({
				url:         url,
				data:        JSON.stringify(data),
				dataType:    'json',
				contentType: 'application/json',
				method:      'PUT',
				headers:     {
					'Authorization': 'Bearer ' + accessToken,
				},
			});

			// Store the subscription in localStorage
			window.localStorage.setItem('topic.' + topic + '.subscription', JSON.stringify(subscription));

			// Listen to the subscription
			app.listenToSubscription(subscription);
		},

		/**
		 * Get a random subscription id to be used with google pub/sub subscriptions
		 *
		 * @returns {string}
		 */
		getRandomSubscriptionId: () => {
			return 'sub-' + web3.utils.sha3(uniqid() + salt + uniqid() + Math.round(Math.random() * Math.pow(10, 20)));
		},

		/**
		 * Listen to a subscription. Creates a period check to fetch messages from the subscription.
		 *
		 * @param subscription
		 */
		listenToSubscription: subscription => {
			// If we already listen to the subscription, we're done
			if (subscriptionIntervals['interval-' + subscription.id]) {
				return;
			}

			// Ensure we have an array for topic messages
			if (typeof(app.topicMessages[subscription.topic]) === 'undefined') {
				app.topicMessages[subscription.topic] = [];
			}

			// Periodically pull from the subscription
			subscriptionIntervals['interval-' + subscription.id] = window.setInterval(() => {
				app.pullFromSubscription(subscription);
			}, pullInterval);
		},

		/**
		 * Pull messages from the specified subscription. Saves the retrieved messages in app.subscriptionMessages.
		 *
		 * @param subscription
		 * @return {Promise<void>}
		 */
		pullFromSubscription: async (subscription) => {
			let url = googlePullUrl.replace('{subscription}', subscription.id);
			let data = {
				maxMessages:       10,
				returnImmediately: true,
			};

			// Get an access token
			let accessToken = await gtoken.getToken();

			// Send the request
			let result = await $.ajax({
				url:         url,
				data:        JSON.stringify(data),
				dataType:    'json',
				contentType: 'application/json',
				method:      'POST',
				headers:     {
					'Authorization': 'Bearer ' + accessToken,
				},
			});

			// If we don't have any messages, we're done
			if (typeof(result.receivedMessages) === 'undefined') {
				return;
			}

			// Ensure we have an array for topic messages
			if (typeof(app.topicMessages[subscription.topic]) === 'undefined') {
				app.topicMessages[subscription.topic] = [];
			}

			// Construct a new request
			url = googleAckUrl.replace('{subscription}', subscription.id);
			data = {
				ackIds: [],
			};

			// Add the messages to the topic messages
			for (let message of result.receivedMessages) {
				// Add the message to the topic messages if we don't have it yet
				if (app.receivedMessages.indexOf(message.message.messageId) === -1) {
					app.topicMessages[subscription.topic].push(atob(message.message.data));
					app.receivedMessages.push(message.message.messageId);
				}

				// Add message to messages to ack
				data.ackIds.push(message.ackId);
			}

			// Send request to acknowledge receipt
			$.ajax({
				url:         url,
				data:        JSON.stringify(data),
				dataType:    'json',
				contentType: 'application/json',
				method:      'POST',
				headers:     {
					'Authorization': 'Bearer ' + accessToken,
				},
			});
		},

		// Cryptography

		/**
		 * Get the wallet. Asks user for password if wallet hasn't been decrypted or created yet
		 *
		 * @return {web3.eth.accounts.wallet}
		 */
		getWallet: async () => {
			if (app.wallet) {
				return app.wallet;
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

		/**
		 * Get or create an EC account to be used for an owner's bc address
		 * Returns an object with:
		 * {
		 *   private: {
		 *       hex:       "0x0000...",     (0x + 64 hex encoded bytes) = 130 chars
		 *       buffer:    Uint8Array(129)  Buffer to be used with eccrypto
		 *   }
		 *   public: {
		 *       x:         "0x0000...",     (0x + 32x hex encoded bytes = 66 chars)
		 *       y:         "0x0000...",     (0x + 32y bytes hex = 66 chars)
		 *       buffer:    Uint8Array(65)   Buffer to be used with eccrypto
		 *   }
		 *   address:     "0x0000..."        (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
		 * }
		 */
		getOrCreateOwnerEcAccount: async bcAccount => {
			// Try to catch the ec account associated with the address
			let ecAccount = await app.getEcAccountForBcAccount(bcAccount.address);

			// Check if we found an EC account; if we did, return the public key
			if (ecAccount != null) {
				return ecAccount;
			}

			// Check if the account is already registered at the blockchain as owner account;
			// in this case we should already have a public key for it => show an error
			if (bcAccount.type === 'owner') {
				showMessage('Could not get public key for existing owner account');

				return null;
			}

			// Otherwise, generate an EC account
			ecAccount = await app.generateEcAccount();

			// Store the EC account address in local storage to associate it with the current bc account
			window.localStorage.setItem('ecAccounts.' + bcAccount.address, ecAccount.address);

			// Return the account
			return ecAccount;
		},

		/**
		 * Get the EC account associated with the specified blockchain address in local storage.
		 * Returns null if no account is associated with the address or an object with:
		 * {
		 *   private: {
		 *       hex:       "0x0000...",     (0x + 64 hex encoded bytes) = 130 chars
		 *       buffer:    Uint8Array(129)  Buffer to be used with eccrypto
		 *   }
		 *   public: {
		 *       x:         "0x0000...",     (0x + 32x hex encoded bytes = 66 chars)
		 *       y:         "0x0000...",     (0x + 32y bytes hex = 66 chars)
		 *       buffer:    Uint8Array(65)   Buffer to be used with eccrypto
		 *   }
		 *   address:     "0x0000..."        (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
		 * }
		 */
		getEcAccountForBcAccount: async bcAddress => {
			// Local storage is acting as hashmap: BC account address => EC account address

			// The account address is used to find the key; the address contained within is NOT the same as the account address
			let ecAccountAddress = window.localStorage.getItem('ecAccounts.' + bcAddress);

			if (ecAccountAddress) {
				return await app.getEcAccount(ecAccountAddress);
			}

			return null;
		},

		/**
		 * Get an EC account for the given EC account address from the wallet
		 *
		 * Returns null if no Ec account was found or an object with:
		 * {
		 *   private: {
		 *       hex:       "0x0000...",     (0x + 64 hex encoded bytes) = 130 chars
		 *       buffer:    Uint8Array(129)  Buffer to be used with eccrypto
		 *   }
		 *   public: {
		 *       x:         "0x0000...",     (0x + 32x hex encoded bytes = 66 chars)
		 *       y:         "0x0000...",     (0x + 32y bytes hex = 66 chars)
		 *       buffer:    Uint8Array(65)   Buffer to be used with eccrypto
		 *   }
		 *   address:     "0x0000..."        (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
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
		 * Generate a new account used for EC cryptography.
		 * Stores the generated account in the user's encrypted wallet.
		 *
		 * Returns an object with:
		 * {
		 *   private: {
		 *       hex:       "0x0000...",     (0x + 64 hex encoded bytes) = 130 chars
		 *       buffer:    Uint8Array(129)  Buffer to be used with eccrypto
		 *   }
		 *   public: {
		 *       x:         "0x0000...",     (0x + 32x hex encoded bytes = 66 chars)
		 *       y:         "0x0000...",     (0x + 32y bytes hex = 66 chars)
		 *       buffer:    Uint8Array(65)   Buffer to be used with eccrypto
		 *   }
		 *   address:     "0x0000..."        (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
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

			let pkHex = privateKey.toString('hex');
			let xHex = publicKey.x.toString(16);
			let yHex = publicKey.y.toString(16);
			let account = web3.eth.accounts.privateKeyToAccount('0x' + pkHex);

			// Save the account in the wallet
			wallet.add(account);
			wallet.save(app.walletPassword);

			return {
				private: '0x' + pkHex,
				public:  {
					x:      '0x' + xHex,
					y:      '0x' + yHex,
					buffer: app.getUint8ArrayBufferFromXY(xHex, yHex),
				},
				address: account.address,
			};
		},

		/**
		 * Get an EC account for the specified private key.
		 * Does not save or fetch the account from the wallet; the EC account is purely generated in memory.
		 *
		 * Returns an object with:
		 * {
		 *   private: {
		 *       hex:       "0x0000...",     (0x + 64 hex encoded bytes) = 130 chars
		 *       buffer:    Uint8Array(129)  Buffer to be used with eccrypto
		 *   }
		 *   public: {
		 *       x:         "0x0000...",     (0x + 32x hex encoded bytes = 66 chars)
		 *       y:         "0x0000...",     (0x + 32y bytes hex = 66 chars)
		 *       buffer:    Uint8Array(65)   Buffer to be used with eccrypto
		 *   }
		 *   address:     "0x0000..."        (0x + 32 bytes hex address as would be used in blockchain account and can be used for signature validation)
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
				private: {
					hex:    '0x' + pkHex,
					buffer: Buffer(privateKeyArray),
				},
				public:  {
					x:      '0x' + xHex,
					y:      '0x' + yHex,
					buffer: app.getUint8ArrayBufferFromXY(xHex, yHex),
				},
				address: account.address,
			};
		},

		/**
		 * Encrypt the string using the supplied public key buffer
		 *
		 * @param str
		 * @param publicKeyBuffer
		 * @return {Promise<Buffer>}
		 */
		encryptString: async (str, publicKeyBuffer) => {
			return await eccrypto.encrypt(publicKeyBuffer, Buffer(str));
		},

		/**
		 * Decrypt the string using the supplied private key buffer
		 *
		 * @param str
		 * @param privateKeyBuffer
		 * @return {Promise<Buffer>}
		 */
		decryptString: async (str, privateKeyBuffer) => {
			return await eccrypto.decrypt(privateKeyBuffer, Buffer(str));
		},

		/**
		 * Get an uint8array buffer to use with eccrypto from a public point
		 * @param point
		 * @return {Uint8Array}
		 */
		getUint8ArrayBufferFromPoint: point => {
			let arr = new Uint8Array(65);
			arr[0] = 4;
			arr.set(point.x.toBuffer(), 1);
			arr.set(point.y.toBuffer(), 33);

			return Buffer(new Uint8Array(arr));
		},

		/**
		 * Get an uint8array buffer to use with eccrypto from a x and y hex coordinates (without 0x prefix)
		 * @param x
		 * @param y
		 * @return {Uint8Array}
		 */
		getUint8ArrayBufferFromXY: (x, y) => {
			let arr = new Uint8Array(65);
			arr[0] = 4;
			arr.set(app.hexToUint8Array(x), 1);
			arr.set(app.hexToUint8Array(y), 33);

			return Buffer(arr);
		},

		/**
		 * Convert a hex string to an Uint8 array
		 *
		 * @param hex
		 * @return {Uint8Array}
		 */
		hexToUint8Array: (hex) => {
			return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
		},

		// Date
		dateToUnixDay: date => {
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
		finneyToEth: finney => {
			return finney / 1000;
		},

		// IPFS utilities
		/**
		 * Get a hex 0x prefixed hash from an IPFS address. Should only be used with SHA256 addresses.
		 *
		 * @param address
		 * @return {string}
		 */
		ipfsAddrToHash: address => {
			return '0x' + (bs58.decode(address).slice(2).toString('hex'));
		},

		/**
		 * Get an IPFS address from an hex 0x prefixed hash. Should only be used with SHA256 hashes.
		 *
		 * @param hexHash
		 * @return {string}
		 */
		hexHashToIpfsAddr: hexHash => {
			return bs58.encode(Buffer.from('1220' + hexHash.substr(2), 'hex'));
		},
	},
	components: {
		'datepicker':      Datepicker,
		'vue-flux':        VueFlux,
		'flux-pagination': FluxPagination,
		'nl2br':           Nl2br,
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
		window.web3 = new Web3(websocketAddress);
	}

	app.start();
});