pragma solidity ^0.4.22;

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
		// Create a bytes array that can fit the maximum size of an uint (2^256 = ~1.16e77)
		bytes memory reversedChars = new bytes(78);

		// Determine the actual int length
		uint8 strLength = 0;

		// Perform as long as the integer is not empty
		while (integer != 0) {
			// Get the digit with modulo
			uint remainder = integer % 10;

			// Strip off the last digit by dividing by 10
			integer = integer / 10;

			// Add the char to the reversedChars and increase the string length
			reversedChars[strLength] = byte(48 + remainder);
		}

		// Create a new bytes array with the right length
		bytes memory resultBytes = new bytes(i);

		// Reverse iterate through the array and add the chars to the result array
		for (uint8 i = strLength; i > 0; i--) {
			resultBytes[strLength - i] = reversedChars[i - 1];
		}

		// Return a string from the bytes array
		return string(resultBytes);
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
