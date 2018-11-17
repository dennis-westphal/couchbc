// Define the server address (for now)
export const websocketAddress = 'wss://couchbc.com'
export const useInjectedWeb3 = false // We can't use Metamask's web3 currently as subscriptions through websockets are still in dev

export const ipfsHost = {'host': 'couchbc.com', 'port': 443, 'protocol': 'https'}
export const ipfsGatewayUrl = '/ipfs/'
export const ipnsResolveTimeout = '1s' // Timeout when resolving IPNS addresses. Setting this too high might cause the app to freeze for a long time.

// If this is specified, a custom ipfs name service is used instead of ipfs
// The node.js server has to be run from ipfsNs.js
export const useIpfsNs = true
export const ipfsNsPath = 'https://couchbc.com/ipfsns/'

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
export const hideLoadingDelay = 500
export const loadingTransitionDuration = 300
