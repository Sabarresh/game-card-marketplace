import { network } from "hardhat";

const { ethers } = await network.connect();

const contractAddress =
  "0xeaFBdB1030F7363B89e533e55AD07fD3a9E5B4DF";

const gameCard = await ethers.getContractAt(
  "GameCard",
  contractAddress
);

const metadataURI =
  "ipfs://bafkreick5cjbhqdjb47njg5jmhorgje35d55c6zel4giqvzcw4kelmof54";

const tx = await gameCard.mintCard(metadataURI);

console.log("Transaction sent:", tx.hash);

await tx.wait();

console.log("Card minted successfully!");
