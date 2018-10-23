pragma solidity ^0.4.22;

library Library{
    function finneyToWei(uint finneyValue) public pure returns (uint) {
        return finneyValue * 1000000000000000;
    }

    function weiToFinney(uint weiValue) public pure returns (uint) {
        return weiValue / 1000000000000000;
    }
}
