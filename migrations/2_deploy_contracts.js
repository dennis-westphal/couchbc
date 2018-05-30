var Library = artifacts.require("./Library.sol");
var Rent = artifacts.require("./Rent.sol");

module.exports = function(deployer) {
  deployer.deploy(Library);
  deployer.link(Library, Rent);
  deployer.deploy(Rent);
};
