// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint64, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SecretPlay encrypted builder game
/// @notice Players buy encrypted gold and select an encrypted building type.
contract SecretPlay is ZamaEthereumConfig {
    uint256 public constant GOLD_PER_ETH = 1_000_000;
    uint256 public constant WEI_PER_GOLD = 1e12;

    mapping(address => euint64) private _balances;
    mapping(address => euint8) private _buildings;

    event GoldPurchased(address indexed player, uint256 weiAmount, uint256 goldAmount);
    event BuildingSubmitted(address indexed player);

    /// @notice Buy encrypted gold with ETH.
    function buyGold() external payable {
        require(msg.value > 0, "No ETH sent");

        uint256 goldAmount = msg.value / WEI_PER_GOLD;
        require(goldAmount > 0, "Amount too small");
        require(goldAmount <= type(uint64).max, "Gold amount too large");

        euint64 updated = FHE.add(_balances[msg.sender], FHE.asEuint64(uint64(goldAmount)));
        _balances[msg.sender] = updated;

        FHE.allowThis(updated);
        FHE.allow(updated, msg.sender);

        emit GoldPurchased(msg.sender, msg.value, goldAmount);
    }

    /// @notice Submit an encrypted building choice (id 1-4).
    /// @param buildingId Encrypted building id
    /// @param inputProof Proof for encrypted input
    function build(externalEuint8 buildingId, bytes calldata inputProof) external {
        euint8 chosen = FHE.fromExternal(buildingId, inputProof);
        euint64 cost = _buildingCost(chosen);

        ebool hasCost = FHE.ne(cost, FHE.asEuint64(0));
        ebool hasFunds = FHE.ge(_balances[msg.sender], cost);
        ebool canBuild = FHE.and(hasCost, hasFunds);

        euint64 newBalance = FHE.select(
            canBuild,
            FHE.sub(_balances[msg.sender], cost),
            _balances[msg.sender]
        );
        _balances[msg.sender] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        euint8 newBuilding = FHE.select(canBuild, chosen, _buildings[msg.sender]);
        _buildings[msg.sender] = newBuilding;
        FHE.allowThis(newBuilding);
        FHE.allow(newBuilding, msg.sender);

        emit BuildingSubmitted(msg.sender);
    }

    /// @notice Read encrypted gold balance for a player.
    function getEncryptedBalance(address player) external view returns (euint64) {
        return _balances[player];
    }

    /// @notice Read encrypted building choice for a player.
    function getEncryptedBuilding(address player) external view returns (euint8) {
        return _buildings[player];
    }

    function _buildingCost(euint8 buildingId) internal returns (euint64) {
        euint64 cost = FHE.select(
            FHE.eq(buildingId, FHE.asEuint8(1)),
            FHE.asEuint64(100),
            FHE.asEuint64(0)
        );
        cost = FHE.select(FHE.eq(buildingId, FHE.asEuint8(2)), FHE.asEuint64(200), cost);
        cost = FHE.select(FHE.eq(buildingId, FHE.asEuint8(3)), FHE.asEuint64(400), cost);
        cost = FHE.select(FHE.eq(buildingId, FHE.asEuint8(4)), FHE.asEuint64(1000), cost);
        return cost;
    }
}
