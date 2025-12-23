import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { SecretPlay } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("SecretPlaySepolia", function () {
  let signers: Signers;
  let secretPlay: SecretPlay;
  let secretPlayAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const secretPlayDeployment = await deployments.get("SecretPlay");
      secretPlayAddress = secretPlayDeployment.address;
      secretPlay = await ethers.getContractAt("SecretPlay", secretPlayDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("buy gold and build on Sepolia", async function () {
    steps = 12;
    this.timeout(4 * 40000);

    progress("Buying gold with 0.001 ETH...");
    let tx = await secretPlay.connect(signers.alice).buyGold({ value: ethers.parseEther("0.001") });
    await tx.wait();

    progress("Reading encrypted balance...");
    const encryptedBalance = await secretPlay.getEncryptedBalance(signers.alice.address);
    expect(encryptedBalance).to.not.eq(ethers.ZeroHash);

    progress(`Decrypting balance=${encryptedBalance}...`);
    const clearBalance = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedBalance,
      secretPlayAddress,
      signers.alice,
    );
    progress(`Clear balance=${clearBalance}`);
    expect(clearBalance).to.eq(1000);

    progress("Encrypting building id 4...");
    const encryptedInput = await fhevm
      .createEncryptedInput(secretPlayAddress, signers.alice.address)
      .add8(4)
      .encrypt();

    progress("Submitting encrypted building...");
    tx = await secretPlay.connect(signers.alice).build(encryptedInput.handles[0], encryptedInput.inputProof);
    await tx.wait();

    progress("Reading encrypted building...");
    const encryptedBuilding = await secretPlay.getEncryptedBuilding(signers.alice.address);
    expect(encryptedBuilding).to.not.eq(ethers.ZeroHash);

    progress(`Decrypting building=${encryptedBuilding}...`);
    const clearBuilding = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedBuilding,
      secretPlayAddress,
      signers.alice,
    );
    progress(`Clear building=${clearBuilding}`);
    expect(clearBuilding).to.eq(4);
  });
});
