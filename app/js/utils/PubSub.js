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
		this.subscriptionIntervals = {}
		this.receivedMessages = []
		this.topicProcessors = {}

		this.gtoken = new GoogleToken({
			email: googlePubSubEmail,
			scope: googlePubSubScopes,
			key:   googlePubSubKey
		})
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
	 * Add a topic subscription that will be restored when the page is reloaded, and subscribe to the topic
	 *
	 * @param topic
	 * @param ecAccountAddress
	 * @return {Promise<void>}
	 */
	async addTopicSubscription (topic, ecAccountAddress) {
		// Get the existing subscription registrations
		let topicSubscriptions = window.localStorage.getItem('topicSubscriptions')

		// Create or parse the hashmap
		topicSubscriptions = (topicSubscriptions === null)
			? {}
			: JSON.parse(topicSubscriptions)

		// Add the topic subscription
		topicSubscriptions[topic] = ecAccountAddress || null

		// Store the topic subscriptions
		window.localStorage.setItem('topicSubscriptions', JSON.stringify(topicSubscriptions))

		this.subscribeToTopic(topic, ecAccountAddress)
	}

	/**
	 * Subscribe to a topic. If ecAccountAddress is given, tries to decrypt the message using the ec account stored at the specified address.
	 * @param topic
	 * @param ecAccountAddress
	 * @returns {Promise<void>}
	 */
	async subscribeToTopic (topic, ecAccountAddress) {
		// Check if we already have a subscription id for the topic; if so, we can start listening
		let subscription = window.localStorage.getItem('topic.' + topic + '.subscription')
		if (subscription) {
			this.listenToSubscription(JSON.parse(subscription))
			return
		}

		// Create a new subscription
		subscription = {
			id:               PubSubClass.getRandomSubscriptionId(),
			topic:            topic,
			ecAccountAddress: ecAccountAddress || null
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

		// Store the subscription in localStorage
		window.localStorage.setItem('topic.' + topic + '.subscription', JSON.stringify(subscription))

		// Listen to the subscription
		this.listenToSubscription(subscription)
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
	 * Listen to a subscription. Creates a period check to fetch messages from the subscription.
	 *
	 * @param subscription
	 */
	listenToSubscription (subscription) {
		// If we already listen to the subscription, we're done
		if (this.subscriptionIntervals['interval-' + subscription.id]) {
			return
		}

		// Periodically pull from the subscription
		this.subscriptionIntervals['interval-' + subscription.id] = window.setInterval(() => {
			this.pullFromSubscription(subscription)
		}, pullInterval)
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

				let ecAccount = await Cryptography.getEcAccount(subscription.ecAccountAddress)

				data = await Cryptography.decryptString(data, ecAccount.private.buffer)

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
