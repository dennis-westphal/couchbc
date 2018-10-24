var Library = artifacts.require('./Library.sol');
var strings = artifacts.require('./strings/strings.sol');
var ECTools = artifacts.require('./ECTools.sol');
var Rent = artifacts.require('./Rent.sol');

module.exports = function(deployer) {
	deployer.deploy(strings);

	deployer.deploy(Library);

	deployer.link(Library, ECTools);
	deployer.link(strings, ECTools);
	deployer.deploy(ECTools);

	deployer.link(Library, Rent);
	deployer.link(ECTools, Rent);
	deployer.link(strings, Rent);
	deployer.deploy(Rent);
};
