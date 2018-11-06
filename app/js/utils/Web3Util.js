import { useInjectedWeb3, websocketAddress } from '../constants'
import { default as Web3 } from 'web3'
import { Notifications } from './Notifications'
import rentArtifacts from '../../../build/contracts/Rent'

class Web3UtilClass {
	constructor () {
		// Check if we can use an injected web3
		if (typeof window.web3 !== 'undefined' && useInjectedWeb3) {
			// Use Mist/MetaMask's provider
			this.web3 = new Web3(window.web3.currentProvider)
		} else {
			console.warn(
				'No web3 detected. Falling back to ' + websocketAddress +
				'. You should remove this fallback when you deploy live, as it\'s inherently insecure. ' +
				'Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask')
			// Connect via websocket for test purposes
			this.web3 = new Web3(websocketAddress)
		}

		this.accounts = []
		this.contract = new this.web3.eth.Contract(rentArtifacts.abi, rentArtifacts.networks[4447].address)
	}

	/**
	 * Fetch the accounts from web3
	 *
	 * @returns {Promise<*>}
	 */
	async fetchAccounts () {
		return new Promise((resolve, reject) => {
			this.web3.eth.getAccounts((error, bcAddresses) => {
				if (error) {
					Notifications.show('There was an error fetching your blockchain accounts')
					console.error(error)
					return
				}

				if (bcAddresses.length === 0) {
					Notifications.show('Couldn\'t get any blockchain accounts! Make sure your Ethereum client is configured correctly.')
					return
				}

				this.accounts = this.determineAccounts(bcAddresses)
				resolve(this.accounts)
			})
		})
	}

	/**
	 * Determine the account typed for the supplied blockchain addresses
	 *
	 * @param bcAddresses
	 * @returns {Promise<Array>}
	 */
	async determineAccounts (bcAddresses) {
		let accounts = []
		let promises = []

		let i = 0
		let isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)

		for (let bcAddress of bcAddresses) {
			// Only show half of the accounts to chrome and the other half to other browsers (for test purposes)
			if (isChrome && i++ % 2 === 0) {
				continue
			} else if (!isChrome && i++ % 2 === 1) {
				continue
			}

			promises.push(this.contract.methods.getAddressType().call({from: bcAddress}, (error, type) => {
				if (error) {
					console.error(error)
					Notifications.show('Could not fetch account type')
				}

				let account = {
					'address': bcAddress,
					'type':    type,
					'label':   bcAddress.substr(0, 12) + '...' + bcAddress.substr(36)
				}

				accounts.push(account)
			}))
		}

		// Wait till we got all account's details
		await Promise.all(promises)

		return accounts
	}

	/**
	 * Get the account for the address, or null
	 * @param address
	 * @returns {*}
	 */
	getAccount (address) {
		for (let account of this.accounts) {
			if (account.address === address) {
				return account
			}
		}

		return null
	}
}

export const Web3Util = new Web3UtilClass()
