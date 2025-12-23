import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Local node workflow
 * ===========================================================
 * 1) npx hardhat node
 * 2) npx hardhat --network localhost deploy
 * 3) npx hardhat --network localhost task:buy-gold --eth 0.001
 * 4) npx hardhat --network localhost task:build --building 2
 * 5) npx hardhat --network localhost task:decrypt-balance
 * 6) npx hardhat --network localhost task:decrypt-building
 */

task("task:address", "Prints the SecretPlay address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const secretPlay = await deployments.get("SecretPlay");
  console.log("SecretPlay address is " + secretPlay.address);
});

task("task:decrypt-balance", "Decrypts the encrypted gold balance")
  .addOptionalParam("address", "Optionally specify the SecretPlay contract address")
  .addOptionalParam("player", "Optionally specify the player address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const secretPlayDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SecretPlay");
    console.log(`SecretPlay: ${secretPlayDeployment.address}`);

    const signers = await ethers.getSigners();
    const player = taskArguments.player ?? signers[0].address;

    const secretPlay = await ethers.getContractAt("SecretPlay", secretPlayDeployment.address);
    const encryptedBalance = await secretPlay.getEncryptedBalance(player);

    if (encryptedBalance === ethers.ZeroHash) {
      console.log(`Encrypted balance: ${encryptedBalance}`);
      console.log("Clear balance    : 0");
      return;
    }

    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      secretPlayDeployment.address,
      signers[0],
    );

    console.log(`Encrypted balance: ${encryptedBalance}`);
    console.log(`Clear balance    : ${clearBalance}`);
  });

task("task:decrypt-building", "Decrypts the encrypted building id")
  .addOptionalParam("address", "Optionally specify the SecretPlay contract address")
  .addOptionalParam("player", "Optionally specify the player address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const secretPlayDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SecretPlay");
    console.log(`SecretPlay: ${secretPlayDeployment.address}`);

    const signers = await ethers.getSigners();
    const player = taskArguments.player ?? signers[0].address;

    const secretPlay = await ethers.getContractAt("SecretPlay", secretPlayDeployment.address);
    const encryptedBuilding = await secretPlay.getEncryptedBuilding(player);

    if (encryptedBuilding === ethers.ZeroHash) {
      console.log(`Encrypted building: ${encryptedBuilding}`);
      console.log("Clear building    : 0");
      return;
    }

    const clearBuilding = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedBuilding,
      secretPlayDeployment.address,
      signers[0],
    );

    console.log(`Encrypted building: ${encryptedBuilding}`);
    console.log(`Clear building    : ${clearBuilding}`);
  });

task("task:buy-gold", "Buys encrypted gold with ETH")
  .addOptionalParam("address", "Optionally specify the SecretPlay contract address")
  .addParam("eth", "Amount of ETH to spend (example: 0.001)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const secretPlayDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SecretPlay");
    console.log(`SecretPlay: ${secretPlayDeployment.address}`);

    const ethAmount = taskArguments.eth;
    const value = ethers.parseEther(ethAmount);

    const signers = await ethers.getSigners();
    const secretPlay = await ethers.getContractAt("SecretPlay", secretPlayDeployment.address);

    const tx = await secretPlay.connect(signers[0]).buyGold({ value });
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("task:build", "Submits an encrypted building choice (1-4)")
  .addOptionalParam("address", "Optionally specify the SecretPlay contract address")
  .addParam("building", "Building id (1-4)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const buildingId = parseInt(taskArguments.building);
    if (!Number.isInteger(buildingId)) {
      throw new Error(`Argument --building is not an integer`);
    }

    await fhevm.initializeCLIApi();

    const secretPlayDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("SecretPlay");
    console.log(`SecretPlay: ${secretPlayDeployment.address}`);

    const signers = await ethers.getSigners();
    const secretPlay = await ethers.getContractAt("SecretPlay", secretPlayDeployment.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(secretPlayDeployment.address, signers[0].address)
      .add8(buildingId)
      .encrypt();

    const tx = await secretPlay
      .connect(signers[0])
      .build(encryptedInput.handles[0], encryptedInput.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });
