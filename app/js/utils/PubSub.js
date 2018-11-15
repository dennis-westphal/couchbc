import { default as $ } from 'jquery'
import {
	googleAckUrl,
	googleApiProject,
	googlePublishUrl,
	googlePubSubScopes,
	googlePullUrl,
	googleSubscribeUrl,
	pullInterval
} from '../constants'
import { Cryptography } from './Cryptography'
import { googlePubSubEmail, googlePubSubKey } from '../credentials'

const {GoogleToken} = require('gtoken')

class PubSubClass {
	constructor () {
		this.receivedMessages = []
		this.topicProcessors = {}

		this.gtoken = new GoogleToken({
			email: googlePubSubEmail,
			scope: googlePubSubScopes,
			key:   googlePubSubKey
		})
	}

	/**
	 * Starts the pub sub listener. Creates a period check to fetch messages from the subscriptions.
	 * Requires that the a topic subscription exists, but performs new checks for existing subscriptions regularly.
	 * Should be called after topic processors have been registered.
	 */
	async start () {
		await this._restoreTopicSubscriptions()

		// Periodically fetch the subscriptions
		window.setInterval(() => {
			let subscriptions = JSON.parse(window.localStorage.getItem('topicSubscriptions') || '{}')

			for (let element of Object.entries(subscriptions)) {
				this.pullFromSubscription(element[1])
			}
		}, pullInterval)
	}

	/**
	 * Restore topic subscriptions from local storage.
	 *
	 * @returns {Promise<void>}
	 * @private
	 */
	async _restoreTopicSubscriptions () {
		// Check if we have subscriptions
		let topicSubscriptions = window.localStorage.getItem('topicSubscriptions')

		// If we don't have subscriptions, we're done
		if (topicSubscriptions === null) {
			return
		}

		// Parse topic subscriptions (should be object topic => subscription {id: string, topic: string, ecAccountAddresses: string[]})
		topicSubscriptions = JSON.parse(topicSubscriptions)

		let promises = []
		for (let topic in topicSubscriptions) {
			promises.push(this.subscribeToTopic(topic))
		}

		await Promise.all(promises)
	}

	// Messaging

	/**
	 * Publish a message to the given topic, optionally encrypting it in the process.
	 * If a single public key (buffer) is supplied, the message is encoded using that buffer.
	 * If an array of public key (buffers) is supplied, the message will be encrypted with all public keys and
	 * can be decrypted with any of the corresponding private keys
	 *
	 * @param message
	 * @param topic
	 * @param publicKeyBuffers Buffer containing one public key to be used for encryption, or array with all public key buffers
	 * @returns {Promise<*>}
	 */
	async publishMessage (message, topic, publicKeyBuffers) {
		let url = googlePublishUrl.replace('{topic}', topic)

		// Check if we got an array; if so encrypt using multiple public keys
		if (typeof publicKeyBuffers === 'object' && Array.isArray(publicKeyBuffers)) {
			message = await Cryptography.encryptStringMulti('VALID ' + message, publicKeyBuffers)
		} else if (publicKeyBuffers) {
			// Add VALID to the encrypted message for easy checking
			message = await Cryptography.encryptString('VALID ' + message, publicKeyBuffers)
		}

		// Create the message
		let data = {
			messages: [
				{
					data: window.btoa(message)
				}
			]
		}

		// Get an access token
		let accessToken = await this.gtoken.getToken()

		// Send the request as ajax
		return $.ajax({
			url:         url,
			data:        JSON.stringify(data),
			dataType:    'json',
			contentType: 'application/json',
			method:      'POST',
			headers:     {
				'Authorization': 'Bearer ' + accessToken
			}
		})
	}

	/**
	 * Subscribe to a topic. If ecAccountAddress is given, tries to decrypt the message using the ec account stored at the specified address.
	 * If a stored subscription is available for the topic, also uses any ecAccounts given for the stored subscription.
	 *
	 * @param topic
	 * @param ecAccountAddress
	 * @returns {Promise<void>}
	 */
	async subscribeToTopic (topic, ecAccountAddress) {
		let subscriptions = JSON.parse(window.localStorage.getItem('topicSubscriptions') || '{}')

		// Check if we already have a subscription id for the topic
		if (subscriptions[topic]) {
			// If we already have a subscription, we only need to add the ecAccountAddress for decryption if it is set and does not exist yet
			if (ecAccountAddress && subscriptions[topic].ecAccountAddresses.indexOf(ecAccountAddress) === -1) {
				subscriptions[topic].ecAccountAddresses.push(ecAccountAddress)

				window.localStorage.setItem('topicSubscriptions', JSON.stringify(subscriptions))
			}

			return
		}

		// Create a new subscription
		let subscription = {
			id:                 PubSubClass.getRandomSubscriptionId(),
			topic:              topic,
			ecAccountAddresses: ((ecAccountAddress) ? [ecAccountAddress] : [])
		}

		// Create the request
		let url = googleSubscribeUrl.replace('{subscription}', subscription.id)
		let data = {
			topic: 'projects/' + googleApiProject + '/topics/' + topic
		}

		// Get an access token
		let accessToken = await this.gtoken.getToken()

		// Send the request
		await $.ajax({
			url:         url,
			data:        JSON.stringify(data),
			dataType:    'json',
			contentType: 'application/json',
			method:      'PUT',
			headers:     {
				'Authorization': 'Bearer ' + accessToken
			}
		})

		// Reload subscriptions as they might have changed in the meantime
		subscriptions = JSON.parse(window.localStorage.getItem('topicSubscriptions') || '{}')

		// Store the subscription in localStorage
		subscriptions[topic] = subscription
		window.localStorage.setItem('topicSubscriptions', JSON.stringify(subscriptions))

		// Wait a while when a new subscription is added as Google might need some time before it becomes active
		await new Promise(resolve => setTimeout(resolve, 500))
	}

	/**
	 * Get a random subscription id to be used with google pub/sub subscriptions
	 *
	 * @returns {string}
	 */
	static getRandomSubscriptionId () {
		return 'sub-' + Cryptography.getRandomString()
	}

	/**
	 * Pull messages from the specified subscription. Hands the retrieved messages off to processMessage.
	 *
	 * @param subscription
	 * @return {Promise<void>}
	 */
	async pullFromSubscription (subscription) {
		let url = googlePullUrl.replace('{subscription}', subscription.id)
		let data = {
			maxMessages:       10,
			returnImmediately: true
		}

		// Get an access token
		let accessToken = await this.gtoken.getToken()

		// Send the request
		let result = await $.ajax({
			url:         url,
			data:        JSON.stringify(data),
			dataType:    'json',
			contentType: 'application/json',
			method:      'POST',
			headers:     {
				'Authorization': 'Bearer ' + accessToken
			}
		})

		// If we don't have any messages, we're done
		if (typeof result.receivedMessages === 'undefined') {
			return
		}

		console.debug('Received subscription messages', result.receivedMessages)

		// Construct a new request
		url = googleAckUrl.replace('{subscription}', subscription.id)
		data = {
			ackIds: []
		}

		// Add the messages to the topic messages
		for (let message of result.receivedMessages) {
			// Process the message if we haven't done it yet
			if (this.receivedMessages.indexOf(message.message.messageId) === -1) {
				let data = window.atob(message.message.data)

				// If we don't need to decrypt the message, we can directly process it
				if (subscription.ecAccountAddress === null) {
					this.processTopicMessage(subscription.topic, data)
					this.receivedMessages.push(message.message.messageId)
				}

				// Get all private key buffers that can be used for the decryption
				let privateKeyBuffers = []
				let promises = []

				for (let ecAccountAddress of subscription.ecAccountAddresses) {
					promises.push(new Promise(async resolve => {
						let ecAccount = await Cryptography.getEcAccount(ecAccountAddress)

						if (ecAccount) {
							privateKeyBuffers.push(ecAccount.private.buffer)
						}

						resolve()
					}))
				}

				// Wait till we got all private key buffers
				await Promise.all(promises)

				data = await Cryptography.decryptStringMulti(data, privateKeyBuffers)

				// Only process if the message was decrypted properly
				if (data != null && data.substr(0, 6) === 'VALID ') {
					this.processTopicMessage(subscription.topic, data.substr(6))
				}

				this.receivedMessages.push(message.message.messageId)
			}

			// Add message to messages to ack
			data.ackIds.push(message.ackId)
		}

		// Send request to acknowledge receipt
		$.ajax({
			url:         url,
			data:        JSON.stringify(data),
			dataType:    'json',
			contentType: 'application/json',
			method:      'POST',
			headers:     {
				'Authorization': 'Bearer ' + accessToken
			}
		})
	}

	/**
	 * Register a processor for received topic messages
	 *
	 * @param topic
	 * @param callback Callback which receives the message as first parameter and the topic as second
	 */
	registerTopicProcessor (topic, callback) {
		this.topicProcessors[topic] = callback
	}

	/**
	 * Process a topic message by handing it off to the corresponding processor
	 *
	 * @param topic
	 * @param message
	 */
	processTopicMessage (topic, message) {
		console.debug('Processing topic ' + topic + ' message', message)

		if (this.topicProcessors[topic]) {
			this.topicProcessors[topic](message, topic)
			return
		}

		console.warn('No processor registered for topic ' + topic + ', dropping message')
	}
}

export const PubSub = new PubSubClass()
