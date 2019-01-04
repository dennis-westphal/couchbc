var Library = artifacts.require('./Library.sol')
var Verifier = artifacts.require('./Verifier.sol')
var Rent = artifacts.require('./Rent.sol')

module.exports = function (deployer) {
	deployer.deploy(Library)
	deployer.deploy(Verifier)

	deployer.link(Library, Rent)
	deployer.link(Verifier, Rent)
	deployer.deploy(Rent)
}
