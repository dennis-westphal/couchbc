pragma solidity ^0.4.24;

import "./Library.sol";

contract Rent {
    uint constant creditConversionFactor = 500000000000000;
    uint8 constant mediatorFee = 5;

    struct Address {
        string street;
        string zipCode;
        string city;
        string country;
        string phone;
    }

    struct Rating {
        uint8 score;
        string text;
    }

    struct User {
        address addr;

        bool mediator;

        string name;

        // Keeping same data types together for struct tightly packing
        uint physicalAddress;
        uint balance;
        uint totalScore;

        uint[] apartments;
        uint[] rentals;
        uint[] ratings;
    }

    struct Apartment {
        bool disabled;

        address owner;

        string title;
        string primaryImage; // as IPFS hash
        string[] images; // as IPFS hashes

        uint physicalAddress;
        uint128 pricePerNight;
        uint128 deposit;

        uint[] rentals;
        uint[] ratings;
    }

    enum DeductionStatus {
        Requested,
        Objected,
        Resolved
    }

    struct DepositDeduction {
        uint rental;
        uint16 lastChange; // As a unix timestamp day
        uint128 amount;

        string reason;
        string objection;
        string conclusion;

        address mediator;

        DeductionStatus status;
    }

    enum DepositStatus {
        Open, // When no claim to the deposit has been made or is valid yet
        Pending, // When a deduction was requested
        Claimable, // When the deposit was refunded, but the tenant has not rated yet
        Processed // When the deposit was processed (possibly refunded)
    }
    struct Rental {
        uint apartment;

        uint16 fromDay; // Day as floor(unix timestamp / (60*60*24 = 86400))
        uint16 tillDay;
        uint128 deposit;
        uint price;

        address tenant;

        bool ownerRated; // When rating + deposit status have been determined
        bool tenantRated; // When rated

        DepositStatus depositStatus;
        DepositDeduction depositDeduction;
    }

    mapping(address => User) users;
    address[] public mediators;

    Address[] addresses;
    Apartment[] public apartments;
    Rental[] rentals;
    Rating[] ratings;

    event Registered(address indexed userAddress);

    event ApartmentAdded(address indexed userAddress, uint apartmentId);
    event ApartmentEnabled(address indexed userAddress, uint apartmentId);
    event ApartmentDisabled(address indexed userAddress, uint apartmentId);

    event PrimaryImageChanged(address indexed userAddress, uint apartmentId, string image);
    event ImageAdded(address indexed userAddress, uint apartmentId, string image);
    event ImageRemoved(address indexed userAddress, uint apartmentId, uint imageId);

    event Rented(address indexed userAddress, address indexed ownerAddress, uint apartmentId, uint rentalId);

    event Transferred(address indexed userAddress, uint newBalance);
    event Paidout(address indexed userAddress, uint newBalance);

    function isRegistered() public view returns (bool) {
        return users[msg.sender].addr != 0;
    }

    function getPhysicalAddress(uint addressIndex) public view returns (
        uint id,
        string street,
        string zipCode,
        string city,
        string country,
        string phone) {
        require(addresses.length > addressIndex);

        id = addressIndex;
        street = addresses[addressIndex].street;
        zipCode = addresses[addressIndex].zipCode;
        city = addresses[addressIndex].city;
        country = addresses[addressIndex].country;
        phone = addresses[addressIndex].phone;
    }

    function getUser(address userAddr) public view returns (
        address addr,
        bool mediator,
        string name,
        uint physicalAddressId,
        uint balance,
        uint numApartments,
        uint numRentals,
        uint numRatings
    ) {
        require(users[userAddr].addr != 0);

        addr = userAddr;
        mediator = users[userAddr].meditator;
        name = users[userAddr].name;
        physicalAddressId = users[userAddr].physicalAddress;
        balance = users[userAddr].balance;
        numApartments = users[userAddr].apartments.length;
        numRentals = users[userAddr].rentals.length;
        numRatings = users[userAddr].ratings.length;
    }

    function getUserApartment(address userAddr, uint userApartmentIndex) public view returns (
        uint id,
        bool disabled,
        address owner,
        string title,
        string primaryImage,
        uint numImages,
        uint physicalAddress,
        uint128 pricePerNight,
        uint128 deposit) {
        require(users[userAddr].addr != 0);
        require(users[userAddr].apartments.length > userApartmentIndex);

        id = users[userAddr].apartments[userApartmentIndex];
        disabled = apartments[id].disabled;
        owner = apartments[id].owner;
        title = apartments[id].title;
        primaryImage = apartments[id].primaryImage;
        numImages = apartments[id].images.length;
        physicalAddress = apartments[id].physicalAddress;
        pricePerNight = apartments[id].pricePerNight;
        deposit = apartments[id].deposit;
    }

    function getUserRental(address userAddr, uint userRentalIndex) public view returns (
        uint apartmentId,
        uint rentalId,
        uint16 fromDay,
        uint16 tillDay,
        uint128 deposit,
        bool depositClaimable
    ) {
        require(users[userAddr].addr != 0);
        require(users[userAddr].rentals.length > userRentalIndex);

        rentalId = users[userId].rentals[userRentalIndex];
        apartmentId = rentals[rentalId].apartment;
        fromDay = rentals[rentalId].fromDay;
        tillDay = rentals[rentalId].tillDay;
        deposit = rentals[rentalId].deposit;
        depositClaimable = rentals[rentalId].depositClaimable;
    }

    function getUserRating(address userAddr, uint userRatingId) public view returns (
        uint8 score,
        string text
    ) {
        require(users[userAddr].addr != 0);
        require(users[userAddr].ratings.length > userRatingId);

        id = users[userId].ratings[userRatingId];
        score = ratings[id].score;
        text = ratings[id].text;
    }

    function getApartmentsNum() public view returns (uint) {
        return apartments.length;
    }

    function getApartment(uint apartmentId) public view returns (
        uint id,
        bool disabled,
        address owner,
        string title,
        string primaryImage,
        uint numImages,
        uint physicalAddress,
        uint128 pricePerNight,
        uint128 deposit,
        uint numRentals,
        uint numRatings) {
        require(apartments.length > apartmentId);

        id = apartments[apartmentId];
        disabled = apartments[apartmentId].disabled;
        owner = apartments[apartmentId].owner;
        title = apartments[apartmentId].title;
        primaryImage = apartments[apartmentId].primaryImage;
        numImages = apartments[apartmentId].images.length;
        physicalAddress = apartments[apartmentId].physicalAddress;
        pricePerNight = apartments[apartmentId].pricePerNight;
        deposit = apartments[apartmentId].deposit;
        numRentals = apartments[apartmentId].rentals.length;
        numRatings = apartments[apartmentId].ratings.length;
    }

    function getApartmentImage(uint apartmentId, uint apartmentImageIndex) public view returns (string)
    {
        require(apartments[apartmentId].images.length > apartmentImageIndex);

        return apartments[apartmentId].images[apartmentImageIndex];
    }

    function getApartmentRental(uint apartmentId, uint apartmentRentalIndex) public view returns (
        uint id,
        address tenant,
        uint16 fromDay,
        uint16 tillDay,
        uint128 deposit,
        bool depositClaimable
    ) {
        require(apartments.length > apartmentIndex);
        require(apartments[apartmentIndex].rentals.length > rentalIndex);

        id = apartments[apartmentId].rentals[rentalIndex];
        apartmentId = rentals[id].apartment;
        tenant = rentals[id].tenant;
        fromDay = rentals[id].fromDay;
        tillDay = rentals[id].tillDay;
        deposit = rentals[id].deposit;
        depositClaimable = rentals[id].depositClaimable;
    }

    function getApartmentRating(uint apartmentId, uint apartmentRatingId) public view returns (
        uint id,
        uint8 score,
        string text
    ) {
        require(apartments.length > apartmentId);
        require(apartments[apartmentId].ratings.length > apartmentRatingId);

        id = apartments[apartmentId].ratings[apartmentRatingId];
        score = ratings[id].score;
        text = ratings[id].text;
    }

    // Register a new user
    function register(string name, string street, string zipCode, string city, string country, string phone) public payable {
        require(users[msg.sender].addr == 0);

        // Adding this is necessary as apparently struct array members cannot be omitted in the struct constructor
        uint[] memory userApartments;
        uint[] memory userRentals;
        uint[] memory userRatings;
        User memory user = User(msg.sender, false, name, addAddress(street, zipCode, city, country, phone), weiToCredits(msg.value), 0, userApartments, userRentals, userRatings);

        users[msg.sender] = user;

        emit Registered(msg.sender);
    }

    // Check if the user can become a mediator
    // The will be true if the user has at least 5 ratings and an average score of at least 4
    function canBeMediator(address userAddr) public view returns (bool) {
        require(users[userAddr].addr != 0);

        return users[userAddr].ratings.length > 4 &&
        users[userAddr].totalScore / users[userAddr].ratings >= 4.0;
    }

    // Register as a mediator
    function registerAsMediator() public {
        require(users[msg.sender].addr != 0);
        require(!users[msg.sender].mediator);

        // Check if the user can be a mediator
        if (!canBeMediator(msg.sender)) {
            return;
        }

        users[msg.sender].mediator = true;
        mediators.push(msg.sender);
    }

    // Transfer balance to the user's account
    function transfer() public payable {
        require(users[msg.sender].addr != 0);

        // Increase the user's balance
        users[msg.sender].balance += weiToCredits(msg.value);

        emit Transferred(msg.sender, users[msg.sender].balance);
    }

    // Pay out balance from the user's account
    function payout(uint credits) public {
        require(users[msg.sender].addr != 0);
        require(credits > 0);
        require(users[msg.sender].balance >= credits);

        uint desiredWei = creditsToWei(credits);

        // Only perform the transaction if the contract's balance is high enough
        require(address(this).balance >= desiredWei);

        // Reduce the user's balance
        users[msg.sender].balance -= credits;

        // Send the wei to the user
        msg.sender.transfer(desiredWei);

        emit Paidout(msg.sender, users[msg.sender].balance);
    }

    // Add a address. Returns the new address id.
    function addAddress(string street, string zipCode, string city, string country) private returns (uint){
        Address memory newAddress = Address(street, zipCode, city, country);

        addresses.push(newAddress);

        return addresses.length - 1;
    }

    // Add an apartment available for rent
    function addApartment(string title, string street, string zipCode, string city, string country, string phone, string primaryImage, uint128 pricePerNight, uint128 deposit) public {
        require(users[msg.sender].addr != 0);

        User storage user = users[msg.sender];

        // Adding this is necessary as apparently struct array members cannot be omitted in the struct constructor
        uint[] memory apartmentRentals;
        uint[] memory apartmentRatings;
        string[] memory images;

        Apartment memory apartment = Apartment(false, user.addr, title, primaryImage, images, addAddress(street, zipCode, city, country, phone), pricePerNight, deposit, apartmentRentals, apartmentRatings);

        apartments.push(apartment);
        user.apartments.push(apartments.length - 1);

        emit ApartmentAdded(msg.sender, apartments.length - 1);
    }

    // Change the apartments primary image
    function changePrimaryImage(uint apartmentId, string image) public
    {
        require(apartments[apartmentId].owner == msg.sender);

        apartments[apartmentId].primaryImage = image;

        emit PrimaryImageChanged(msg.sender, apartmentId, image);
    }

    // Add an image to an apartment
    function addApartmentImage(uint apartmentId, string image) public
    {
        require(apartments[apartmentId].owner == msg.sender);
        require(apartments[apartmentId].images.length < 5);

        apartments[apartmentId].images.push(image);

        emit ImageAdded(msg.sender, apartmentId, image);
    }

    // Remove an image from an apartment
    function removeImage(uint apartmentId, uint apartmentImageIndex) public
    {
        require(apartments[apartmentId].owner == msg.sender);
        require(apartments[apartmentId].images.length > apartmentImageIndex);

        for (uint i = apartmentImageIndex; i < apartments[apartmentId].images.length - 1; i++) {
            apartments[apartmentId].images[i] = apartments[apartmentId].images[i + 1];
        }

        apartments[apartmentId].images.length--;

        emit ImageRemoved(msg.sender, apartmentId, apartmentImageIndex);
    }

    // Enable an apartment so it can be rented again
    function enableApartment(uint apartmentId) public {
        require(apartments[apartmentId].disabled == true);
        require(apartments[apartmentId].owner == msg.sender);

        apartments[apartmentId].disabled = false;

        emit ApartmentEnabled(msg.sender, apartmentId);
    }

    // Disable an apartment so that it cannot be rented anymore
    // Doesn't affect existing rentals
    function disableApartment(uint apartmentId) public {
        require(apartments[apartmentId].disabled == false);
        require(apartments[apartmentId].owner == msg.sender);

        apartments[apartmentId].disabled = true;

        emit ApartmentDisabled(msg.sender, apartmentId);
    }

    // Rent an apartment for a specified timeframe
    function rent(uint apartmentId, uint16 fromDay, uint16 tillDay) public payable {
        require(users[msg.sender].addr != 0);
        require(apartments[apartmentId].disabled == false);

        // Forbid same-day rentals and rentals that are mixed up (start day after end day)
        require(tillDay > fromDay);

        if (msg.value > 0) {
            users[msg.sender].balance += weiToCredits(msg.value);
        }

        // Check if the apartment is occupied
        require(isAvailable(apartmentId, fromDay, tillDay));

        Apartment storage apartment = apartments[apartmentId];

        // Calculate the fee from the pricePerNight
        uint rentalFee = apartment.pricePerNight * (tillDay - fromDay);

        // Check if the tenant has enough balance to pay for the apartment rental and the deposit
        require(users[msg.sender].balance >= rentalFee + apartment.deposit);

        // Add a new rental
        uint rentalId = rentals.length;
        Rental memory rental = Rental(apartmentId, fromDay, tillDay, apartment.deposit, rentalFee, msg.sender, false, false, DepositStatus.Open);

        // Add the rental to the rentals
        rentals.push(rental);

        // Add the rental to the user's rentals
        users[msg.sender].rentals.push(rentalId);

        // Add the rental to the apartment's rentals
        apartment.rentals.push(rentalId);

        // Reduce the tenant's balance by deposit and rental fee
        users[msg.sender].balance -= rentalFee + apartment.deposit;

        // Increase the owner's balance by rental fee (the deposit is still in the rental)
        users[apartment.owner].balance += rentalFee;

        emit Rented(msg.sender, apartment.owner, apartmentId, rentalId);
    }

    // Rate a rental as a tenant
    function rateRental(uint rentalId, uint8 score, string text) public {
        // Check the parameters
        require(score < 6 && score > 0);
        require(bytes(text).length > 0);

        // Check that the rental exists
        require(rentals.length > rentalId);

        Rental storage rental = rentals[rentalId];

        // Check that the sender is the tenant
        require(msg.sender == rental.tenant);

        // Check that the rental didn't end (=> wasn't rated) from the tenant side yet
        require(!rental.tenantRated);

        // Set the ended flag for the tenant
        rental.tenantRated = true;

        // If the deposit is claimable directly, transfer it to the tenant
        if (depositIsClaimable(rentalId)) {
            rental.depositStatus = DepositStatus.Processed;
            users[msg.sender].balance += rental.deposit;
        }

        // Add the rating to the rental
        rental.ratings.push(Rating(score, text));
    }

    // The deposit is claimable if marked as Claimable or it is Open and
    // at least 7 days have passed since the rental was over
    function depositIsClaimable(uint rentalId) public view returns (bool) {
        // Check that the rental exists
        require(rentals.length > rentalId);

        return
        rentals[rentalId].depositStatus == DepositStatus.Claimable ||
        rentals[rentalId].depositStatus == DepositStatus.Open &&
        // Calculate the days passed by comparing the tillDay with the block day - 7 days
        rentals[rentalId].tillDay < block.timestamp * 86400 - 7;
    }

    // Rate the tenant and request deposit deductions
    function rateTenant(uint rentalId, uint8 score, string text, uint depositDeduction, string deductionReason) public
    {
        // Check the parameters
        require(score < 6 && score > 0);
        require(bytes(text).length > 0);
        require(depositDeduction >= 0);

        // Check that the rental exists
        require(rentals.length > rentalId);

        Rental storage rental = rentals[rentalId];

        // Check that the sender is the owner of the apartment
        require(msg.sender == apartments[rental.apartment].owner);

        // Check the requested deduction is not higher than the deposit
        require(depositDeduction <= rental.deposit);

        // Check that if a deduction was requested:
        // - a reason is also provided and
        // - at least one mediator is registered
        // - the deposit is higher than the mediator fee
        require(depositDeduction == 0 ||
        bytes(deductionReason).length > 0 &&
        mediators.length > 0 &&
        rental.deposit > mediatorFee);

        // Check that the rental didn't end  (=> wasn't rated) from the owner side yet
        require(!rental.ownerRated);

        // Set the ended flag for the owner
        rental.ownerRated = true;

        // Add the rating to the user
        users[rental.tenant].ratings.push(Rating(score, text));

        if (depositDeduction == 0) {
            // If the tenant has already rated the rental, we can directly refund the deposit
            if (rental.tenantRated) {
                rental.depositStatus = DepositStatus.Processed;
                users[msg.sender].balance += rental.deposit;

                return;
            }

            // Otherwise, set the deposit status to claimable
            rental.depositStatus = DepositStatus.Claimable;
            return;
        }

        // If there was a deduction requested, we must create a new deduction and save it in the rental
        rental.depositDeduction = DepositDeduction(
            rentalId,
            block.timestamp / 86400, // current block day
            depositDeduction,
            deductionReason,
            "",
            "",
            address(0),
            DeductionStatus.Requested
        );
        rental.depositStatus = DepositStatus.Pending;
    }

    // Get a pseudo-random mediator
    function getRandomMediator() private view returns (address) {
        // If we only have one mediator, return him
        if (mediators.length == 1) {
            return mediators[0];
        }

        // Get the mediator based on a pseudo-random number generated using the block timestamp and difficulty
        return mediators[uint256(keccak256(block.timestamp, block.difficulty)) % mediators.length];
    }

    // Claim the deposit refund if the tenant has already rated,
    // the owner hasn't rated and 7 days have passed after the rental
    function claimDepositRefund(uint rentalId) public {
        // Check that the rental exists
        require(rentals.length > rentalId);

        Rental storage rental = rentals[rentalId];

        // Check that the sender is the tenant
        require(msg.sender == rental.tenant);

        // Check that the rental ended (=> was already rated) from the tenant side
        require(rental.tenantRated);

        // Check that the deposit is claimable
        require(depositIsClaimable(rentalId));

        // Transfer the deposit to the tenant
        rental.depositStatus = DepositStatus.Processed;
        users[msg.sender].balance += rental.deposit;
    }

    // Accept a deposit deduction as a tenant
    function acceptDepositDeduction(uint rentalId) public {
        require(rentals.length > rentalId);

        Rental storage rental = rentals[rentalId];

        // Only allow accepting deductions from the tenant
        require(msg.sender == rental.tenant);

        // Only allow objections if the depositStatus and the deduction status match
        require(rental.depositStatus == DepositStatus.Pending);
        require(rental.depositDeduction.status == DeductionStatus.Requested);

        // Change the status
        rental.depositStatus = DepositStatus.Processed;
        rental.depositDeduction.status = DeductionStatus.Resolved;

        // Transfer the deducted amount to the owner and the rest to the tenant
        users[apartments[rental.apartment].owner].balance += rental.depositDeduction.amount;
        users[rental.tenant].balance += rental.deposit - rental.depositDeduction.amount;
    }

    // Object a deposit deduction as a tenant
    function objectDepositDeduction(uint rentalId, string objection) public {
        require(rentals.length > rentalId);

        Rental storage rental = rentals[rentalId];

        // Only allow objections from the tenant
        require(msg.sender == rental.tenant);

        // Only allow objections if the depositStatus and the deduction status match
        require(rental.depositStatus == DepositStatus.Pending);
        require(rental.depositDeduction.status == DeductionStatus.Requested);

        // Change the status
        rental.depositDeduction.status = DeductionStatus.Objected;
        rental.depositDeduction.objection = objection;

        // Assign a mediator
        rental.depositDeduction.mediator = getRandomMediator();

        // Update the lastChange day
        rental.depositDeduction.lastChange = block.timestamp / 86400;
    }

    // Resolve deposit deduction after a timeout (eg. after no change occurred for 7 days)
    // If the deduction was not objected, it is granted to the owner
    // If it was objected but the mediator did not mediate it, the owner receives half of the deducted amount
    function resolveDeductionTimeout(uint rentalId) public {
        require(rentals.length > rentalId);

        Rental storage rental = rentals[rentalId];

        // Only allow resolving from the tenant or owner
        require(msg.sender == rental.tenant || msg.sender == apartments[rental.apartment].owner);

        // Only allow resolving if the depositStatus and the deduction status match
        require(rental.depositStatus == DepositStatus.Pending);
        require(rental.depositDeduction.status == DeductionStatus.Requested || rental.depositDeduction.status == DeductionStatus.Objected);

        // Only allow resolving after 7 days
        require(rental.lastChange < block.timestamp * 86400 - 7);

        // Change the status
        rental.depositStatus = DepositStatus.Processed;
        rental.depositDeduction.status = DeductionStatus.Resolved;

        // Transfer the deposit minus half of the deduction (rounded down) to the tenant
        users[rental.tenant].balance += rental.deposit - (rental.depositDeduction.amount / 2 - rental.depositDeduction.amount % 2);

        // Transfer the other half of the deduction (rounded down) to the owner
        users[apartments[rental.apartment].owner].balance += rental.depositDeduction.amount / 2 - rental.depositDeduction.amount % 2;
    }

    // Mediate an deposit request that was objected
    function mediate(uint deductionId, uint128 ownerRefund, uint128 tenantRefund, string conclusion) public {
        require(depositDeductions.length > deductionId);

        // Check that we have a conclusion
        require(bytes(conclusion).length > 0);

        DepositDeduction storage deduction = depositDeductions[deductionId];
        Rental storage rental = rentals[deduction.rental];

        // Check that the sender is also the mediator
        require(msg.sender == deduction.mediator);

        // Check that the deduction requires mediation
        require(deduction.status == DeductionStatus.Objected);

        // Check that the total of owner refund, landlord refund and mediator fee matches the total deposit
        require(ownerRefund + tenantRefund + mediatorFee == rental.deposit);

        // Set the deduction to resolved and the deposit to processed
        deduction.status = DepositStatus.Resolved;
        rental.depositStatus = DepositStatus.Processed;

        // Split the deposit among tenant, owner and mediator
        users[rental.tenant].balance += tenantRefund;
        users[apartments[rental.apartment].owner].balance += ownerRefund;
        users[msg.sender].balance += mediatorFee;
    }

    // Check if the apartment is available at the requested time
    function isAvailable(uint apartmentId, uint16 fromDay, uint16 tillDay) public view returns (bool) {
        require(apartments.length > apartmentId);

        // Disabled apartments can never be rented
        if (apartments[apartmentId].disabled) {
            return false;
        }

        // Forbid same-day rentals and rentals that are mixed up (start day after end day)
        require(tillDay > fromDay);

        uint[] memory apartmentRentals = apartments[apartmentId].rentals;

        uint numRentals = apartmentRentals.length;

        // Check all rentals for the apartment
        for (uint i = 0; i < numRentals; i ++) {
            Rental storage rental = rentals[apartmentRentals[i]];

            if (
            // Check if the requested rental starts in the time frame of the currently checked rental
                fromDay >= rental.fromDay && fromDay < rental.tillDay ||

                // Check if the requested rental ends in the time frame of the currently checked rental
                tillDay > rental.fromDay && fromDay <= rental.fromDay
            ) {
                return false;
            }
        }

        return true;
    }

    // Get the amount of wei for the provided credits
    function creditsToWei(uint credits) public pure returns (uint) {
        return credits * creditConversionFactor;
    }

    // Get the amount of credits for the provided wei
    function weiToCredits(uint value) public pure returns (uint) {
        return value / creditConversionFactor;
    }
}
