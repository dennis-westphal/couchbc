pragma solidity ^0.4.25;

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

	// Convert a byte to a a hex char
	function byteToHex(byte b) internal pure returns (byte) {
		if (b < 10) {
			return byte(uint8(b) + 0x30);
		}

		return byte(uint8(b) + 0x57);
	}

	// Convert a bytes32 fixed byte array to a hex encoded string (without prefix)
	function b32ToString(bytes32 b32) public pure returns (string) {
		bytes memory bytesArray = new bytes(64);

		for (uint i = 0; i < 32; i++) {
			// Get the value at the specified index
			byte value = byte(b32[i]);

			// Get the upper and lower value for hex encoding
			byte upper = byte(uint8(value) / 16);
			byte lower = byte(uint8(value) - 16 * uint8(upper));

			// Get the hex value
			bytesArray[i * 2] = byteToHex(upper);
			bytesArray[i * 2 + 1] = byteToHex(lower);
		}

		return string(bytesArray);
	}

	// Convert an address to a hex encoded string (without prefix)
	function addressToString(address addr) public pure returns (string) {
		bytes memory bytesArray = new bytes(40);
		uint addrInt = uint(addr);

		for (uint i = 0; i < 20; i++) {
			// Get the value at the specified index
			byte value = byte(uint8(addrInt / (2 ** (8 * (19 - i)))));

			// Get the upper and lower value for hex encoding
			byte upper = byte(uint8(value) / 16);
			byte lower = byte(uint8(value) - 16 * uint8(upper));

			// Get the hex value
			bytesArray[i * 2] = byteToHex(upper);
			bytesArray[i * 2 + 1] = byteToHex(lower);
		}

		return string(bytesArray);
	}
}
