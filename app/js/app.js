// Import the page's CSS. Webpack will know what to do with it.
import '../css/materialize.css';
import '../css/app.css';

// Import libraries we need.
import '../js/materialize.js';
import {default as Vue} from 'vue';
import {default as Web3} from 'web3';
import {default as contract} from 'truffle-contract';

// Import our contract artifacts and turn them into usable abstractions.
import rent_artifacts from '../../build/contracts/Rent.json';

// Get the contract from the artifacts
let Rent = contract(rent_artifacts);

// Save the accounts
let accounts;
let account;
let rentContract;

let data = new Vue({
	el:   '#app',
	data: {
		page:           'start',
		accountChecked: false,
		registered:     false,
		balance:        '',
	},
});

window.App = {
	start: function() {
		let self = this;

		// Bootstrap the MetaCoin abstraction for Use.
		Rent.setProvider(web3.currentProvider);

		// Get the initial account balance so it can be displayed.
		web3.eth.getAccounts(function(err, accs) {
			if (err != null) {
				alert('There was an error fetching your accounts.');
				return;
			}

			if (accs.length == 0) {
				alert('Couldn\'t get any accounts! Make sure your Ethereum client is configured correctly.');
				return;
			}

			accounts = accs;
			account = accounts[0];

			Rent.deployed().then(function(deployedContract) {
				rentContract = deployedContract;

				self.checkAccount();
			});
		});
	},

	setStatus: function(message) {
		let status = document.getElementById('status');
		status.innerHTML = message;
	},

	checkAccount: function() {
		let self = this;

		rentContract.isRegistered().then(function(result) {
			data.accountChecked = true;
			data.registered = result;

			if (data.registered) {
				self.refreshBalance();
			}
		});
	},

	refreshBalance: function() {
		let self = this;

		rentContract.getBalance().then(function(balance) {
			console.log(balance);
			//data.balance = balance;
		});
	},
};

window.addEventListener('load', function() {
	// Checking if Web3 has been injected by the browser (Mist/MetaMask)
	if (typeof web3 !== 'undefined') {
		// Use Mist/MetaMask's provider
		window.web3 = new Web3(web3.currentProvider);
	} else {
		console.warn(
				'No web3 detected. Falling back to http://127.0.0.1:7545. You should remove this fallback when you deploy live, as it\'s inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask');
		// fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
		window.web3 = new Web3(
				new Web3.providers.HttpProvider('http://127.0.0.1:7545'));
	}

	App.start();
});
