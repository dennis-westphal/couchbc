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
import { Cryptography } from './utils/Cryptography'

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
		// Check if we have a unix day
		if (typeof date === 'number' && date < 99999 && date > 17000) {
			date = Conversion.unixDayToDate(date)
		}

		return moment(date).format('DD.MM.YYYY')
	}
})
Vue.filter('formatDateTime', function (date) {
	if (date) {
		// Check if we have a unix day
		if (typeof date === 'number' && date < 99999 && date > 17000) {
			date = Conversion.unixDayToDate(date)
		}

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
		notifications: [],

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
			fromDay:   null,
			tillDay:   null,
			latitude:  0,
			longitude: 0
		},
		searchFrom:       '',
		searchTill:       '',

		apartments:      [],
		apartmentImages: null, // Cache to prevent slider from reloading

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
			feeInEth:  0
		},

		tenantReview:    {
			rental:    null,
			score:     '',
			text:      '',
			deduction: 0,
			reason:    ''
		},
		apartmentReview: {
			rental: null,
			score:  '',
			text:   ''
		},

		userApartments:   [],
		rentals:          [],
		currentRental:    null,
		deductAmount:     0,
		apartmentRentals: []
	}),
	watch:      {
		searchFrom:        (newValue) => {
			if (newValue) {
				app.searchData.fromDay = Conversion.dateToUnixDay(newValue)
			}
		},
		searchTill:        (newValue) => {
			if (newValue) {
				app.searchData.tillDay = Conversion.dateToUnixDay(newValue)
			}
		},
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

			app.rentalRequestFrom = app.searchFrom
			app.rentalRequestTill = app.searchTill
			app.updateRentalRequestFee()

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

			app.rentalRequest.fee = app.rentalRequest.apartment.calculateFee(app.rentalRequest.fromDay, app.rentalRequest.tillDay)
			app.rentalRequest.feeInEth = Conversion.finneyToEth(app.rentalRequest.fee)
		},

		/**
		 * Request a new rental. Will request an interaction key from the owner first and add the rental to the pending rentals.
		 */
		requestRental: async () => {
			let rental = await Rental.addRequest(app.rentalRequest.account, app.rentalRequest)
			app.rentals.push(rental)
		},

		/**
		 * Issue an interaction key for the submitted id and publish it encrypted with the provided public key
		 *
		 * @param requestData
		 * @returns {Promise<void>}
		 */
		issueInteractionKey: async requestData => {
			console.debug('Received interaction key request', requestData)

			Notifications.show('Issueing interaction key for rental request')

			// Create the tenant's public key buffer
			let publicKeyBuffer = Conversion.getUint8ArrayBufferFromXY(requestData.x, requestData.y)

			// Try to encrypt something with the public key buffer to ensure it's valid before we create an EC account
			try {
				await Cryptography.encryptString('test', publicKeyBuffer)
			} catch (e) {
				console.error('Invalid tenant public key', requestData, e)
				return
			}

			// Generate a new EC account => the interaction key
			let ecAccount = await Cryptography.generateEcAccount()

			// Extract the public key and encode it for transmission
			let interactionKey = JSON.stringify({
				id:      requestData.id,
				x:       ecAccount.public.x,
				y:       ecAccount.public.y,
				address: ecAccount.address
			})

			// Publish the interaction key encrypted with the tenant's public key
			await PubSub.publishMessage(interactionKey, 'issue-interaction-key', publicKeyBuffer)

			// Add the address of the interaction key to the addresses in localStorage (the key has already been stored on creation)
			let interactionAddresses = JSON.parse(window.localStorage.getItem('interactionAddresses') || '[]')
			interactionAddresses.push(ecAccount.address)
			window.localStorage.setItem('interactionAddresses', JSON.stringify(interactionAddresses))

			console.debug('Issued interaction key ' + interactionKey)
		},

		/**
		 * Send the rental request to the blockchain as soon as an interaction key for it was received
		 *
		 * @param responseData
		 * @returns {Promise<void>}
		 */
		sendRentalRequestToBlockchain: async responseData => {
			console.debug('Received interaction key', responseData)

			// Find the rental request with the matching local storage id
			let filteredRentals = app.rentals.filter(rental => rental.localStorageId === responseData.id)

			if (filteredRentals.length !== 1) {
				console.warn('Could not find any rental with the specified id')
				return
			}

			// Add the interaction key to the rental
			let rental = filteredRentals[0]
			rental.interactionPublicKey_x = responseData.x
			rental.interactionPublicKey_y = responseData.y
			rental.interactionAddress = responseData.address

			// Send the rental request to the blockchain
			rental.sendRequest()
		},

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

			Apartment.add(account, app.newApartmentData, primaryImageInputElement, imageInputElements).then((apartment) => {
				// Clear the form
				Object.assign(app.$data.newApartmentData, app.$options.data.call(app).newApartmentData)
				document.getElementById('apartment-address').value = ''
				document.getElementById('add-apartment-primary-image').value = ''

				// Keep the account selected
				app.newApartmentData.account = apartment.account
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
		 * Add a review for a tenant as an owner
		 *
		 * @returns {Promise<void>}
		 */
		reviewTenant: async () => {
			// Process the review
			await app.tenantReview.rental.reviewTenant(
				app.tenantReview.score,
				app.tenantReview.text,
				app.tenantReview.deduction,
				app.tenantReview.reason
			)

			// Clear the form
			Object.assign(app.$data.tenantReview, app.$options.data.call(app).tenantReview)
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

			app.registerEvents()

			// Load the rentals before we register to the subscriptions so we already have rental requests from
			// local storage loaded before we try to send them using a received interaction key
			await app.loadRentals()

			app.registerSubscriptions()
		},

		/**
		 * Load the rentals
		 *
		 * @returns {Promise<void>}
		 */
		loadRentals: async () => {
			let interactionAddresses = JSON.parse(window.localStorage.getItem('interactionAddresses') || '[]')

			app.rentals = await Rental.fetchAll(app.accounts, interactionAddresses)
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
			PubSub.registerTopicProcessor('request-interaction-key', (message) => {
				app.issueInteractionKey(JSON.parse(message))
			})
			PubSub.registerTopicProcessor('issue-interaction-key', (message) => {
				app.sendRentalRequestToBlockchain(JSON.parse(message))
			})

			PubSub.start()
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
