pragma solidity ^0.4.24;

library Library {
	// Convert finney to wei
	function finneyToWei(uint finneyValue) public pure returns (uint) {
		return finneyValue * 1000000000000000;
	}

	// Convert wei to finney
	function weiToFinney(uint weiValue) public pure returns (uint) {
		return weiValue / 1000000000000000;
	}

	// Convert an uint to a string
	function uintToString(uint integer) public pure returns (string) {
		// Return "0" if we have 0
		if (integer == 0) {
			return "0";
		}

		uint length;
		uint copy = integer;

		// Determine the length of the integer
		while (copy != 0) {
			length++;
			copy /= 10;
		}

		// Create a new bytes array with the right length
		bytes memory chars = new bytes(length);

		// Add all elements from the integer
		while (integer != 0) {
			// Add chars from the end using the module
			chars[--length] = byte(48 + integer % 10);

			// Drop the last digit
			integer /= 10;
		}

		// Return a string from the chars array
		return string(chars);
	}

	// Convert a fixed-size bytes32 array to a string
	function bytes32ToString(bytes32 input) public pure returns (string) {
		bytes memory bytesArray = new bytes(32);

		for (uint8 i; i < 32; i++) {
			bytesArray[i] = input[i];
		}

		return string(bytesArray);
	}
}
