// Import the page's SCSS. Webpack will know what to do with it.
import '../scss/app.scss'

// Import libraries we need.
import { default as $ } from 'jquery'
import Vue from 'vue'

// Vue elements
import Toasted from 'vue-toasted'
import VueFilter from 'vue-filter'
import Nl2br from 'vue-nl2br'
import vSelect from 'vue-select'
import * as VueGoogleMaps from 'vue2-google-maps'
import { VueFlux, FluxPagination, Transitions } from 'vue-flux'
import Datepicker from 'vuejs-datepicker'
import store from './store.js'

// Moment for formatting date
import moment from 'moment'

import { Web3Util } from './utils/Web3Util'
import { PubSub } from './utils/PubSub'
import { Apartment } from './classes/Apartment'
import { MapsUtil } from './utils/MapsUtil'
import { googleApiKey } from './credentials'
import { IpfsUtil } from './utils/IpfsUtil'
import { Notifications } from './utils/Notifications'
import { Conversion } from './utils/Conversion'

// Classes
import { Rental } from './classes/Rental'

// Blockies for account icons
require('./blockies.min.js')

// Foundation for site style and layout
require('foundation-sites')

// jQuery UI tooltips
require('webpack-jquery-ui/css.js')
require('webpack-jquery-ui/tooltip.js')

// Add date filters
Vue.filter('formatDate', function (date) {
	if (date) {
		return moment(date).format('DD.MM.YYYY')
	}
})
Vue.filter('formatDateTime', function (date) {
	if (date) {
		return moment(date).format('DD.MM.YYYY hh:mm')
	}
})

// Add vue components and filters
Vue.use(Toasted)
Vue.use(VueFilter)
Vue.use(VueGoogleMaps, {
	load:              {
		key:       googleApiKey,
		libraries: 'places',
		language:  'en'
	},
	installComponents: true
})

let app = new Vue({
	el:         '#app',
	data:       () => ({
		store,

		// Library settings
		fluxOptions:     {
			autoplay: true
		},
		fluxTransitions: {
			transitionFade: Transitions.transitionFade
		},
		disabledDates:   {
			to: new Date()
		},

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
			images:        []
		},
		searchData:       {
			country:   null,
			city:      null,
			fromDate:  null,
			tillDate:  null,
			latitude:  0,
			longitude: 0
		},
		apartments:       [],
		apartmentImages:  null, // Cache to prevent slider from reloading

		rentalRequestFrom: '',
		rentalRequestTill: '',
		rentalRequest:     {
			account:   null,
			fromDay:   0,
			tillDay:   0,
			apartment: null,
			contact:   {
				name:  window.localStorage.getItem('userName') || '',
				phone: window.localStorage.getItem('userPhone') || '',
				email: window.localStorage.getItem('userEmail') || ''
			},
			fee:       0,
			feeInEth:  0,
			deposit:   0
		},

		userApartments:   [],
		rentals:          [],
		currentRental:    null,
		deductAmount:     0,
		apartmentRentals: []
	}),
	watch:      {
		rentalRequestFrom: (newValue) => {
			if (newValue) {
				app.rentalRequest.fromDay = Conversion.dateToUnixDay(newValue)
			}

			app.updateRentalRequestFee()
		},
		rentalRequestTill: (newValue) => {
			if (newValue) {
				app.rentalRequest.tillDay = Conversion.dateToUnixDay(newValue)
			}

			app.updateRentalRequestFee()
		}
	},
	methods:    {
		/**
		 * Function called when user searches for apartments at an address
		 *
		 * @param placesResult
		 */
		changeSearchAddress: (placesResult) => {
			let addressData = MapsUtil.extractAddressData(placesResult)

			if (addressData.country && addressData.city) {
				app.searchApartment(
					addressData.country,
					addressData.city,
					addressData.latitude,
					addressData.longitude
				)
			}
		},

		searchApartment: async (country, city, latitude, longitude) => {
			app.searchData.country = country
			app.searchData.city = city
			app.searchData.latitude = latitude
			app.searchData.longitude = longitude

			app.apartments = await Apartment.getCityApartments(country, city)

			app.page = 'apartments'
		},

		/**
		 * Highlight an apartment
		 *
		 * @param apartment
		 */
		highlightApartment: apartment => {
			$('#apartments').toggleClass('highlighting', true)
			$('#apartment-' + apartment.id).toggleClass('highlighted', true)
		},

		/**
		 * End highlighting an apartment
		 *
		 * @param apartment
		 */
		unhighlightApartment: apartment => {
			$('#apartments').toggleClass('highlighting', false)
			$('#apartment-' + apartment.id).toggleClass('highlighted', false)
		},

		/**
		 * Show the apartment details
		 *
		 * @param apartment
		 */
		showApartment: apartment => {
			app.rentalRequest.apartment = apartment
			app.apartmentImages = apartment.getImageUrls()

			app.page = 'apartment'
		},

		/**
		 * Update the fee for a rental request. Called when the rental request date changes
		 */
		updateRentalRequestFee: () => {
			// Check if we have enough details to determine the rental fee
			if (app.rentalRequest.apartment === null ||
				app.rentalRequest.fromDay === 0 || app.rentalRequest.tillDay === 0 ||
				app.rentalRequest.tillDay <= app.rentalRequest.fromDay
			) {
				app.rentalRequest.fee = 0
				app.rentalRequest.feeInEth = 0

				return
			}

			app.rentalRequest.fee = (app.rentalRequest.tillDay - app.rentalRequest.fromDay) * app.rentalRequest.apartment.pricePerNight
			app.rentalRequest.feeInEth = Conversion.finneyToEth(app.rentalRequest.fee)
		},

		/**
		 * Request a new rental. Will request an interaction key from the owner first and add the rental to the pending rentals.
		 */
		requestRental: async () => {
			Rental.addRequest(app.rentalRequest.account, app.rentalRequest)
		},

		issueInteractionToken: tenantPublicKey => {
			console.log('request ' + tenantPublicKey)
		},

		addRentalRequestToBlockchain: interactionKey => {
			console.log('issue ' + interactionKey)
		},

		/*
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
		*/

		/**
		 * React on a changed apartment address when adding apartments apartments
		 *
		 * @param placesResult
		 */
		changeApartmentAddress: (placesResult) => {
			let addressData = MapsUtil.extractAddressData(placesResult)

			Object.assign(app.newApartmentData, addressData)
		},

		/**
		 * React on changed accounts when adding apartments
		 *
		 * @param account
		 */
		selectNewApartmentAccount: account => {
			// Ignore selected accounts if they have been used by a tenant or interaction
			if (account.type === 'tenant' || account.type === 'interaction') {
				return
			}
			app.newApartmentData.account = account
		},

		/**
		 * Add an apartment
		 *
		 * @param clickEvent
		 * @returns {Promise<void>}
		 */
		addApartment: async clickEvent => {
			let account = app.newApartmentData.account
			let primaryImageInputElement = document.getElementById('add-apartment-primary-image')
			let imageInputElements = $('.page.add-apartment input.add-image')

			Apartment.add(account, app.newApartmentData, primaryImageInputElement, imageInputElements).then(() => {
				// Clear the form
				let account = app.newApartmentData.account
				Object.assign(app.$data.newApartmentData, app.$options.data.call(app).newApartmentData)
				document.getElementById('apartment-address').value = ''
				document.getElementById('add-apartment-primary-image').value = ''
				app.newApartmentData.account = account
			})

			Web3Util.contract.once('ApartmentAdded',
				{filter: {owner: account.address}}, (error, event) => {
					if (error) {
						Notifications.show('Could not add apartment')
						console.error(error)
						return
					}

					Notifications.show('Apartment added')
				}
			)
		},

		/**
		 * Get style attributes for a blockie generated from an account address
		 *
		 * @param address
		 * @return {*}
		 */
		getBlockie: address => {
			if (address) {
				return {
					'background-image': 'url(\'' + window.blockies.create({
						seed: address
					}).toDataURL() + '\')'
				}
			}

			return {}
		},

		/**
		 * Get a reandom color to use as background color for an apartment
		 *
		 * @return {string}
		 */
		getRandomColor: () => {
			let oneBlack = Math.random() * 10

			let r = oneBlack <= 0.3333 ? 0 : Math.floor(Math.random() * 255)
			let g = (oneBlack <= 0.6666 && oneBlack > 0.3333) ? 0 : Math.floor(Math.random() * 255)
			let b = oneBlack > 0.6666 ? 0 : Math.floor(Math.random() * 255)

			return 'rgba(' + r + ', ' + g + ', ' + b + ', 0.15'
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
				return ''
			}

			return 'background-color: ' + app.getRandomColor()
		},

		/**
		 * Get the width for displaying a stars image, using the provided maxWidth for the full width
		 *
		 * @param score
		 * @param maxWidth
		 * @return {number}
		 */
		getStarsWidth: (score, maxWidth) => {
			return Math.round(score / 5 * maxWidth)
		},

		/**
		 * Initiate the application
		 */
		start: async () => {
			$(document).foundation()

			// Enable tooltips
			$(document).tooltip({
				selector:  '.tooltip[title]',
				container: 'body'
			})

			app.store.commit('setGoogleMapsGeocoder', new window.google.maps.Geocoder())

			app.accounts = await Web3Util.fetchAccounts()
			app.assignDefaultAccounts()

			app.registerSubscriptions()

			app.registerEvents()

			app.loadRentals()
		},

		loadRentals: async () => {
			app.rentals = await Rental.fetchAll(app.accounts)
		},

		/**
		 * Assign default accounts based on the first available account with the same type
		 */
		assignDefaultAccounts: () => {
			for (let account of app.accounts) {
				if (account.type === 'owner' && app.newApartmentData.account === null) {
					app.newApartmentData.account = account
					continue
				}
				if (account.type === 'tenant' && app.rentalRequest.account === null) {
					app.rentalRequest.account = account
				}
			}
		},

		/**
		 * Register subscription listeners
		 */
		registerSubscriptions: () => {
			// Register topic processors
			PubSub.registerTopicProcessor('request-interaction-token', (message) => {
				app.issueInteractionToken(JSON.parse(message))
			})
			PubSub.registerTopicProcessor('issue-interaction-token', (message) => {
				app.addRentalRequestToBlockchain(JSON.parse(message))
			})

			// Check if we have subscriptions
			let topicSubscriptions = window.localStorage.getItem('topicSubscriptions')

			// If we don't have subscriptions, we're done
			if (topicSubscriptions === null) {
				return
			}

			// Parse topic subscriptions (should be hashmap topic => ecAccountAddress|null)
			topicSubscriptions = JSON.parse(topicSubscriptions)

			for (let topic in topicSubscriptions) {
				PubSub.subscribeToTopic(topic, topicSubscriptions[topic])
			}
		},

		/**
		 * Register event listeners
		 */
		registerEvents: () => {
			Web3Util.contract.events.Test({}, (error, event) => {
				if (error) {
					console.error(error)
					return
				}
				console.log(event.returnValues)
			})
			Web3Util.contract.events.TestAddr({}, (error, event) => {
				if (error) {
					console.error(error)
					return
				}
				console.log(event.returnValues)
			})
		},

		/**
		 * Load a preview when the image source is changed
		 *
		 * @param event
		 */
		changeImageSrc: event => {
			let input = event.target
			let previewImg = $(input).next('img.preview')

			// If we don't have a file, hide the preview
			if (typeof input.files !== 'object' || typeof input.files[0] === 'undefined') {
				previewImg.hide()

				return
			}

			let reader = new window.FileReader()

			reader.onload = function (e) {
				previewImg.attr('src', e.target.result).show()
			}

			reader.readAsDataURL(input.files[0])
		},

		/**
		 * Get the image url for the specified hash
		 *
		 * @param address
		 * @returns {string}
		 */
		getImageUrl: (address) => {
			return IpfsUtil.getImageUrl(address)
		}
	},
	components: {
		'datepicker':      Datepicker,
		'vue-flux':        VueFlux,
		'flux-pagination': FluxPagination,
		'nl2br':           Nl2br,
		'v-select':        vSelect
	}
})

window.addEventListener('load', () => {
	app.start()
})
