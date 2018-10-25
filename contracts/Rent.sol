pragma solidity ^0.4.24;

import "./Library.sol";
import "./strings/src/strings.sol";
import "./Verifier.sol";

contract Rent {
	using strings for *;

	uint8 constant mediatorFee = 25; // In Finney (1/1000 eth)

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
		bytes32 publicKey;

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
		address owner;
		bytes32 ownerPublicKey;

		bytes32 ipfsHash;   // Hash part of IPFS address

		// Again, a dynamically sized array would be more elegant, but not supported by solidity compiler
		uint numReviews;
		mapping(uint => ApartmentReview) reviews;
		//ApartmentReview[] reviews;
	}

	struct ApartmentReview {
		uint8 score;        // Score 1-5
		bytes32 ipfsHash;   // Hash part of IPFS address
	}

	// ------------------------ Rentals ------------------------
	enum RentalStatus {
		Requested, Accepted, Reviewed
	}
	enum DepositStatus {
		Open, // When no claim to the deposit has been made or is valid yet
		Pending, // When a deduction was requested
		Processed // When the deposit was processed => (partly) refunded / deduction transferred
	}
	enum DeductionStatus {
		None, // When no deduction has been requested
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
		bytes32 interactionPublicKey;   // Public key used for private data exchange
		address interactionAddress;     // Address used by apartment owner for authentication

		bytes32 apartmentHash;          // Hash of apartment + nonce to later prove apartment involved in rental

		bytes32 detailsIpfsHash;                // Hash part of IPFS address for rental details encrypted with interaction public key
		bytes32 detailsHash;                    // Hash of rental details to allow verifying forwarded rental details
		bytes32 detailsForMediatorIpfsHash;     // Hash part of IPFS address for rental details encrypted with mediator public key
		bytes32 contactDataIpfsHash;            // Hash part of IPFS address for owner contact details encrypted with tenant public key
		bytes32 contactDataForMediatorIpfsHash; // Hash part of IPFS address for owner contact details encrypted with mediator public key

		uint fee;           // Total fee for this rental in finney
		uint128 deposit;    // Deposit for this rental in finney

		address tenant;     // The tenant profile address
		address mediator;   // The mediator determined for this rental (as soon as the rental is accepted)

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
		if (status == RentalStatus.Accepted) {
			return "accepted";
		}
		if (status == RentalStatus.Reviewed) {
			return "reviewed";
		}
	}

	// Get the string representation for the deduction status, lowercase
	function getDeductionStatusString(DeductionStatus status) private pure returns (string) {
		if (status == DeductionStatus.None) {
			return "none";
		}
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
	mapping(bytes32 => bool) private tenantPublicKeys;              // Mapping to check whether a public key has been used in a tenant's profile

	address[] private mediators;                                    // List of mediators

	Apartment[] private apartments;                                 // List of apartments

	mapping(bytes32 => uint[]) private cityApartments;              // Country+City SHA256 hash => apartment ids; to allow fetching apartments of a city
	mapping(address => uint[]) private ownerApartments;             // Mapping to get the apartments of an owner
	mapping(bytes32 => bool) private ownerPublicKeys;               // Mapping to check whether a public key has been used in an apartment
	mapping(bytes32 => uint) private interactionKeyRentals;         // Mapping to get the rental for a interaction public key and to check whether a key has already been used

	Rental[] private rentals;                                       // List of rentals

	mapping(uint => DepositDeduction) private depositDeductions;    // Deposit deductions for a rental (id => deduction)

	// ---------------------------------------------------------
	// ------------------------ Getters ------------------------
	// ---------------------------------------------------------

	// ------------------------ Tenants ------------------------

	// Get the tenant at the specified address
	function getTenant(address tenantAddr) public view returns (bytes32 publicKey, uint totalScore, uint numReviews) {
		// Check that the tenant exists
		require(tenants[tenantAddr].initialized);

		// Get the tenant from storage
		Tenant storage tenant = tenants[tenantAddr];

		// Assign the return variables
		publicKey = tenant.publicKey;
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
	// Get the number of all available apartments
	function getNumApartments() public view returns (uint) {
		return apartments.length;
	}

	// Get the apartment at the specified id
	function getApartment(uint apartmentId) public view returns (
		bytes32 ownerPublicKey,
		bytes32 ipfsHash,
		uint numReviews
	) {
		// Check that the apartment exists
		require(apartments.length > apartmentId);

		// Get the apartment from storage
		Apartment storage apartment = apartments[apartmentId];

		// Assign the return variables
		ownerPublicKey = apartment.ownerPublicKey;
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
		bytes32 ownerPublicKey,
		bytes32 ipfsHash,
		uint numReviews
	) {
		// Check that the apartment exists
		require(cityApartments[cityHash].length > cityApartmentId);

		id = cityApartments[cityHash][cityApartmentId];

		// Get the apartment from storage
		Apartment storage apartment = apartments[id];

		// Assign the return variables
		ownerPublicKey = apartment.ownerPublicKey;
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
		bytes32 ownerPublicKey,
		bytes32 ipfsHash,
		uint numReviews
	) {
		// Check that the apartment exists
		require(ownerApartments[ownerAddr].length > ownerApartmentId);

		id = ownerApartments[ownerAddr][ownerApartmentId];

		// Get the apartment from storage
		Apartment storage apartment = apartments[id];

		// Assign the return variables
		ownerPublicKey = apartment.ownerPublicKey;
		ipfsHash = apartment.ipfsHash;
		numReviews = apartment.numReviews;
	}

	// -------------------- Apartment reviews ------------------
	function getApartmentReview(uint apartmentId, uint reviewId) public view returns (
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
		score = review.score;
		ipfsHash = review.ipfsHash;
	}


	// ------------------------ Rentals ------------------------

	// Get the number of rentals by the tenant
	function getNumTenantRentals(address tenantAddr) public view returns (uint) {
		// Check that the tenant exists
		require(tenants[tenantAddr].publicKey != 0);

		return tenants[tenantAddr].rentals.length;
	}

	// Get a tenant's rental with the specified id
	function getTenantRental(address tenantAddr, uint tenantRentalId) public view returns (
		uint id,
		bytes32 interactionPublicKey,
		bytes32 detailsIpfsHash,
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
		interactionPublicKey = rental.interactionPublicKey;
		detailsIpfsHash = rental.detailsIpfsHash;
		fee = rental.fee;
		deposit = rental.deposit;
		status = getRentalStatusString(rental.status);
		depositStatus = getDepositStatusString(rental.depositStatus);
	}

	// Check whether a rental exists for the interaction public key
	function hasInteractionKeyRental(bytes32 key) public view returns (bool) {
		return
		// If the mapping has a (not 0) value for the interaction key, we got a rental for it
		interactionKeyRentals[key] != 0 ||

		// Otherwise, check if we have rentals and the rental at id 0 has the key as interactionPublicKey
		rentals.length != 0 &&
		rentals[0].interactionPublicKey == key;
	}

	// Get the rental for the specified interaction public key
	function getInteractionKeyRental(bytes32 key) public view returns (
		uint id,
		bytes32 interactionPublicKey,
		bytes32 detailsIpfsHash,
		uint fee,
		uint deposit,
		string status,
		string depositStatus
	) {
		// Check that we have a rental for the interaction key
		require(hasInteractionKeyRental(key));

		id = interactionKeyRentals[key];

		// Fetch the rental from the storage using the id
		Rental storage rental = rentals[id];

		// Assign the return variables
		interactionPublicKey = rental.interactionPublicKey;
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

	event RentalRequested(address indexed tenant, bytes32 indexed interactionKey, uint rentalId);
	event RentalRequestWithdrawn(address indexed tenant, bytes32 indexed interactionKey, uint rentalId);
	event RentalRequestApproved(address indexed tenant, bytes32 indexed interactionKey, uint rentalId);
	event RentalRequestRefused(address indexed tenant, bytes32 indexed interactionKey, uint rentalId);

	event DeductionRequested(address indexed tenant, bytes32 indexed interactionKey, uint rentalId);
	event DeductionAccepted(address indexed tenant, bytes32 indexed interactionKey, uint rentalId);
	event DeductionRefused(address indexed tenant, bytes32 indexed interactionKey, uint rentalId);

	event DeductionMediated(address indexed tenant, bytes32 indexed interactionKey, uint rentalId);

	event TenantReviewCreated(address indexed tenant, uint rentalId);
	event ApartmentReviewCreated(address indexed tenant, address indexed owner, uint apartmentId, uint rentalId);

	event Test(string title, string text);
	event TestAddr(string title, address addr);

	// ---------------------------------------------------------
	// ------------------------ Methods ------------------------
	// ---------------------------------------------------------

	// Add a new apartment
	function addApartment(
		bytes32 ownerPublicKey,
		bytes32 ipfsHash, // Hash part of IPFS address for apartment details
		bytes32 cityHash // Hash of city + country, used for searching
	) public {
		// Check that the owner isn't a tenant too
		require(!tenants[msg.sender].initialized);

		// Check that the ownerPublicKey does not match a tenant's public key
		require(!tenantPublicKeys[ownerPublicKey]);

		// Add the apartment to the list of apartments
		apartments.push(Apartment(
				msg.sender,
				ownerPublicKey,
				ipfsHash,
				0
			));

		// Add the apartment to the city's apartments
		cityApartments[cityHash].push(apartments.length - 1);

		// Add the apartment to the owner's apartments
		ownerApartments[msg.sender].push(apartments.length - 1);
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
	function createTenant(address addr, bytes32 publicKey) private returns (Tenant) {
		// Check that the public key is not empty
		// TODO: Can't be done like this is fixed size byte array is always length 32
		//require(publicKey.length > 0);

		// Check that the public key has not been used yet
		require(!tenantPublicKeys[publicKey]);
		require(!ownerPublicKeys[publicKey]);

		// Initialize empty arrays. This is necessary for struct members and for some reaon cannot be done in the constructor call
		uint[] memory tenantRentals;

		// Add a new tenant
		tenants[addr] = Tenant(
			true,
			publicKey,
			MediatorStatus.Unregistered,
			0, // Initial score
			tenantRentals, // Rental ids
			0               // Number of reviews
		);

		// Set the public key as used tenant public key
		tenantPublicKeys[publicKey] = true;
	}

	// ------------------------ Rentals ------------------------

	// Request a new rental as a tenant
	function requestRental(
		uint fee,
		uint128 deposit,
		bytes32 interactionKey,
		address interactionAddress,
		bytes32 apartmentHash,
		bytes32 detailsIpfsHash,
		bytes32 detailsHash,
		bytes32 tenantPublicKey
	) public payable {
		// Check that the fee is not 0
		require(fee > 0);

		// Check if the transferred value matches the fee and deposit
		require(fee + deposit == Library.weiToFinney(msg.value));

		// Check that the interaction key does not match an owner or tenant key
		require(!tenantPublicKeys[interactionKey]);
		require(!ownerPublicKeys[interactionKey]);

		// Check that the interaction address is not empty and does not match a tenant address
		// TODO: Also check it doesn't match owner address
		require(interactionAddress != 0x0);
		require(!tenants[interactionAddress].initialized);

		// Check if the tenant exists; create him otherwise
		if (!tenants[msg.sender].initialized) {
			createTenant(msg.sender, tenantPublicKey);
		}

		// Construct empty deposit deduction as this is

		// Add the rental
		rentals.push(Rental(
				interactionKey,
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
				RentalStatus.Requested,
				DepositStatus.Open
			));
	}

	// Withdraw a rental request as a tenant
	function withdrawRentalRequest(
		uint rentalId
	) public {
		// Check that the rental exists
		require(rentals.length > rentalId && rentals[rentalId].fee != 0);

		Rental storage rental = rentals[rentalId];

		// Check authorization for the sender
		require(msg.sender == rental.tenant);

		// Refund the fee + deposit
		msg.sender.transfer(
			Library.finneyToWei(rental.fee + rental.deposit)
		);

		// Emit an event to notify about the withdrawn rental request
		emit RentalRequestWithdrawn(rental.tenant, rental.interactionPublicKey, rentalId);

		// Delete the rental
		delete rentals[rentalId];
	}

	// Refuse a rental request as an apartment owner.
	// Uses the supplied signature to authenticate against the rentals interaction public key.
	function refuseRental(
		uint rentalId,
		string signature, // Signature for 'refuse:' + rentalId

		bytes32 publicKey_x, // Test
		bytes32 publicKey_y // Test
	) public {
		string memory message = "refuse:".toSlice().concat(Library.uintToString(rentalId).toSlice());

		address recovered = Verifier.verifyString(
			message,
			signature
		);

		emit Test("Concat", message);
		emit Test("Signature", signature);
		emit TestAddr("Recovered signer address", recovered);
	}

	// Accept a rental request.
	// Uses the supplied signature to authenticate against the rentals interaction public key.
	function acceptRental(
		uint rentalId,
		bytes32 contactDataIpfsHash,
		string signature  // Signature for 'accept:' + rentalId + contactDataIpfsHash
	) public {

	}

	// --------------------- Owner review ---------------------

	// End a rental as an apartment owner.
	// Uses the supplied signature to authenticate against the rentals interaction public key.
	function endRental(
		uint rentalId,
		uint8 reviewScore,
		bytes32 reviewTextIpfsHash,
		uint128 deductionAmount, // Requested deposit deduction; can be 0
		bytes32 deductionReasonIpfsHash, // Reason for deposit deduction; can be empty if no deduction requested
		bytes32 contactDetailsIpfsHash, // Contact details for the mediator
		string signature // Signature for the above
	) public {

	}

	// ---------------------- Deductions ----------------------

	// Accept the requested deduction as a tenant
	function acceptDeduction(
		uint rentalId
	) public {

	}

	// Object to the requested deduction as a tenant
	function refuseDeduction(
		uint rentalId,
		bytes32 objectionIpfsHash,
		bytes32 rentalDetailsIpfsHash // Rental details for mediator, encrypted with mediator public key
	) public {

	}

	// Mediate in a deduction request dispute
	function mediate(
		uint rentalId,
		uint128 deductionAmount,
		bytes32 conclusionIpfsHash // Conclusion encrypted with tenant and interaction public key
	) {

	}

	// -------------------- Tenant review --------------------

	// Review an apartment, revealing the rented apartment in the process
	function review(
		uint rentalId,
		uint apartmentId,
		uint nonce, // Nonce involved in created apartmentHash
		uint8 score,
		bytes32 textIpfsHash // Hash of unencrypted review
	) {

	}
}
