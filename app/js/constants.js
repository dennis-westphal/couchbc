// Define the server address (for now)
export const websocketAddress = 'wss://couchbc.com'
export const useInjectedWeb3 = false // We can't use Metamask's web3 currently as subscriptions through websockets are still in dev

export const ipfsHost = {'host': 'couchbc.com', 'port': 443, 'protocol': 'https'}
export const ipfsGatewayUrl = '/ipfs/'

// Constants used for google api requests (maps, places, geocoding)
export const googleApiProject = 'couchbc-1540415979753'
export const pullInterval = 2000 // Pull every X milliseconds

export const googlePubSubScopes = [
	'https://www.googleapis.com/auth/cloud-platform',
	'https://www.googleapis.com/auth/pubsub'
]

// Requires that the topic has already been created in Google API (for example using API explorer)
export const googlePublishUrl = 'https://pubsub.googleapis.com/v1/projects/' + googleApiProject + '/topics/{topic}:publish'
export const googleSubscribeUrl = 'https://pubsub.googleapis.com/v1/projects/' + googleApiProject + '/subscriptions/{subscription}'
export const googlePullUrl = 'https://pubsub.googleapis.com/v1/projects/' + googleApiProject + '/subscriptions/{subscription}:pull'
export const googleAckUrl = 'https://pubsub.googleapis.com/v1/projects/' + googleApiProject + '/subscriptions/{subscription}:acknowledge'

// Options for displaying notifications
export const defaultToastOptions = {
	duration: 5000
}

// Options for loading screens
export const hideLoadingDelay = 1000
export const loadingTransitionDuration = 300
