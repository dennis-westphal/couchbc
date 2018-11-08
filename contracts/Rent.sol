pragma solidity ^0.4.25;

import "./Library.sol";
import "./strings/src/strings.sol";
import "./Verifier.sol";

contract Rent {
	using strings for *;

	uint8 constant mediatorFee = 50; // In Finney (1/1000 eth)

	// -------------------------------------------------------------
	// ------------------------ Definitions ------------------------
	// -------------------------------------------------------------

	// ------------------------ Tenants ------------------------
	enum MediatorStatus {
		Unregistered, // Tenant has not registered as mediator yet
		Registered, // Tenant is registered as mediator
		Revoked // Mediator status has been revoked (after timeout for mediation)
	}

	struct Tenant {
		bool initialized;
		bytes32 publicKey_x;
		bytes32 publicKey_y;

		MediatorStatus mediatorStatus;

		uint totalScore;    // Total score in sum of all rating points. The average score has to be determined totalScore / numReviews
		uint[] rentals;     // Ids of the rentals (array indices)

		// Using an dynamically sized array instead of a mapping would be more elegant, but is not supported by solidity compiler yet
		// (can not be initialized due to "Copying of type struct Rent.TenantReview memory[] memory to storage not yet supported")
		uint numReviews;
		mapping(uint => TenantReview) reviews;
		//  TenantReview[] reviews;
	}

	struct TenantReview {
		uint8 score;
		bytes32 hash;       // Used for verification
		bytes32 ipfsHash;   // Hash part of IPFS address text encrypted with tenant public key
	}

	// ------------------------ Apartments ------------------------
	struct Apartment {
		address ownerAddress;
		bytes32 ownerPublicKey_x;
		bytes32 ownerPublicKey_y;

		bytes32 ipfsHash;           // Hash part of IPFS address

		// Again, a dynamically sized array would be more elegant, but not supported by solidity compiler
		uint numReviews;
		mapping(uint => ApartmentReview) reviews;
		//ApartmentReview[] reviews;
	}

	struct ApartmentReview {
		address tenantAddress;
		uint8 score;        // Score 1-5
		bytes32 ipfsHash;   // Hash part of IPFS address
	}

	// ------------------------ Rentals ------------------------
	enum RentalStatus {
		Requested, Withdrawn, Accepted, Refused, Reviewed
	}
	enum DepositStatus {
		Open, // When no claim to the deposit has been made or is valid yet
		Pending, // When a deduction was requested
		Processed // When the deposit was processed => (partly) refunded / deduction transferred
	}
	enum DeductionStatus {
		Requested, // When a deduction has been requested, but the tenant hasn't responded
		Objected, // When the tenant has objected to the deduction
		Resolved // When the deduction has been resolved by mediation or timeout
	}

	struct DepositDeduction {
		uint16 lastChange;  // As a unix timestamp day
		uint128 amount;     // The requested deduction amount in finney

		bytes32 reasonIpfsHash;         // The reason for the deduction, as hash part of IPFS address, encrypted with tenant and mediator public key
		bytes32 objectionIpfsHash;      // Objection for the deduction created by tenant, encrypted with mediator public key
		bytes32 conclusionIpfsHash;     // The conclusion from the mediation determined by the mediator, encrypted with interaction and tenant public key

		DeductionStatus status; // Status for the deduction request
	}

	struct Rental {
		bytes32 interactionPublicKey_x; // X point for interaction public key used for private data exchange
		bytes32 interactionPublicKey_y; // Y point for interaction public key
		address interactionAddress;     // Address used by apartment owner for authentication

		bytes32 apartmentHash;                  // Hash of apartment + nonce to later prove apartment involved in rental

		bytes32 detailsIpfsHash;                // Hash part of IPFS address for rental details encrypted with interaction public key
		bytes32 detailsHash;                    // Hash of rental details to allow verifying forwarded rental details
		bytes32 detailsForMediatorIpfsHash;     // Hash part of IPFS address for rental details encrypted with mediator public key
		bytes32 contactDataIpfsHash;            // Hash part of IPFS address for owner contact details encrypted with tenant public key
		bytes32 contactDataForMediatorIpfsHash; // Hash part of IPFS address for owner contact details encrypted with mediator public key

		uint fee;           // Total fee for this rental in finney
		uint128 deposit;    // Deposit for this rental in finney

		address tenantAddress;             // The tenant profile address
		address mediatorAddress;           // The mediator determined for this rental (as soon as the rental is accepted)
		address ownerAddress;       // The addressed used for payments towards the apartment owner and after accept/refuse also as means of authentication

		RentalStatus status;                // Status for the rental
		DepositStatus depositStatus;        // Status of the deposit
	}

	// ------------------------------------------------------------
	// -------------- Conversion functions for enums --------------
	// ------------------------------------------------------------

	// Get the string representation for the rental status, lowercase
	function getRentalStatusString(RentalStatus status) private pure returns (string) {
		if (status == RentalStatus.Requested) {
			return "requested";
		}
		if (status == RentalStatus.Withdrawn) {
			return "withdrawn";
		}
		if (status == RentalStatus.Accepted) {
			return "accepted";
		}
		if (status == RentalStatus.Refused) {
			return "refused";
		}
		if (status == RentalStatus.Reviewed) {
			return "reviewed";
		}
	}

	// Get the string representation for the deduction status, lowercase
	function getDeductionStatusString(DeductionStatus status) private pure returns (string) {
		if (status == DeductionStatus.Requested) {
			return "requested";
		}
		if (status == DeductionStatus.Objected) {
			return "objected";
		}
		if (status == DeductionStatus.Resolved) {
			return "resolved";
		}
	}

	// Get the string representation for the deposit status, lowercase
	function getDepositStatusString(DepositStatus status) private pure returns (string) {
		if (status == DepositStatus.Open) {
			return "open";
		}
		if (status == DepositStatus.Pending) {
			return "pending";
		}
		if (status == DepositStatus.Processed) {
			return "processed";
		}
	}

	// ------------------------------------------------------------
	// ------------------------- Properties -----------------------
	// ------------------------------------------------------------
	mapping(address => Tenant) private tenants;
	mapping(bytes32 => mapping(bytes32 => bool)) private tenantPublicKeys; // Mapping to check whether a public key has been used in a tenant's profile

	address[] private mediators;                                           // List of mediators

	Apartment[] private apartments;                                        // List of apartments

	mapping(bytes32 => uint[]) private cityApartments;                     // Country+City SHA256 hash => apartment ids; to allow fetching apartments of a city
	mapping(address => uint[]) private ownerApartments;                    // Mapping to get the apartments of an owner and to check if the address has been used
	mapping(bytes32 => mapping(bytes32 => bool)) private ownerPublicKeys;  // Mapping to check whether a public key has been used in an apartment
	mapping(bytes32 => mapping(bytes32 => bool)) private interactionKeys;  // Mapping to check whether a public key has already been used in another interaction
	mapping(address => uint) private interactionAddressRental;             // Mapping to get the rental for a interaction address
	mapping(address => bool) private rentalAddresses;                      // Mapping to check if an address has already been used in an interaction and prevent it from other uses

	Rental[] private rentals;                                              // List of rentals

	mapping(uint => DepositDeduction) private depositDeductions;           // Deposit deductions for a rental (id => deduction)

	// ---------------------------------------------------------
	// ------------------------ Getters ------------------------
	// ---------------------------------------------------------

	// ----------------------- Addresses -----------------------
	// Check whether the address is known to the app, and retrieve user type
	function getAddressType() public view returns (string) {
		if (hasTenant()) {
			return "tenant";
		}
		if (ownsApartments()) {
			return "owner";
		}
		if (hasInteractionAddressRental(msg.sender)) {
			return "interaction";
		}
		if (rentalAddresses[msg.sender]) {
			return "rentalOwner";
		}

		return "unknown";
	}

	// ------------------------ Tenants ------------------------

	// Check whether a tenant for the address already exists
	function hasTenant() public view returns (bool) {
		return tenants[msg.sender].initialized;
	}

	// Get the tenant at the specified address
	function getTenant(address tenantAddr) public view returns (
		bytes32 publicKey_x,
		bytes32 publicKey_y,
		uint totalScore,
		uint numReviews
	) {
		// Check that the tenant exists
		require(tenants[tenantAddr].initialized);

		// Get the tenant from storage
		Tenant storage tenant = tenants[tenantAddr];

		// Assign the return variables
		publicKey_x = tenant.publicKey_x;
		publicKey_y = tenant.publicKey_y;
		totalScore = tenant.totalScore;
		numReviews = tenant.numReviews;
	}

	// Get the review for the tenant with the specified id
	function getTenantReview(address tenantAddr, uint reviewId) public view returns (
		uint8 score,
		bytes32 hash,
		bytes32 ipfsHash
	) {
		// Check that the tenant exists
		require(tenants[tenantAddr].initialized);

		// Check that the review exists
		require(tenants[tenantAddr].numReviews > reviewId);

		// Get the review from the tenant
		TenantReview storage review = tenants[tenantAddr].reviews[reviewId];

		// Assign the return variables
		score = review.score;
		hash = review.hash;
		ipfsHash = review.ipfsHash;
	}

	// ------------------------ Apartments ------------------------

	// Check whether the sender owns any apartments
	function ownsApartments() public view returns (bool) {
		return ownerApartments[msg.sender].length > 0;
	}

	// Get the number of all available apartments
	function getNumApartments() public view returns (uint) {
		return apartments.length;
	}

	// Get the apartment at the specified id
	function getApartment(uint apartmentId) public view returns (
		bytes32 ownerPublicKey_x,
		bytes32 ownerPublicKey_y,
		bytes32 ipfsHash,
		uint numReviews
	) {
		// Check that the apartment exists
		require(apartments.length > apartmentId);

		// Get the apartment from storage
		Apartment storage apartment = apartments[apartmentId];

		// Assign the return variables
		ownerPublicKey_x = apartment.ownerPublicKey_x;
		ownerPublicKey_y = apartment.ownerPublicKey_y;
		ipfsHash = apartment.ipfsHash;
		numReviews = apartment.numReviews;
	}

	// Get the number of apartments available in a city
	function getNumCityApartments(bytes32 cityHash) public view returns (uint) {
		return cityApartments[cityHash].length;
	}

	// Get a city apartment at the specified id
	function getCityApartment(bytes32 cityHash, uint cityApartmentId) public view returns (
		uint id,
		bytes32 ownerPublicKey_x,
		bytes32 ownerPublicKey_y,
		bytes32 ipfsHash,
		uint numReviews
	) {
		// Check that the apartment exists
		require(cityApartments[cityHash].length > cityApartmentId);

		id = cityApartments[cityHash][cityApartmentId];

		// Get the apartment from storage
		Apartment storage apartment = apartments[id];

		// Assign the return variables
		ownerPublicKey_x = apartment.ownerPublicKey_x;
		ownerPublicKey_y = apartment.ownerPublicKey_y;
		ipfsHash = apartment.ipfsHash;
		numReviews = apartment.numReviews;
	}

	// Get the number of apartments created by the owner
	function getNumOwnerApartments(address ownerAddr) public view returns (uint) {
		return ownerApartments[ownerAddr].length;
	}

	// Get the apartment of the owner with the specified id
	function getOwnerApartment(address ownerAddr, uint ownerApartmentId) public view returns (
		uint id,
		bytes32 ownerPublicKey_x,
		bytes32 ownerPublicKey_y,
		bytes32 ipfsHash,
		uint numReviews
	) {
		// Check that the apartment exists
		require(ownerApartments[ownerAddr].length > ownerApartmentId);

		id = ownerApartments[ownerAddr][ownerApartmentId];

		// Get the apartment from storage
		Apartment storage apartment = apartments[id];

		// Assign the return variables
		ownerPublicKey_x = apartment.ownerPublicKey_x;
		ownerPublicKey_y = apartment.ownerPublicKey_y;
		ipfsHash = apartment.ipfsHash;
		numReviews = apartment.numReviews;
	}

	// -------------------- Apartment reviews ------------------
	function getApartmentReview(uint apartmentId, uint reviewId) public view returns (
		address tenantAddress,
		uint8 score,
		bytes32 ipfsHash
	) {
		// Check that the apartment exists
		require(apartments.length > apartmentId);

		// Check that the review exists
		require(apartments[apartmentId].numReviews > reviewId);

		// Get the review from storage
		ApartmentReview storage review = apartments[apartmentId].reviews[reviewId];

		// Assign the return variables
		tenantAddress = review.tenantAddress;
		score = review.score;
		ipfsHash = review.ipfsHash;
	}


	// ------------------------ Rentals ------------------------

	// Get the number of rentals by the tenant
	function getNumTenantRentals(address tenantAddr) public view returns (uint) {
		// If the tenant doesn't exist, he also doesn't have rentals
		if (!tenants[tenantAddr].initialized) {
			return 0;
		}

		return tenants[tenantAddr].rentals.length;
	}

	// Get a tenant's rental with the specified id
	function getTenantRental(address tenantAddr, uint tenantRentalId) public view returns (
		uint id,
		address interactionAddress,
		address mediatorAddress,
		bytes32 interactionPublicKey_x,
		bytes32 interactionPublicKey_y,
		bytes32 apartmentHash,
		uint fee,
		uint deposit,
		string status,
		string depositStatus
	) {
		// Check that the tenant exists
		require(tenants[tenantAddr].initialized);

		// Check that the tenant's rental exists
		require(tenants[tenantAddr].rentals.length > tenantRentalId);

		id = tenants[tenantAddr].rentals[tenantRentalId];

		// Fetch the rental from the storage using the id
		Rental storage rental = rentals[id];

		// Assign the return variables
		interactionAddress = rental.interactionAddress;
		mediatorAddress = rental.mediatorAddress;
		interactionPublicKey_x = rental.interactionPublicKey_x;
		interactionPublicKey_y = rental.interactionPublicKey_y;
		apartmentHash = rental.apartmentHash;
		fee = rental.fee;
		deposit = rental.deposit;
		status = getRentalStatusString(rental.status);
		depositStatus = getDepositStatusString(rental.depositStatus);
	}

	// Check whether a rental exists for the interaction address
	function hasInteractionAddressRental(address interactionAddress) public view returns (bool) {
		return
		// If the mapping has a (not 0) value for the interaction address, we got a rental for it
		interactionAddressRental[interactionAddress] != 0 ||

		// Otherwise, check if we have rentals and the rental at id 0 has the same interactionAddress
		rentals.length != 0 &&
		rentals[0].interactionAddress == interactionAddress;
	}

	// Get the rental for the specified interaction address
	function getInteractionAddressRental(address addr) public view returns (
		uint id,
		address tenantAddress,
		address mediatorAddress,
		bytes32 interactionPublicKey_x,
		bytes32 interactionPublicKey_y,
		bytes32 apartmentHash,
		bytes32 detailsHash,
		bytes32 detailsIpfsHash,
		uint fee,
		uint deposit,
		string status,
		string depositStatus
	) {
		// Check that we have a rental for the interaction key
		require(hasInteractionAddressRental(addr));

		id = interactionAddressRental[addr];

		// Fetch the rental from the storage using the id
		Rental storage rental = rentals[id];

		// Assign the return variables
		interactionPublicKey_x = rental.interactionPublicKey_x;
		interactionPublicKey_y = rental.interactionPublicKey_y;
		mediatorAddress = rental.mediatorAddress;
		tenantAddress = rental.tenantAddress;
		apartmentHash = rental.apartmentHash;
		detailsHash = rental.detailsHash;
		detailsIpfsHash = rental.detailsIpfsHash;
		fee = rental.fee;
		deposit = rental.deposit;
		status = getRentalStatusString(rental.status);
		depositStatus = getDepositStatusString(rental.depositStatus);
	}

	// --------------------------------------------------------
	// ------------------------ Events ------------------------
	// --------------------------------------------------------
	event MediatorRegistered(address indexed tenantAddress);

	event ApartmentAdded(address indexed owner, uint apartmentId);

	event RentalRequested(address interactionAddress, uint rentalId);
	event RentalRequestWithdrawn(address interactionAddress, uint rentalId);

	event RentalRequestRefused(address indexed tenant, uint rentalId);
	event RentalRequestApproved(address indexed tenant, uint rentalId);

	event DepositRefunded(address indexed tenant, uint rentalId);
	event DeductionRequested(address indexed tenant, uint rentalId);

	event DeductionAccepted(address indexed interactionAddress, uint rentalId);
	event DeductionRefused(address indexed interactionAddress, address indexed mediatorAddress, uint rentalId);

	event DeductionMediated(address indexed tenant, address indexed interactionAddress, uint rentalId);

	event ApartmentReviewed(address indexed owner, uint apartmentId, uint rentalId);

	event Test(string title, string text);
	event TestAddr(string title, address addr);

	// ---------------------------------------------------------
	// ------------------------ Methods ------------------------
	// ---------------------------------------------------------

	// Add a new apartment
	function addApartment(
		bytes32 ownerPublicKey_x,
		bytes32 ownerPublicKey_y,
		bytes32 ipfsHash, // Hash part of IPFS address for apartment details
		bytes32 cityHash // Hash of city + country, used for searching
	) public {
		// Check that the owner isn't a tenant too
		require(!tenants[msg.sender].initialized);

		// Check that the ownerPublicKey does not match a tenant's public key
		require(!tenantPublicKeys[ownerPublicKey_x][ownerPublicKey_y]);

		// Check that the address has not been used in a rental
		require(!rentalAddresses[msg.sender]);

		// Add the apartment to the list of apartments
		apartments.push(Apartment(
				msg.sender,
				ownerPublicKey_x,
				ownerPublicKey_y,
				ipfsHash,
				0
			));

		// Add the apartment to the city's apartments
		cityApartments[cityHash].push(apartments.length - 1);

		// Add the apartment to the owner's apartments
		ownerApartments[msg.sender].push(apartments.length - 1);

		// Add the owner public key to the list of used public keys
		ownerPublicKeys[ownerPublicKey_x][ownerPublicKey_y] = true;

		// Emit an event for the added apartment
		emit ApartmentAdded(msg.sender, apartments.length - 1);
	}

	// ------------------------- Users -------------------------

	// Register as a mediator with the tenant's account associated with the sender.
	// Registration will fail if tenant is already mediator or doesn't have a sufficient score
	// (at least 5 reviews and a total review score of at least 4.0 is required)
	function registerMediator() public {
		// Check if the sender has a tenant account
		require(tenants[msg.sender].initialized);

		Tenant storage tenant = tenants[msg.sender];

		// Check that the tenant isn't a mediator yet (and hasn't been revoked mediator status yet)
		require(tenant.mediatorStatus == MediatorStatus.Unregistered);

		// Check that the tenant has at least 5 reviews with a score of at least 4.0
		require(tenant.numReviews > 4 && tenant.totalScore / tenant.numReviews >= 4);

		// Set the tenant as mediator and add him to the list of mediators
		tenant.mediatorStatus == MediatorStatus.Registered;
		mediators.push(msg.sender);

		// Emit a mediator registered event
		emit MediatorRegistered(msg.sender);
	}

	// Create a tenant with the specified publicKey
	function createTenant(
		address addr,
		bytes32 publicKey_x,
		bytes32 publicKey_y
	) private returns (Tenant) {
		// Check that the address has not been used by an owner or in an interaction
		require(ownerApartments[addr].length == 0);
		require(!rentalAddresses[addr]);

		// Check that the public key has not been used yet
		require(!tenantPublicKeys[publicKey_x][publicKey_y]);
		require(!ownerPublicKeys[publicKey_x][publicKey_y]);

		// Initialize empty arrays. This is necessary for struct members and for some reaon cannot be done in the constructor call
		uint[] memory tenantRentals;

		// Add a new tenant
		tenants[addr] = Tenant(
			true,
			publicKey_x,
			publicKey_y,
			MediatorStatus.Unregistered,
			0, // Initial score
			tenantRentals, // Rental ids
			0               // Number of reviews
		);

		// Set the public key as used tenant public key
		tenantPublicKeys[publicKey_x][publicKey_y] = true;
	}

	// ------------------------ Rentals ------------------------

	// Request a new rental as a tenant
	function requestRental(
		uint fee,
		uint128 deposit,
		bytes32 interactionKey_x, // Public key for encryption
		bytes32 interactionKey_y, // Public key for encryption
		address interactionAddress, // Address for authentication, NOT the owner/sender address (as this is unknown)
		bytes32 apartmentHash,
		bytes32 detailsIpfsHash,
		bytes32 detailsHash,
		bytes32 tenantPublicKey_x,
		bytes32 tenantPublicKey_y
	) public payable {
		// Check that the fee is not 0
		require(fee > 0);

		// Check if the transferred value matches the fee and deposit
		require(fee + deposit == Library.weiToFinney(msg.value));

		// Check that the interaction key does not match an existing key
		require(!tenantPublicKeys[interactionKey_x][interactionKey_y]);
		require(!ownerPublicKeys[interactionKey_x][interactionKey_y]);
		require(!interactionKeys[interactionKey_x][interactionKey_y]);

		// Check that the interaction address isn't empty
		require(interactionAddress != 0x0);

		// Check that the interactionAddress does not match a tenant's address
		require(!tenants[interactionAddress].initialized);

		// Check that the interactionAddress hasn't been used in a rental
		require(!hasInteractionAddressRental(interactionAddress));

		// Check that the interactionAddress isn't the current address
		require(interactionAddress != msg.sender);

		// Check that the interactionKey isn't the same as the tenantPublicKey
		require(interactionKey_x != tenantPublicKey_x || interactionKey_y != tenantPublicKey_y);

		// TODO: Also check it doesn't match owner address

		// Check if the tenant exists; create him otherwise
		if (!tenants[msg.sender].initialized) {
			createTenant(msg.sender, tenantPublicKey_x, tenantPublicKey_y);
		}

		// Add the rental
		rentals.push(Rental(
				interactionKey_x,
				interactionKey_y,
				interactionAddress,
				apartmentHash,
				detailsIpfsHash,
				detailsHash,
				0,
				0,
				0,
				fee,
				deposit,
				msg.sender,
				0x0,
				0x0,
				RentalStatus.Requested,
				DepositStatus.Open
			));

		// Add the rental in the tenant's profile
		tenants[msg.sender].rentals.push(rentals.length - 1);

		// Link the rental to the interaction key and address
		interactionKeys[interactionKey_x][interactionKey_y] = true;
		interactionAddressRental[interactionAddress] = rentals.length - 1;

		emit RentalRequested(interactionAddress, rentals.length - 1);
	}

	// Withdraw a rental request as a tenant
	function withdrawRentalRequest(
		uint rentalId
	) public {
		// Check that the rental exists
		require(rentals.length > rentalId && rentals[rentalId].fee != 0);

		Rental storage rental = rentals[rentalId];

		// Check authorization for the sender
		require(msg.sender == rental.tenantAddress);

		// Check that the rental is in the right state
		require(rental.status == RentalStatus.Requested);

		// Change the rental status
		rental.status = RentalStatus.Withdrawn;

		// Refund the fee + deposit
		msg.sender.transfer(
			Library.finneyToWei(rental.fee + rental.deposit)
		);

		// Emit an event to notify about the withdrawn rental request
		emit RentalRequestWithdrawn(rental.interactionAddress, rentalId);
	}

	// Refuse a rental request as an apartment owner.
	// Uses the supplied signature to authenticate against the rentals interaction public key.
	function refuseRental(
		uint rentalId,
		string signature // Signature for 'refuse:' + rentalId
	) public {
		// Check that the sender address has not been used yet
		require(!tenants[msg.sender].initialized);
		require(ownerApartments[msg.sender].length == 0);
		require(!rentalAddresses[msg.sender]);

		// Check that the rental exists
		require(rentals.length > rentalId);

		Rental storage rental = rentals[rentalId];

		// Check that the rental has the right state
		require(rental.status == RentalStatus.Requested);

		// Recover the expected signer address
		string memory message = "refuse:".toSlice().concat(Library.uintToString(rentalId).toSlice());
		address recovered = Verifier.verifyString(
			message,
			signature
		);

		// Check authorization of the owner
		require(recovered == rental.interactionAddress);

		// Change the rental's status
		rental.status = RentalStatus.Refused;

		// Mark the sender address as used in a rental
		rentalAddresses[msg.sender] = true;

		// Transfer fee and deposit back to the tenant
		rental.tenantAddress.transfer(Library.finneyToWei(rental.fee + rental.deposit));

		// Notify about the refused rental request
		emit RentalRequestRefused(rental.tenantAddress, rentalId);

		//emit TestAddr("Interaction address", rentals[0].interactionAddress);
		//emit Test("Concat", message);
		//emit Test("Signature", signature);
		//emit TestAddr("Recovered signer address", recovered);
	}

	// Accept a rental request.
	// Uses the supplied signature to authenticate against the rentals interaction public key.
	function acceptRental(
		uint rentalId,
		bytes32 contactDataIpfsHash,
		string signature  // Signature for 'accept:' + rentalId + contactDataIpfsHash + msg.sender address
	) public {
		// Check that the sender address has not been used yet
		require(!tenants[msg.sender].initialized);
		require(ownerApartments[msg.sender].length == 0);
		require(!rentalAddresses[msg.sender]);

		// Check that the rental exists
		require(rentals.length > rentalId);

		Rental storage rental = rentals[rentalId];

		// Check that the rental has the right state
		require(rental.status == RentalStatus.Requested);

		strings.slice[] memory parts = new strings.slice[](3);
		parts[0] = Library.uintToString(rentalId).toSlice();
		parts[1] = contactDataIpfsHash.toSliceB32();
		parts[2] = Library.addressToString(msg.sender).toSlice();

		// Recover the expected signer address
		string memory message = "accept:".toSlice().join(parts);
		address recovered = Verifier.verifyString(
			message,
			signature
		);

		// Check authorization of the owner
		require(recovered == rental.interactionAddress);

		// Change the rental's status
		rental.status = RentalStatus.Accepted;

		// Store the contact data
		rental.contactDataIpfsHash = contactDataIpfsHash;

		// Use the sender address as owner address
		rental.ownerAddress = msg.sender;

		// Mark the sender address as used in a rental
		rentalAddresses[msg.sender] = true;

		// Assign a random mediator for the case of a dispute
		rental.mediatorAddress = getRandomMediator();

		// Transfer the rental fee to the sender (= payment address)
		msg.sender.transfer(Library.finneyToWei(rental.fee));

		// Notify about the accepted rental request
		emit RentalRequestApproved(rental.tenantAddress, rentalId);
	}

	// Get a pseudo-random mediator
	function getRandomMediator() private view returns (address) {
		// If we don't have mediators, return an empty address
		if (mediators.length == 0) {
			return 0x0;
		}

		// If we only have one mediator, return him
		if (mediators.length == 1) {
			return mediators[0];
		}

		// Get the mediator based on a pseudo-random number generated using the block timestamp and difficulty
		return mediators[
		uint256(keccak256(bytes(
				Library.uintToString(block.timestamp).toSlice()
				.concat(Library.uintToString(block.difficulty).toSlice())
			))) % mediators.length
		];
	}

	// --------------------- Owner review ---------------------

	// End a rental as an apartment owner
	function endRental(
		uint rentalId,
		uint8 reviewScore,
		bytes32 reviewTextHash,
		bytes32 reviewTextIpfsHash,
		uint128 deductionAmount, // Requested deposit deduction; can be 0
		bytes32 deductionReasonIpfsHash, // Reason for deposit deduction; can be empty if no deduction requested
		bytes32 contactDataForMediatorIpfsHash // Contact data for the mediator
	) public {
		// Check that the rental exists
		require(rentals.length > rentalId);

		Rental storage rental = rentals[rentalId];
		Tenant storage tenant = tenants[rental.tenantAddress];

		// Check the score makes sense
		require(reviewScore < 6 && reviewScore > 0);

		// Check that the deduction amount (if specified) is smaller or equal to the deposit
		require(deductionAmount <= rental.deposit);

		// Check that the sender is the owner
		require(msg.sender == rental.ownerAddress);

		// Check that the rental has not ended yet => the deposit is still open
		require(rental.depositStatus == DepositStatus.Open);

		// Assign the review to the tenant
		TenantReview memory review = TenantReview(reviewScore, reviewTextHash, reviewTextIpfsHash);
		tenant.reviews[tenant.numReviews] = review;
		tenant.numReviews ++;

		// If no deduction was requested, we can directly transfer the deposit back to the tenant
		if (deductionAmount == 0) {
			rental.depositStatus = DepositStatus.Processed;

			rental.tenantAddress.transfer(rental.deposit);

			// Notify about the refund
			emit DepositRefunded(rental.tenantAddress, rentalId);

			return;
		}

		// If we don't have any mediators, grant half of the deduction and transfer the rest back to the tenant.
		// This should rarely ever be the case, so we also don't emit events.
		if (mediators.length == 0) {
			uint128 grantedDeduction = deductionAmount / 2;
			rental.ownerAddress.transfer(grantedDeduction);
			rental.tenantAddress.transfer(rental.deposit - grantedDeduction);

			return;
		}

		// Otherwise, create a deposit deduction and it add to the rental
		DepositDeduction memory depositDeduction = DepositDeduction(
			uint16(block.timestamp / 86400),
			deductionAmount,
			deductionReasonIpfsHash,
			0,
			0,
			DeductionStatus.Requested
		);
		depositDeductions[rentalId] = depositDeduction;
		rental.depositStatus = DepositStatus.Pending;

		// Add the contact data ipfs hash for the mediator to the rental
		rental.contactDataForMediatorIpfsHash = contactDataForMediatorIpfsHash;

		// Notify about the requested deduction
		emit DeductionRequested(rental.tenantAddress, rentalId);
	}

	// ---------------------- Deductions ----------------------

	// Accept the requested deduction as a tenant
	function acceptDeduction(
		uint rentalId
	) public {
		require(rentals.length > rentalId);

		Rental storage rental = rentals[rentalId];

		// Only allow accepting deductions from the tenant
		require(msg.sender == rental.tenantAddress);

		// Only allow accepting the deduction if the depositStatus and the deduction status match
		require(rental.depositStatus == DepositStatus.Pending);
		require(depositDeductions[rentalId].status == DeductionStatus.Requested);

		// Change the status
		rental.depositStatus = DepositStatus.Processed;
		depositDeductions[rentalId].status = DeductionStatus.Resolved;

		// Transfer the deducted amount to the owner and the rest to the tenant
		rental.ownerAddress.transfer(Library.finneyToWei(depositDeductions[rentalId].amount));
		rental.tenantAddress.transfer(Library.finneyToWei(rental.deposit - depositDeductions[rentalId].amount));

		// Delete the deposit deduction
		delete depositDeductions[rentalId];

		// Notify about the accepted deduction
		emit DeductionAccepted(rental.interactionAddress, rentalId);
	}

	// Object to the requested deduction as a tenant
	function refuseDeduction(
		uint rentalId,
		bytes32 objectionIpfsHash,
		bytes32 detailsForMediatorIpfsHash // Rental details for mediator, encrypted with mediator public key
	) public {
		require(rentals.length > rentalId);

		Rental storage rental = rentals[rentalId];

		// Only allow objections from the tenant
		require(msg.sender == rental.tenantAddress);

		// Only allow objections if the depositStatus and the deduction status match
		require(rental.depositStatus == DepositStatus.Pending);
		require(depositDeductions[rentalId].status == DeductionStatus.Requested);

		// Add the rental details for the mediator to the rental
		rental.detailsForMediatorIpfsHash = detailsForMediatorIpfsHash;

		// Change the status and add the objection
		depositDeductions[rentalId].status = DeductionStatus.Objected;
		depositDeductions[rentalId].objectionIpfsHash = objectionIpfsHash;

		// Update the lastChange day
		depositDeductions[rentalId].lastChange = uint16(block.timestamp / 86400);

		// Notify about the refused deduction request
		emit DeductionRefused(rental.interactionAddress, rental.mediatorAddress, rentalId);
	}

	// Mediate in a deduction request dispute
	function mediate(
		uint rentalId,
		uint128 deductionAmount,
		bytes32 conclusionIpfsHash // Conclusion encrypted with tenant and interaction public key
	) public {
		// Check that the rental exists
		require(rentals.length > rentalId);

		Rental storage rental = rentals[rentalId];

		// Check that the sender is assigned to the rental as mediator
		rental.mediatorAddress = msg.sender;

		// Check that the rental requires mediation
		require(rental.depositStatus == DepositStatus.Pending);
		require(depositDeductions[rentalId].status == DeductionStatus.Objected);

		// Check that the determined deductionAmount is smaller or equal to the deposit + mediatorFee
		require(rental.deposit >= deductionAmount + mediatorFee);

		// Set the deduction to resolved and the deposit to processed
		depositDeductions[rentalId].status = DeductionStatus.Resolved;
		depositDeductions[rentalId].conclusionIpfsHash = conclusionIpfsHash;
		rental.depositStatus = DepositStatus.Processed;

		// Transfer the mediatorFee to the mediator, the deduction to the owner and the rest to the tenant
		msg.sender.transfer(Library.finneyToWei(mediatorFee));
		rental.ownerAddress.transfer(Library.finneyToWei(deductionAmount));
		rental.tenantAddress.transfer(Library.finneyToWei(rental.deposit - deductionAmount - mediatorFee));

		// Notify about the mediation
		emit DeductionMediated(rental.tenantAddress, rental.interactionAddress, rentalId);
	}

	// -------------------- Tenant review --------------------

	// Review an apartment, revealing the rented apartment in the process
	function review(
		uint rentalId,
		uint apartmentId,
		uint nonce, // Nonce involved in created apartmentHash
		uint8 score,
		bytes32 textIpfsHash // Hash of unencrypted review
	) public {
		// Check that the rental and apartment exist
		require(rentals.length > rentalId);
		require(apartments.length > apartmentId);

		Rental storage rental = rentals[rentalId];
		Apartment storage apartment = apartments[apartmentId];

		// Check that the sender is the tenant
		rental.tenantAddress = msg.sender;

		// Check that the rental has not been reviewed yet
		require(rental.status == RentalStatus.Accepted);

		// Check authorization: rentals apartment hash has match the sha3 of apartmentId + "-" + nonce
		strings.slice[] memory parts = new strings.slice[](2);
		parts[0] = "-".toSlice();
		parts[1] = Library.uintToString(nonce).toSlice();

		require(rental.apartmentHash == keccak256(bytes(
				Library.uintToString(nonce).toSlice().join(parts)
			)));

		// Change the rental status to reviewed
		rental.status = RentalStatus.Reviewed;

		// Add the review
		ApartmentReview memory apartmentReview = ApartmentReview(
			msg.sender,
			score,
			textIpfsHash
		);

		apartment.reviews[apartment.numReviews] = apartmentReview;
		apartment.numReviews ++;

		// Notify about the review
		emit ApartmentReviewed(apartment.ownerAddress, apartmentId, rentalId);
	}
}
