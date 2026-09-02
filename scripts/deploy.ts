import { network } from "hardhat";

const { ethers } = await network.connect();

const gameCard = await ethers.deployContract("GameCard");

await gameCard.waitForDeployment();

console.log("GameCard deployed to:", await gameCard.getAddress());