import { default as $ } from 'jquery'
import { Cryptography } from '../utils/Cryptography'
import { Loading } from '../components/Loading'
import { IpfsUtil } from '../utils/IpfsUtil'
import { Web3Util } from '../utils/Web3Util'
import { PubSub } from '../utils/PubSub'
import { MapsUtil } from '../utils/MapsUtil'
import { Conversion } from '../utils/Conversion'
import { useIpfsNs } from '../constants'

export class Apartment {
	constructor () {
		this.id = null

		this.uniqid = ''
		this.title = ''
		this.description = ''
		this.street = ''
		this.number = ''
		this.zip = ''
		this.city = ''
		this.country = ''
		this.position = null
		this.pricePerNight = 0
		this.deposit = 0
		this.primaryImage = ''
		this.images = []
		this.availabilityHash = ''
		this.rentedTimes = []

		this.ownerAddress = ''
		this.ownerPublicKey_x = ''
		this.ownerPublicKey_y = ''
		this.ipfsHash = ''
		this.reviews = []
		this.totalScore = 0
	}

	/**
	 * Add an apartment with the passed data. Sends the apartment to the blockchain with the given account. Returns the created apartment.
	 *
	 * @param account
	 * @param data
	 * @param primaryImageInputElement
	 * @param imageInputElements
	 */
	static async add (account, data, primaryImageInputElement, imageInputElements) {
		let apartment = new Apartment()
		Object.assign(apartment, data)
		apartment.ownerAddress = account.address

		// Assign a unique id, used as IPNS key name
		apartment.uniqid = Cryptography.getRandomString()

		// Show the load message. Wait for the response, as following steps might freeze the browser for a second.
		await Loading.show('Adding apartment')

		// Determine the owner Ec account first as this might require further interaction (e.g. entering a password)
		Loading.add('account', 'Initializing elliptic cryptography account')
		let ownerEcAccount = await Cryptography.getOrCreateEcAccount(account)
		apartment.ownerPublicKey_x = ownerEcAccount.public.x
		apartment.ownerPublicKey_y = ownerEcAccount.public.y
		Loading.success('account')

		Loading.add('images', 'Uploading images to IPFS')

		// Upload images
		let promises = []

		// Upload primary image
		if (primaryImageInputElement.files[0]) {
			promises.push(new Promise((resolve, reject) => {
				IpfsUtil.uploadImage(primaryImageInputElement).then(hash => {
					apartment.primaryImage = IpfsUtil.ipfsAddrToHash(hash)

					resolve()
				})
			}))
		}

		// Upload other images
		imageInputElements.each((index, element) => {
			if (element.files[0]) {
				let index = $(element).data('index')

				promises.push(new Promise((resolve, reject) => {
					IpfsUtil.uploadImage(element).then(hash => {
						apartment.images[index] = IpfsUtil.ipfsAddrToHash(hash)

						resolve()
					})
				}))
			}
		})

		// Update loading message when all images have been uploaded
		Promise.all(promises).then(() => {
			Loading.success('images')
		})

		// Generate an IPNS key and upload apartment availabilities
		Loading.add('ipns', 'Uploading apartment availability')
		let ipnsPromise = new Promise(async resolve => {
			await apartment.uploadAvailability()

			Loading.success('ipns')

			resolve()
		})

		// Only proceed when all images have been uploaded and apartment availability has been uploaded => IPNS key has been generated
		await Promise.all(promises)
		await ipnsPromise

		// Upload the details
		Loading.add('details', 'Uploading apartment details to IPFS')
		let detailsAddress = await IpfsUtil.uploadString(JSON.stringify(apartment.getIpfsDetails()))
		apartment.ipfsHash = IpfsUtil.ipfsAddrToHash(detailsAddress)
		Loading.success('details')

		let cityHash = Apartment.getCountryCityHash(apartment.country, apartment.city)

		let parameters = [
			apartment.ownerPublicKey_x,
			apartment.ownerPublicKey_y,
			apartment.ipfsHash,
			cityHash
		]

		// Add a topic subscription to receive interaction key requests
		Loading.add('subscribe', 'Subscribe to interaction key requests')
		PubSub.subscribeToTopic('request-interaction-key', ownerEcAccount.address).then(() => {
			Loading.success('subscribe')
		})

		Loading.add('add.blockchain', 'Sending apartment transaction to blockchain')

		// Estimate gas and call the addApartment function
		let method = Web3Util.contract.methods.addApartment(...parameters)
		return new Promise((resolve, reject) => {
			method.estimateGas({from: apartment.ownerAddress})
				.then(gasAmount => {
					method.send({from: apartment.ownerAddress, gas: gasAmount})
						.on('receipt', () => {
							Loading.success('add.blockchain')
							Loading.hide()

							// Mark the account as used by an owner
							account.type = 'owner'

							resolve(apartment)
						})
						.on('error', (error) => {
							console.error(error, parameters)
							Loading.error('add.blockchain')
							Loading.hide()

							reject(apartment, error)
						})
				})

				.catch(error => {
					console.error(error, parameters)
					Loading.error('add.blockchain')
					Loading.hide()

					this.removePendingRequest()

					reject(error)
				})
		})
	}

	/**
	 * Find an apartment by it's id
	 *
	 * @param id
	 * @returns {Promise<Apartment>}
	 */
	static async findById (id) {
		let apartment = new Apartment()

		// Fetch the apartment from the blockchain
		let apartmentData = await Web3Util.contract.methods.getApartment(id).call()

		Object.assign(apartment, apartmentData)
		apartment.id = id

		// Fetch the details
		await apartment.fetchReviews()
		await apartment.fetchDetails()

		return apartment
	}

	/**
	 * Get all apartments in the specified city
	 *
	 * @param country
	 * @param city
	 * @returns {Promise<Array>}
	 */
	static async getCityApartments (country, city) {
		let promises = []
		let apartments = []

		let cityHash = Apartment.getCountryCityHash(country, city)

		Loading.show('Fetching apartments for ' + city + ', ' + country)

		let numApartments = parseInt(await Web3Util.contract.methods.getNumCityApartments(cityHash).call())
		let fetchedApartments = 0
		let fetchedReviews = 0
		let fetchedDetails = 0
		let fetchedAvailability = 0

		// Fetch all apartments for the city
		for (let i = 0; i < numApartments; i++) {
			// Get the apartment for the city hash
			promises.push(new Promise((resolve, reject) => {
				Loading.add('blockchain', 'Get apartments from blockchain', '0 / ' + numApartments)
				Loading.add('reviews', 'Fetch reviews', '0 / ' + numApartments)
				Loading.add('details', 'Fetch apartment details', '0 / ' + numApartments)
				Loading.add('availability', 'Download availability', '0 / ' + numApartments)
				Web3Util.contract.methods.getCityApartment(cityHash, i).call().then(async apartmentData => {
					fetchedApartments++
					Loading.set('blockchain', fetchedApartments + ' / ' + numApartments)

					if (fetchedApartments === numApartments) {
						Loading.success('blockchain')
					}

					let apartment = new Apartment()
					Object.assign(apartment, apartmentData)
					apartment.city = city
					apartment.country = country
					apartment.pricePerNight = parseInt(apartmentData.pricePerNight)
					apartment.deposit = parseInt(apartmentData.deposit)

					// Fetch the reviews
					let apartmentPromises = []
					apartmentPromises.push(apartment.fetchReviews().then(() => {
						fetchedReviews++
						Loading.set('reviews', fetchedReviews + ' / ' + numApartments)

						if (fetchedReviews === numApartments) {
							Loading.success('reviews')
						}
					}))

					// Fetch the details
					await apartment.fetchDetails()
					fetchedDetails++
					Loading.set('details', fetchedDetails + ' / ' + numApartments)
					if (fetchedDetails === numApartments) {
						Loading.success('details')
					}

					// Download the availability
					apartmentPromises.push(apartment.downloadAvailability().then(() => {
						fetchedAvailability++
						Loading.set('availability', fetchedDetails + ' / ' + numApartments)

						if (fetchedAvailability === numApartments) {
							Loading.success('availability')
						}
					}))

					// Wait till everything has been fetched
					await Promise.all(apartmentPromises)

					// Add the apartment to the list and resolve the promise
					apartments.push(apartment)
					resolve()
				})
			}))
		}

		await Promise.all(promises)

		Loading.hide()

		return apartments
	}

	/**
	 * Upload the availability for the apartment to IPNS / IPFS NS. Signs the rented times before they are uploaded.
	 *
	 * @returns {Promise<void>}
	 */
	async uploadAvailability () {
		// Get the owner EC account
		let ecAccount = await Cryptography.getEcAccountForBcAccount(this.ownerAddress)

		// Sign the rented times using the owner key
		let message = JSON.stringify(this.rentedTimes)
		let sign = Web3Util.web3.eth.accounts.sign(message, ecAccount.private.hex)
		let data = {
			rentedTimes: this.rentedTimes,
			signature:   sign.signature
		}

		// Upload the rented times to IPFS
		let ipfsHash = await IpfsUtil.uploadData(data)

		// If we use standard IPNS, publish the hash on IPNS and set the availability hash
		if (!useIpfsNs) {
			this.availabilityHash = await IpfsUtil.publishOnIpns(this.uniqid, ipfsHash)

			return
		}

		// Otherwise, check if we already have an ID. In this case, we want to update the availability (since the apartment already exists)
		// For IPFS NS we don't need to set the availability hash as the apartment hash as it just uses the unique id
		if (this.id) {
			await IpfsUtil.updateOnIpfsNs(this.uniqid, ipfsHash, ecAccount)

			return
		}

		await IpfsUtil.addToIpfsNs(this.uniqid, ipfsHash, ecAccount)
	}

	/**
	 * Download the availability of the apartment from IPNS / IPFS NS. Checks the downloaded availability is signed by the owner.
	 *
	 * @returns {Promise<void>}
	 */
	async downloadAvailability () {
		// Resolve the IPNS / IPFS NS hash
		let ipfsHash = (useIpfsNs)
			? await IpfsUtil.resolveFromIpfsNs(this.uniqid)
			: await IpfsUtil.resolveFromIpns(this.availabilityHash)

		// Download the data
		let data = await IpfsUtil.downloadDataFromHexHash(ipfsHash)

		// Only continue if the data contains the necessary properties
		if (typeof data.rentedTimes === 'undefined' || typeof data.signature === 'undefined') {
			console.error('Required properties missing to download availability', data)
			return
		}

		// Check the signature of the downloaded data
		let message = JSON.stringify(data.rentedTimes)
		let address = Conversion.getEcAddressFromXY(this.ownerPublicKey_x, this.ownerPublicKey_y)
		let recoveredAddress = Web3Util.web3.eth.accounts.recover(message, data.signature).toLowerCase()
		if (address !== recoveredAddress) {
			console.error('Signature mismatch for data retrieved from IPNS: expected address ' + address + ' but recovered ' + recoveredAddress + ' for message', message)
			return
		}

		this.rentedTimes = data.rentedTimes
	}

	/**
	 * Fetch the reviews for the apartment
	 *
	 * @returns {Promise<any[]>}
	 */
	async fetchReviews () {
		let promises = []

		this.reviews = []
		this.totalScore = 0

		// If the apartment has reviews, fetch them
		if (this.numReviews > 0) {
			for (let j = 0; j < this.numReviews; j++) {
				// Add a promise that will only resolve when we have the review (with text)
				promises.push(
					new Promise(async (resolve, reject) => {
						let review = await Web3Util.contract.methods.getApartmentReview(this.id, j).call()
						let reviewText = await IpfsUtil.downloadDataFromHexHash(review.ipfsHash)

						this.totalScore += review.score
						this.reviews.push({
							score: review.score,
							text:  reviewText
						})

						resolve()
					})
				)
			}
		}

		// Test reviews
		this.reviews.push({
			score: 4,
			text:
			       'Donec ullamcorper nulla non metus auctor fringilla. Etiam porta sem malesuada magna mollis euismod. ' +
				       'Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor. Etiam porta sem malesuada magna mollis euismod. ' +
				       'Curabitur blandit tempus porttitor. Cras mattis consectetur purus sit amet fermentum.\n' +
				       '\n' +
				       'Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum. ' +
				       'Maecenas sed diam eget risus varius blandit sit amet non magna. ' +
				       'Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor. Praesent commodo cursus magna, ' +
				       'vel scelerisque nisl consectetur et. Nullam quis risus eget urna mollis ornare vel eu leo. ' +
				       'Aenean lacinia bibendum nulla sed consectetur. Vestibulum id ligula porta felis euismod semper.'
		})
		this.reviews.push({
			score: 3,
			text:
			       'Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum nibh, ut fermentum massa justo sit ' +
				       'amet risus. Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum. Aenean eu ' +
				       'leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum. Praesent commodo cursus magna, ' +
				       'vel scelerisque nisl consectetur et. Cras mattis consectetur purus sit amet fermentum. Integer posuere ' +
				       'erat a ante venenatis dapibus posuere velit aliquet. Duis mollis, est non commodo luctus, nisi erat ' +
				       'porttitor ligula, eget lacinia odio sem nec elit.\n' +
				       '\n' +
				       'Duis mollis, est non commodo luctus, nisi erat porttitor ligula, eget lacinia odio sem nec elit. ' +
				       'Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Cum sociis natoque ' +
				       'penatibus et magnis dis parturient montes, nascetur ridiculus mus. Aenean eu leo quam. Pellentesque ornare ' +
				       'sem lacinia quam venenatis vestibulum. Maecenas sed diam eget risus varius blandit sit amet non magna.\n' +
				       '\n' +
				       'Nullam quis risus eget urna mollis ornare vel eu leo. Integer posuere erat a ante venenatis dapibus ' +
				       'posuere velit aliquet. Donec ullamcorper nulla non metus auctor fringilla. Cum sociis natoque penatibus et ' +
				       'magnis dis parturient montes, nascetur ridiculus mus. Vestibulum id ligula porta felis euismod semper.'
		})
		this.reviews.push({
			score: 3,
			text:
			       'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam id dolor id nibh ultricies vehicula ut ' +
				       'id elit. Cras mattis consectetur purus sit amet fermentum. Praesent commodo cursus magna, vel scelerisque ' +
				       'nisl consectetur et. Vestibulum id ligula porta felis euismod semper. Vestibulum id ligula porta felis euismod semper.'
		})
		this.reviews.push({
			score: 5,
			text:
			       'Nulla vitae elit libero, a pharetra augue. Aenean lacinia bibendum nulla sed consectetur. Donec id elit ' +
				       'non mi porta gravida at eget metus. Duis mollis, est non commodo luctus, nisi erat porttitor ligula, ' +
				       'eget lacinia odio sem nec elit. Donec id elit non mi porta gravida at eget metus.\n' +
				       '\n' +
				       'Duis mollis, est non commodo luctus, nisi erat porttitor ligula, eget lacinia odio sem nec elit. ' +
				       'Donec sed odio dui. Donec sed odio dui. Integer posuere erat a ante venenatis dapibus posuere velit aliquet. ' +
				       'Aenean eu leo quam. Pellentesque ornare sem lacinia quam venenatis vestibulum.'
		})
		this.totalScore = 15

		return Promise.all(promises)
	}

	/**
	 * Get the average score for this apartment
	 *
	 * @returns {number}
	 */
	get averageScore () {
		return (this.reviews.length > 0)
			? this.totalScore / this.reviews.length
			: 0
	}

	/**
	 * Get the public key buffer for the apartment owner
	 *
	 * @returns {Uint8Array}
	 */
	get ownerKeyBuffer () {
		return Conversion.getUint8ArrayBufferFromXY(this.ownerPublicKey_x, this.ownerPublicKey_y)
	}

	/**
	 * Calculate the rental fee based on the supplied days
	 *
	 * @param fromDay
	 * @param tillDay
	 * @returns {number}
	 */
	calculateFee (fromDay, tillDay) {
		if (typeof this.pricePerNight === 'undefined') {
			return 0
		}

		let days = tillDay - fromDay

		if (days <= 0) {
			return 0
		}

		return this.pricePerNight * days
	}

	/**
	 * Get the requested deposit in eth
	 *
	 * @returns {number}
	 */
	get depositInEth () {
		return Conversion.finneyToEth(this.deposit)
	}

	/**
	 * Get the URLs of all images available for this apartment
	 *
	 * @returns {Array}
	 */
	getImageUrls () {
		let urls = []

		// Check if we have a primary image we can add
		if (this.primaryImage) {
			urls.push(IpfsUtil.getImageUrl(this.primaryImage))
		}

		// Add all other images
		for (let ipfsHash of this.images) {
			urls.push(IpfsUtil.getImageUrl(ipfsHash))
		}

		return urls
	}

	/**
	 * Fetch the details for this apartment from IPFS.
	 *
	 * @returns {Promise<void>}
	 */
	async fetchDetails () {
		// Fetch the details and assign them
		let details = await IpfsUtil.downloadDataFromHexHash(this.ipfsHash)
		Object.assign(this, details)
		this.pricePerNight = parseInt(details.pricePerNight)
		this.deposit = parseInt(details.deposit)

		this.position = await MapsUtil.getMapsAddressPosition(
			this.street + ' ' + this.number + ', ' + this.city + ', ' + this.country
		)
	}

	/**
	 * Get the details to be sent to IPFS
	 *
	 * @returns {{
	 *  uniqid: string,
	 *  title: string,
	 *  description: string,
	 *  street: string,
	 *  number: string,
	 *  zip: string,
	 *  city: string,
	 *  country: string,
	 *  pricePerNight: number,
	 *  deposit: number,
	 *  primaryImage: string,
	 *  images: Array
	 *  availabilityHash: string
	 * }}
	 */
	getIpfsDetails () {
		return {
			uniqid:           this.uniqid,
			title:            this.title,
			description:      this.description,
			street:           this.street,
			number:           this.number,
			zip:              this.zip,
			city:             this.city,
			country:          this.country,
			pricePerNight:    this.pricePerNight,
			deposit:          this.deposit,
			primaryImage:     this.primaryImage,
			images:           this.images,
			availabilityHash: this.availabilityHash
		}
	}

	/**
	 * Get the hash for county and city by which apartments can be searched for
	 *
	 * @param country
	 * @param city
	 * @return string
	 */
	static getCountryCityHash (country, city) {
		return Web3Util.web3.utils.keccak256(
			JSON.stringify({
				'country': country,
				'city':    city
			})
		)
	}
}
