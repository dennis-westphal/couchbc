# CouchBC
Apartment Rental Dapp Built on Ethereum Blockchain Technology

## Usage
The application is deployed on the Ropsten network.

Some things to consider for testing:
* The test application does not have frontend validation
* Images and other apartment details are published publicly on IPFS, so only use data you have the rights for

For testing on the test network, the following is recommended:
1. Use Mist and switch to the Ropsten Test Network.
2. Create multiple accounts for testing
3. Get test ether for the accounts from https://faucet.metamask.io/
4. Go to couchbc.com and authorize the created accounts for the site
5. Create apartments on the blockchain. Please enter and select a proper address for the apartment to later show up in the list
6. Switch to a second machine or use a Browser with MetaMask to show the added apartment (MetaMask never exposes more than one account for the site at once, so it's better to use it for testing the tenant side)
7. Search for the city, select the apartment and request a rental
8. Switch to Mist / the first machine and refresh the page
9. Accept or deny the rental

## Missing features
* Events have been implemented in the smart contract, but not in the frontend. Therefore you need to reload after a change has occurred to the rentals.
* Mediation is implemented in the smart contract, but not in the frontend.

## Requirements
To run the app in a local test network (i.e. truffle), you will need the following
* An IPFS server
* npm
* node.js to run IPFS NS
* Truffle or another test network with support for web3 1.0
* A Google Cloud Pub/Sub project
* An infura account for test network deployment

## Installation
* Create the topics "issue-interaction-key" and "request-interaction-key" on Google Cloud Pub/Sub and follow the configuration
* Adjust constants in the js/constants.js file
* Adjust credentials in the js/credentials.js file
* Run "npm install" in your application folder
* For local test network, run the following in the application folder:
  * truffle develop
  * migrate --reset
  * (In a second console window) node/modules/.bin/webpack
* For ropsten network:
  * Set your wallet seed in wallet.js
  * Adjust the infura project in truffle.js
  * run "truffle deploy --network ropsten"