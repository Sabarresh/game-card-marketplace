// SPDX-License-Identifier: MIT

pragma solidity ^0.8.34;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract GameCard is ERC721 {

    uint private tokenId;

    mapping(uint => string) private _tokenURIs;

    struct Listing {
        address seller;
        uint price;
    }

    mapping(uint => Listing) public listings;

    constructor() ERC721("GameCard", "GCRD") {}

    function mintCard(string memory uri) public {
        tokenId++;

        _safeMint(msg.sender, tokenId);

        _tokenURIs[tokenId] = uri;
    }

    function tokenURI(uint token) public view override returns (string memory) {
        return _tokenURIs[token];
    }

    function listCard(uint token, uint price) public {
        require(ownerOf(token) == msg.sender, "Not the owner");
        require(price > 0, "Price must be greater than zero");

        listings[token] = Listing(msg.sender, price);
    }

    function buyCard(uint token) public payable {
        Listing memory listing = listings[token];

        require(listing.price > 0, "Card is not listed");
        require(msg.value == listing.price, "Incorrect payment");
        require(msg.sender != listing.seller, "Seller cannot buy");

        _transfer(listing.seller, msg.sender, token);

        (bool success, ) = payable(listing.seller).call{value: msg.value}("");
        require(success, "Payment failed");

        delete listings[token];
    }
}