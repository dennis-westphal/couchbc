pragma solidity ^0.4.22;

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
    }

    struct Apartment {
        User owner;

        string title;

        string street;
        string zipCode;
        string city;
        string country;

        uint128 pricePerNight;
        uint128 deposit;
    }

    struct Rental {
        Apartment apartment;
        User tenant;
        uint16 fromDay; // Day as flat(unix timestamp / (60*60*24))
        uint16 tillDay;
        uint128 deposit;
    }

    mapping(address => User) users;

    Apartment[] public apartments;

    // Mapping of apartment id (index) to rentals
    mapping(uint => Rental[]) rentals;

    event Rented(uint indexed apartmentId, uint rentalIndex);
    event Registered(address indexed userAddress);
    event ApartmentAdded(address indexed userAddress, uint apartmentId);

    function isRegistered() public view returns (bool) {
        return users[msg.sender].addr != 0;
    }

    function getBalance() public view returns (uint) {
        require(users[msg.sender].addr != 0);

        return users[msg.sender].balance;
    }

    function getApartmentsNum() public view returns (uint) {
        return apartments.length;
    }

    function getApartment(uint apartmentId) public view returns (
        address owner,
        string title,
        string street,
        string zipCode,
        string city,
        string country,
        uint128 pricePerNight,
        uint128 deposit) {
        Apartment storage apartment = apartments[apartmentId];

        owner = apartment.owner.addr;
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

    function register(string name, string street, string zipCode, string city, string country) public payable {
        require(users[msg.sender].addr == 0);

        // Adding this is necessary as apparently struct array members cannot be omitted in the struct constructor
        uint[] storage userApartments;
        User memory user = User(msg.sender, name, street, zipCode, city, country, msg.value, userApartments);

        users[msg.sender] = user;

        emit Registered(msg.sender);
    }

    function addApartment(string title, string street, string zipCode, string city, string country, uint128 pricePerNight, uint128 deposit) public {
        require(users[msg.sender].addr != 0);

        User storage user = users[msg.sender];

        Apartment memory apartment = Apartment(user, title, street, zipCode, city, country, pricePerNight, deposit);

        uint apartmentId = apartments.length;
        apartments.push(apartment);
        user.apartments.push(apartmentId);

        emit ApartmentAdded(msg.sender, apartmentId);
    }

    function rent(uint apartmentId, uint16 fromDay, uint16 tillDay) public payable {
        require(users[msg.sender].addr != 0);

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
        Rental memory rental = Rental(apartment, users[msg.sender], fromDay, tillDay, apartment.deposit);
        uint rentalIndex = rentals[apartmentId].length;
        rentals[apartmentId].push(rental);

        // Reduce the tenant's balance by deposit and rental fee
        users[msg.sender].balance -= rentalFee + apartment.deposit;

        emit Rented(apartmentId, rentalIndex);
    }

    function isAvailable(uint apartmentIndex, uint16 fromDay, uint16 tillDay) public view returns (bool) {
        require(apartments.length > apartmentIndex);

        // TODO: Check if apartment was deleted

        Rental[] memory apartmentRentals = rentals[apartmentIndex];

        uint numRentals = apartmentRentals.length;

        // Check all rentals for the apartment
        for (uint i = 0; i < numRentals; i ++) {
            if (
            // Check if the rental ends in the requested period
                apartmentRentals[i].fromDay < fromDay && apartmentRentals[i].tillDay > fromDay ||

                // Check if the rental starts in the requested period
                apartmentRentals[i].fromDay < tillDay && apartmentRentals[i].tillDay > tillDay
            ) {
                return false;
            }
        }

        return true;
    }
}
