pragma solidity ^0.4.22;

import "./Library.sol";

contract Rent {
    struct User {
        address addr;
        string name;
        uint balance;
    }

    struct Apartment {
        User owner;

        string name;
        string street;
        uint24 zip;
        string city;

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

    event Rented(uint indexed apartmentId, Rental rental);
    event Registered(address indexed userAddress, User user);

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

    function getRentalsNum(uint apartmentId) public view returns (uint) {
        return rentals[apartmentId].length;
    }

    function register(string name) public payable {
        require(users[msg.sender].addr == 0);

        User memory user = User(msg.sender, name, msg.value);

        users[msg.sender] = user;

        emit Registered(msg.sender, user);
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
        rentals[apartmentId].push(rental);

        // Reduce the tenant's balance by deposit and rental fee
        users[msg.sender].balance -= rentalFee + apartment.deposit;

        emit Rented(apartmentId, rental);
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
