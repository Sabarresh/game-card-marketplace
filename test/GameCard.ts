import { expect } from "chai";
import { network } from "hardhat";

describe("GameCard", function () {

it("should mint a card to the caller", async function () {
const { ethers } = await network.connect();


const [owner] = await ethers.getSigners();

const GameCard = await ethers.getContractFactory("GameCard");
const gameCard = await GameCard.deploy();

await gameCard.mintCard("ipfs://example");

expect(await gameCard.ownerOf(1)).to.equal(owner.address);


});

it("should give different token IDs to different cards", async function () {
const { ethers } = await network.connect();


const GameCard = await ethers.getContractFactory("GameCard");
const gameCard = await GameCard.deploy();

await gameCard.mintCard("ipfs://card1");
await gameCard.mintCard("ipfs://card2");

expect(await gameCard.ownerOf(1)).to.not.equal(ethers.ZeroAddress);
expect(await gameCard.ownerOf(2)).to.not.equal(ethers.ZeroAddress);


});

it("should reject ownership lookup for a token that does not exist", async function () {
const { ethers } = await network.connect();

const GameCard = await ethers.getContractFactory("GameCard");
const gameCard = await GameCard.deploy();

await gameCard.mintCard("ipfs://card1");

await expect(gameCard.ownerOf(999)).to.be.revert(ethers);
});

it("should list a card for sale", async function () {
  const { ethers } = await network.connect();

  const [seller] = await ethers.getSigners();

  const gameCard = await ethers.deployContract("GameCard");

  await gameCard.mintCard("ipfs://test");

  const price = ethers.parseEther("0.01");

  await gameCard.listCard(1, price);

  const listing = await gameCard.listings(1);

  expect(listing.seller).to.equal(seller.address);
  expect(listing.price).to.equal(price);
});

it("should allow a buyer to purchase a listed card", async function () {
  const { ethers } = await network.connect();

  const [seller, buyer] = await ethers.getSigners();

  const gameCard = await ethers.deployContract("GameCard");

  await gameCard.mintCard("ipfs://test");

  const price = ethers.parseEther("0.01");

  await gameCard.listCard(1, price);

  await gameCard
    .connect(buyer)
    .buyCard(1, { value: price });

  expect(await gameCard.ownerOf(1)).to.equal(buyer.address);
});

it("should reject an incorrect payment", async function () {
  const { ethers } = await network.connect();

  const [seller, buyer] = await ethers.getSigners();

  const gameCard = await ethers.deployContract("GameCard");

  await gameCard.mintCard("ipfs://test");

  const price = ethers.parseEther("0.01");

  await gameCard.listCard(1, price);

  await expect(
    gameCard
      .connect(buyer)
      .buyCard(1, { value: ethers.parseEther("0.005") })
  ).to.be.revertedWith("Incorrect payment");
});

});
