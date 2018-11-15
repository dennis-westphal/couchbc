pragma solidity ^0.4.25;

// Based on ECTools from https://gist.github.com/axic/5b33912c6f61ae6fd96d6c4a47afde6d#gistcomment-1775555
// for signature to (r,s,v) conversion and https://blog.ricmoo.com/verifying-messages-in-solidity-50a94f82b2ca
// for single parameter compatible signing and message prefixing
library Verifier {
	// Returns the address that signed a given string message
	function verifyString(string message, string signature) public pure returns (address signer) {
		// BEGIN (r,s,v) extraction from https://gist.github.com/axic/5b33912c6f61ae6fd96d6c4a47afde6d#gistcomment-1775555
		bytes32 r;
		bytes32 s;
		uint8 v;
		bytes memory sig = hexstrToBytes(substring(signature, 2, 132));
		assembly {
			r := mload(add(sig, 32))
			s := mload(add(sig, 64))
			v := byte(0, mload(add(sig, 96)))
		}
		if (v < 27) {
			v += 27;
		}
		if (v < 27 || v > 28) {
			return 0x0;
		}
		// END


		// BEGIN header construction from https://blog.ricmoo.com/verifying-messages-in-solidity-50a94f82b2ca
		// The message header; we will fill in the length next
		string memory header = "\x19Ethereum Signed Message:\n000000";
		uint256 lengthOffset;
		uint256 length;
		assembly {
		// The first word of a string is its length
			length := mload(message)
		// The beginning of the base-10 message length in the prefix
			lengthOffset := add(header, 57)
		}
		// Maximum length we support
		require(length <= 999999);
		// The length of the message's length in base-10
		uint256 lengthLength = 0;
		// The divisor to get the next left-most message length digit
		uint256 divisor = 100000;
		// Move one digit of the message length to the right at a time
		while (divisor != 0) {
			// The place value at the divisor
			uint256 digit = length / divisor;
			if (digit == 0) {
				// Skip leading zeros
				if (lengthLength == 0) {
					divisor /= 10;
					continue;
				}
			}
			// Found a non-zero digit or non-leading zero digit
			lengthLength++;
			// Remove this digit from the message length's current value
			length -= digit * divisor;
			// Shift our base-10 divisor over
			divisor /= 10;

			// Convert the digit to its ASCII representation (man ascii)
			digit += 0x30;
			// Move to the next character and write the digit
			lengthOffset++;
			assembly {
				mstore8(lengthOffset, digit)
			}
		}
		// The null string requires exactly 1 zero (unskip 1 leading 0)
		if (lengthLength == 0) {
			lengthLength = 1 + 0x19 + 1;
		} else {
			lengthLength += 1 + 0x19;
		}
		// Truncate the tailing zeros from the header
		assembly {
			mstore(header, lengthLength)
		}

		// END

		// Construct hash for ecrecover by combining header and message; recover signer address
		return ecrecover(getHash(header, message), v, r, s);
	}

	// Get a hash to use in ecrecover from a header and the actual message
	// @author dennis_westphal
	function getHash(string header, string message) private pure returns (bytes32) {
		return
		keccak256(// Create a sha3 / keccak256 hash
			abi.encodePacked(// Concatenate header and message
				header,
				message
			)
		);
	}

	// @dev Converts an hexstring to bytes
	// @source https://gist.github.com/axic/5b33912c6f61ae6fd96d6c4a47afde6d#gistcomment-1775555
	function hexstrToBytes(string _hexstr) public pure returns (bytes) {
		uint len = bytes(_hexstr).length;
		require(len % 2 == 0);

		bytes memory bstr = bytes(new string(len / 2));
		uint k = 0;
		string memory s;
		string memory r;
		for (uint i = 0; i < len; i += 2) {
			s = substring(_hexstr, i, i + 1);
			r = substring(_hexstr, i + 1, i + 2);
			uint p = parseInt16Char(s) * 16 + parseInt16Char(r);
			bstr[k++] = uintToBytes32(p)[31];
		}
		return bstr;
	}

	// @dev Parses a hexchar, like 'a', and returns its hex value, in this case 10
	// @source https://gist.github.com/axic/5b33912c6f61ae6fd96d6c4a47afde6d#gistcomment-1775555
	function parseInt16Char(string _char) public pure returns (uint) {
		bytes memory bresult = bytes(_char);
		// bool decimals = false;
		if ((bresult[0] >= 48) && (bresult[0] <= 57)) {
			return uint(bresult[0]) - 48;
		} else if ((bresult[0] >= 65) && (bresult[0] <= 70)) {
			return uint(bresult[0]) - 55;
		} else if ((bresult[0] >= 97) && (bresult[0] <= 102)) {
			return uint(bresult[0]) - 87;
		} else {
			revert();
		}
	}

	// @dev Converts a uint to a bytes32
	// @source https://ethereum.stackexchange.com/questions/4170/how-to-convert-a-uint-to-bytes-in-solidity
	function uintToBytes32(uint _uint) public pure returns (bytes b) {
		b = new bytes(32);
		assembly {mstore(add(b, 32), _uint)}
	}

	// @dev extract a substring
	// @source https://ethereum.stackexchange.com/questions/31457/substring-in-solidity
	function substring(string _str, uint _startIndex, uint _endIndex) public pure returns (string) {
		bytes memory strBytes = bytes(_str);
		require(_startIndex <= _endIndex);
		require(_startIndex >= 0);
		require(_endIndex <= strBytes.length);

		bytes memory result = new bytes(_endIndex - _startIndex);
		for (uint i = _startIndex; i < _endIndex; i++) {
			result[i - _startIndex] = strBytes[i];
		}
		return string(result);
	}
}
