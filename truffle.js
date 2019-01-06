// Allows us to use ES6 in our migrations and tests.
require('babel-register')

var HDWalletProvider = require('truffle-hdwallet-provider')
var mnemonic = require('./wallet.js').mnemonic

module.exports = {
	networks: {
		development: {
			host:       '127.0.0.1',
			port:       9545,
			network_id: '*' // Match any network id
		},
		ropsten:     {
			provider:   function () {
				return new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/v3/04687e2aa97b41189b526bdfffe93676')
			},
			network_id: 3
		}
	},
	solc:     {
		optimizer: {
			enabled: true,
			runs:    200
		}
	}
}
