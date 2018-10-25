var Library = artifacts.require('./Library.sol');
var strings = artifacts.require('./strings/strings.sol');
var Verifier = artifacts.require('./Verifier.sol');
var Rent = artifacts.require('./Rent.sol');

module.exports = function(deployer) {
	deployer.deploy(strings);
	deployer.deploy(Library);

	deployer.link(strings, Verifier);
	deployer.link(Library, Verifier);
	deployer.deploy(Verifier);

	deployer.link(Library, Rent);
	deployer.link(Verifier, Rent);
	deployer.link(strings, Rent);
	deployer.deploy(Rent);
};
