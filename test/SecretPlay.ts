import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SecretPlay, SecretPlay__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SecretPlay")) as SecretPlay__factory;
  const secretPlay = (await factory.deploy()) as SecretPlay;
  const secretPlayAddress = await secretPlay.getAddress();

  return { secretPlay, secretPlayAddress };
}

describe("SecretPlay", function () {
  let signers: Signers;
  let secretPlay: SecretPlay;
  let secretPlayAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ secretPlay, secretPlayAddress } = await deployFixture());
  });

  it("mints encrypted gold when buying", async function () {
    const tx = await secretPlay.connect(signers.alice).buyGold({ value: ethers.parseEther("1") });
    await tx.wait();

    const encryptedBalance = await secretPlay.getEncryptedBalance(signers.alice.address);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      secretPlayAddress,
      signers.alice,
    );

    expect(clearBalance).to.eq(1_000_000);
  });

  it("stores encrypted building choice and charges gold", async function () {
    const tx = await secretPlay.connect(signers.alice).buyGold({ value: ethers.parseEther("0.001") });
    await tx.wait();

    const encryptedInput = await fhevm
      .createEncryptedInput(secretPlayAddress, signers.alice.address)
      .add8(4)
      .encrypt();

    const buildTx = await secretPlay.connect(signers.alice).build(encryptedInput.handles[0], encryptedInput.inputProof);
    await buildTx.wait();

    const encryptedBuilding = await secretPlay.getEncryptedBuilding(signers.alice.address);
    const decryptedBuilding = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedBuilding,
      secretPlayAddress,
      signers.alice,
    );

    const encryptedBalance = await secretPlay.getEncryptedBalance(signers.alice.address);
    const decryptedBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      secretPlayAddress,
      signers.alice,
    );

    expect(decryptedBuilding).to.eq(4);
    expect(decryptedBalance).to.eq(0);
  });
});
