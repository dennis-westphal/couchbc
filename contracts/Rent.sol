pragma solidity ^0.4.24;

import "./Library.sol";

contract Rent {
    struct User {
        address addr;

        string name;
        string street;
        string zipCode;
        string city;
        string country;

        uint balance;

        uint[] apartments;
        uint[] rentals;
    }

    struct Apartment {
        uint id;

        address owner;

        bool deleted;

        string title;

        string street;
        string zipCode;
        string city;
        string country;

        uint128 pricePerNight;
        uint128 deposit;

        uint[] rentals;
    }

    struct Rental {
        uint id;

        uint apartment;

        User tenant;
        uint16 fromDay; // Day as floor(unix timestamp / (60*60*24))
        uint16 tillDay;
        uint128 deposit;
    }

    mapping(address => User) users;

    Apartment[] public apartments;
    Rental[] public rentals;

    event Rented(address indexed userAddress, uint apartmentId, uint rentalId);
    event Registered(address indexed userAddress);
    event ApartmentAdded(address indexed userAddress, uint apartmentId);

    function isRegistered() public view returns (bool) {
        return users[msg.sender].addr != 0;
    }

    function getBalance() public view returns (uint) {
        require(users[msg.sender].addr != 0);

        return users[msg.sender].balance;
    }

    function getUserRentalsNum() public view returns (uint) {
        require(users[msg.sender].addr != 0);

        return users[msg.sender].rentals.length;
    }

    function getUserRental(uint userRentalIndex) public view returns (
        uint apartmentId,
        uint rentalId,
        uint16 fromDay,
        uint16 tillDay,
        uint128 deposit
    ) {
        require(users[msg.sender].addr != 0);

        Rental storage rental = rentals[users[msg.sender].rentals[userRentalIndex]];

        rentalId = rental.id;
        apartmentId = rental.apartment;
        fromDay = rental.fromDay;
        tillDay = rental.tillDay;
        deposit = rental.deposit;
    }

    function getApartmentsNum() public view returns (uint) {
        return apartments.length;
    }

    function getApartment(uint apartmentId) public view returns (
        uint id,
        bool deleted,
        address owner,
        string title,
        string street,
        string zipCode,
        string city,
        string country,
        uint128 pricePerNight,
        uint128 deposit) {
        // TODO: Check if apartment exists

        Apartment storage apartment = apartments[apartmentId];

        id = apartment.id;
        deleted = apartment.deleted;
        owner = apartment.owner;
        title = apartment.title;
        street = apartment.street;
        zipCode = apartment.zipCode;
        city = apartment.city;
        country = apartment.country;
        pricePerNight = apartment.pricePerNight;
        deposit = apartment.deposit;
    }

    function getRentalsNum(uint apartmentId) public view returns (uint) {
        return rentals[apartmentId].length;
    }

    function getRental(uint apartmentIndex, uint rentalIndex) public view returns (
        uint apartmentId,
        uint rentalId,
        address tenant,
        uint16 fromDay,
        uint16 tillDay,
        uint128 deposit
    ) {
        Rental storage rental = rentals[rentalIndex];

        rentalId = rental.id;
        apartmentId = rental.apartment;
        tenant = rental.tenant.addr;
        fromDay = rental.fromDay;
        tillDay = rental.tillDay;
    }

    function register(string name, string street, string zipCode, string city, string country) public payable {
        require(users[msg.sender].addr == 0);

        // Adding this is necessary as apparently struct array members cannot be omitted in the struct constructor
        uint[] storage userApartments;
        uint[] storage userRentals;
        User memory user = User(msg.sender, name, street, zipCode, city, country, msg.value, userApartments, userRentals);

        users[msg.sender] = user;

        emit Registered(msg.sender);
    }

    function addApartment(string title, string street, string zipCode, string city, string country, uint128 pricePerNight, uint128 deposit) public {
        require(users[msg.sender].addr != 0);

        uint apartmentId = apartments.length;
        User storage user = users[msg.sender];

        // Adding this is necessary as apparently struct array members cannot be omitted in the struct constructor
        uint[] storage apartmentRentals;

        Apartment memory apartment = Apartment(apartmentId, false, user.addr, title, street, zipCode, city, country, pricePerNight, deposit, apartmentRentals);

        apartments.push(apartment);
        user.apartments.push(apartmentId);

        emit ApartmentAdded(msg.sender, apartmentId);
    }

    function rent(uint apartmentId, uint16 fromDay, uint16 tillDay) public payable {
        require(users[msg.sender].addr != 0);
        require(apartments[apartmentId].deleted == false);

        if (msg.value > 0) {
            users[msg.sender].balance += msg.value;
        }

        // Forbid same-day rentals and rentals that are mixed up (start day after end day)
        require(tillDay > fromDay);

        // Check if the apartment is occupied
        require(isAvailable(apartmentId, fromDay, tillDay));

        Apartment storage apartment = apartments[apartmentId];

        // Calculate the fee from the pricePerNight
        uint rentalFee = apartment.pricePerNight * (tillDay - fromDay);

        // Check if the tenant has enough balance to pay for the apartment rental and the deposit
        require(users[msg.sender].balance > rentalFee + apartment.deposit);

        // Add a new rental
        uint rentalId = rentals.length;
        Rental memory rental = Rental(apartmentId, rentalId, users[msg.sender], fromDay, tillDay, apartment.deposit);

        // Add the rental to the rentals
        rentals.push(rental);

        // Add the rental to the user's rentals
        users[msg.sender].rentals.push(rentalId);

        // Add the rental to the apartment's rentals
        apartment.rentals.push(rentalId);

        // Reduce the tenant's balance by deposit and rental fee
        users[msg.sender].balance -= rentalFee + apartment.deposit;

        emit Rented(msg.sender, apartmentId, rentalId);
    }

    function isAvailable(uint apartmentId, uint16 fromDay, uint16 tillDay) public view returns (bool) {
        require(apartments.length > apartmentId);
        require(apartments[apartmentId].deleted == false);

        uint[] memory apartmentRentals = apartments[apartmentId].rentals;

        uint numRentals = apartmentRentals.length;

        // Check all rentals for the apartment
        for (uint i = 0; i < numRentals; i ++) {
            if (
            // Check if the rental ends in the requested period
                rentals[apartmentRentals[i]].fromDay < fromDay && rentals[apartmentRentals[i]].tillDay > fromDay ||

                // Check if the rental starts in the requested period
                rentals[apartmentRentals[i]].fromDay < tillDay && rentals[apartmentRentals[i]].tillDay > tillDay
            ) {
                return false;
            }
        }

        return true;
    }

    function getBalanceCost(uint balance) public pure returns (uint) {
        return balance * 1000;
    }
}
