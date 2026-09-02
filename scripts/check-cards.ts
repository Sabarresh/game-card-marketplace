import { network } from "hardhat";

const { ethers } = await network.connect();

const contractAddress =
  "0xeaFBdB1030F7363B89e533e55AD07fD3a9E5B4DF";

const gameCard = await ethers.getContractAt(
  "GameCard",
  contractAddress
);

for (let tokenId = 1; tokenId <= 3; tokenId++) {
  try {
    const owner = await gameCard.ownerOf(tokenId);
    const uri = await gameCard.tokenURI(tokenId);

    console.log(`\nToken #${tokenId}`);
    console.log("Owner:", owner);
    console.log("Metadata:", uri);
  } catch {
    console.log(`\nToken #${tokenId} does not exist`);
  }
}
