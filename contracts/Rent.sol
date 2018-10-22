pragma solidity ^0.4.25;

import "./Library.sol";

contract Rent {
    uint8 constant mediatorFee = 25; // In Finney (1/1000 eth)

    // -------------------------------------------------------------
    // ------------------------ Definitions ------------------------
    // -------------------------------------------------------------

    // ------------------------ Tenants ------------------------
    struct Tenant {
        bytes32 publicKey;

        uint totalScore;    // Total score in sum of all rating points. The average score has to be determined totalScore / reviews.length
        uint[] rentals;     // Ids of the rentals (array indices)

        TenantReview[] reviews;
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

        ApartmentReview[] apartmentReviews;
    }

    struct ApartmentReview {
        uint8 score;        // Score 1-5
        bytes32 ipfsHash;   // Hash part of IPFS address
    }

    // ------------------------ Rentals ------------------------
    enum RentalStatus {
        Requested, Withdrawn, Accepted
    }
    enum DeductionStatus {
        Requested, Objected, Resolved
    }
    enum DepositStatus {
        Open, // When no claim to the deposit has been made or is valid yet
        Pending, // When a deduction was requested
        Processed // When the deposit was processed => (partly) refunded / deduction transferred
    }

    struct DepositDeduction {
        uint rental;        // The rental for this deposit deduction
        uint16 lastChange;  // As a unix timestamp day
        uint128 amount;     // The requested deduction amount in finney

        bytes32 reasonIpfsHash;         // The reason for the deduction, as hash part of IPFS address, encrypted with tenant and mediator public key
        bytes32 objectionIpfsHash;      // Objection for the deduction created by tenant, encrypted with mediator public key
        bytes32 conclusionIpfsHash;     // The conclusion from the mediation determined by the mediator, encrypted with interaction and tenant public key

        DeductionStatus status; // Status for the deduction request
    }

    struct Rental {
        bytes32 interactionPublicKey;       // Public key used by apartment owner for authentication

        bytes32 detailsIpfsHash;            // Hash part of IPFS address for rental details encrypted with interaction public key
        bytes32 detailsHash;                // Hash of rental details to allow verifying forwarded rental details
        bytes32 detailsForMediatorIpfsHash; // Hash of rental details encrypted with mediator public key

        uint fee;           // Total fee for this rental in finney
        uint128 deposit;    // Deposit for this rental in finney

        address tenant;     // The tenant profile address
        address mediator;   // The mediator determined for this rental (as soon as the rental is accepted)

        RentalStatus status;            // Status for the rental
        DepositStatus depositStatus;    // Status of the deposit
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
    mapping(address => Tenant) tenants;
    mapping(byte32 => bool) tenantPublicKeys;       // Mapping to check whether a public key has been used in a tenant's profile

    Apartment[] apartments;

    mapping(bytes32 => uint[]) cityApartments;      // Country+City SHA256 hash => apartment ids; to allow fetching apartments of a city
    mapping(address => uint[]) ownerApartments;     // Mapping to get the apartments of an owner
    mapping(byte32 => bool) ownerPublicKeys;        // Mapping to check whether a public key has been used in an apartment
    mapping(byte32 => uint) interactionKeyRentals;  // Mapping to get the rental for a interaction public key and to check whether a key has already been used

    Rental[] rentals;
    DepositDeduction[] depositDeductions;

    // ---------------------------------------------------------
    // ------------------------ Getters ------------------------
    // ---------------------------------------------------------

    // ------------------------ Tenants ------------------------

    // Get the tenant at the specified address
    function getTenant(address tenantAddr) public view returns (bytes32 publicKey, uint totalScore, uint numReviews) {
        // Check that the tenant exists
        require(tenants[tenantAddr].publicKey != 0);

        // Get the tenant from storage
        Tenant tenant = tenants[tenantAddr];

        // Assign the return variables
        publicKey = tenant.publicKey;
        totalScore = tenant.totalScore;
        numReviews = tenant.reviews.length;
    }

    // Get the review for the tenant with the specified id
    function getTenantReview(address tenantAddr, uint reviewId) public view returns (
        uint8 score,
        bytes32 hash,
        bytes32 ipfsHash
    ) {
        // Check that the tenant exists
        require(tenants[addr].publicKey != 0);

        // Check that the review exists
        require(tenants[addr].reviews.length > reviewId);

        // Get the review from the tenant
        TenantReview review = tenants[addr].reviews[reviewId];

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

        ownerPublicKey = apartments[apartmentId].ownerPublicKey;
        ipfsHash = apartments[apartmentId].ipfsHash;
        numReviews = apartments[apartmentId].reviews.length;
    }

    // Get the number of apartments available in a city
    function getNumCityApartments(bytes32 cityHash) public view returns (uint) {
        if (cityApartments[cityHash] == 0) {
            return 0;
        }

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
        numReviews = apartment.reviews.length;
    }

    // Get the number of apartments created by the owner
    function getNumOwnerApartments(address ownerAddr) public view returns (uint) {
        if (ownerApartments[ownerAddr] == 0) {
            return 0;
        }

        return ownerApartments[ownerAddr].length;
    }

    // Get the apartment of the owner with the specified id
    function getOwnerApartment(address ownerAddr, uint ownerApartmentId) public view returns (
        uint id,
        bytes32 ownerPublicKey,
        bytes32 ipfsHash,
        uint numReviews
    ) {
        // Check that the owner exists
        require(ownerApartments[ownerAddr] != 0);

        // Check that the apartment exists
        require(ownerApartments[ownerAddr].length > ownerApartmentId);

        id = ownerApartments[ownerAddr][apartmentId];

        // Get the apartment from storage
        Apartment storage apartment = apartments[id];

        // Assign the return variables
        ownerPublicKey = apartment.ownerPublicKey;
        ipfsHash = apartment.ipfsHash;
        numReviews = apartment.reviews.length;
    }

    // -------------------- Apartment reviews ------------------
    function getApartmentReview(uint apartmentId, uint reviewId) public view returns (
        uint8 score,
        bytes32 ipfsHash
    ) {
        // Check that the apartment exists
        require(apartments.length > apartmentId);

        // Check that the review exists
        require(apartments[apartmentId].reviews[reviewId].length > reviewId);

        // Get the review from storage
        ApartmentReview review = apartments[apartmentId].reviews[reviewId];

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
        require(tenants[tenantAddr].publicKey != 0);

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
        // If the mapping has a (not 0) value for the interaction get, we got a rental for it
        interactionKeyRentals[key] != 0 ||

        // Otherwise, check if we have rentals and the rental at id 0 has the key as interactionPublicKey
        rentals.length != 0 &&
        rentals[0].interactionPublicKey == key;
    }

    // Get the rental for the specified interaction public key
    function getInteractionKeyRental(bytes32 key) public view returns (uint) {
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


    // ---------------------------------------------------------
    // ------------------------ Methods ------------------------
    // ---------------------------------------------------------
}
