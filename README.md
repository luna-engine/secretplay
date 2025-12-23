# SecretPlay

SecretPlay is an encrypted builder game on FHEVM (Zama). Players buy encrypted gold with ETH, choose one of four
buildings in private, and only decrypt their own state when they decide. The chain only stores ciphertext while still
allowing on-chain rules, balances, and costs to be enforced.

## Project goals

- Prove that on-chain games can keep player choices and balances private without relying on centralized servers.
- Demonstrate a simple but complete end-to-end FHE flow: encrypt input, submit on-chain, decrypt with user consent.
- Provide a clean reference stack for FHEVM contracts + a modern React UI.

## Problems solved

- **Private balances:** gold is stored as encrypted `euint64`, so outsiders cannot read holdings.
- **Private choices:** building selections are encrypted `euint8` values, hidden from observers.
- **Trust-minimized gameplay:** contract enforces costs and updates without ever seeing plaintext.
- **User-controlled decryption:** only the wallet owner can reveal their own data via the Zama relayer flow.

## Advantages

- **Privacy by default:** ciphertext on-chain, cleartext only off-chain for the user.
- **Deterministic rules:** spending and selection rules are enforced on-chain even though inputs are encrypted.
- **Minimal surface area:** one compact contract, a small set of tasks, and a focused frontend.
- **Upgradeable UX path:** the UI is ready for future encrypted features without breaking the contract.

## Features

- Buy gold with ETH at a fixed rate (1 ETH = 1,000,000 gold).
- Choose a building type (1-4) with encrypted input and enforced costs.
- Read encrypted balance and building handle on-chain.
- Decrypt balance or building choice on demand with user signature.
- Frontend dashboard for wallet status, encrypted handles, and decrypted results.

## How it works

1. **Buy gold:** the contract converts ETH into gold units and adds them to an encrypted balance.
2. **Encrypt choice:** the frontend encrypts a building id using the Zama relayer SDK.
3. **On-chain update:** the contract checks encrypted balance and encrypted cost, then updates state.
4. **Decrypt when ready:** the frontend asks the user to sign a typed message and requests decryption.

## Smart contract details

- `SecretPlay.sol` stores balances (`euint64`) and building ids (`euint8`) per player.
- Costs are enforced in encrypted form:
  - Building 1: 100 gold
  - Building 2: 200 gold
  - Building 3: 400 gold
  - Building 4: 1000 gold
- If a user cannot afford the cost, state remains unchanged (encrypted conditional update).
- Encrypted values are explicitly allowed for the contract and the player address.

## Frontend experience

The UI lives in `home/` and provides:

- Wallet connection via RainbowKit/Wagmi.
- Encrypted balance and building handle reads via `viem`.
- Transactions (buy/build) via `ethers`.
- Decryption flow using the Zama relayer SDK (EIP-712 signature).

## Tech stack

- **Contracts:** Solidity, FHEVM (Zama), hardhat, hardhat-deploy
- **Testing:** hardhat, chai, FHEVM testing helpers
- **Frontend:** React + Vite, TypeScript, Wagmi, Viem, Ethers v6
- **Encryption/Decryption:** `@zama-fhe/relayer-sdk`
- **Styling:** hand-written CSS (no Tailwind)

## Project structure

```
secretplay/
├── contracts/              # Solidity contracts
│   └── SecretPlay.sol
├── deploy/                 # Hardhat deploy scripts
├── deployments/            # Deployment artifacts (per network)
├── tasks/                  # Hardhat tasks for encrypted flows
├── test/                   # Contract tests
├── home/                   # React frontend (Vite)
├── hardhat.config.ts       # Hardhat configuration
└── README.md               # You are here
```

## Setup

### Requirements

- Node.js 20+
- npm
- A wallet with Sepolia ETH for deployment and testing

### Install dependencies

```bash
npm install
```

### Environment variables (contracts only)

Create a `.env` file in the project root with:

```
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_key
```

`PRIVATE_KEY` is required for Sepolia deployment. The project does not use mnemonics.

### Compile and test

```bash
npm run compile
npm run test
```

### Deploy

Local deployment (Hardhat node):

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

Sepolia deployment:

```bash
npx hardhat deploy --network sepolia
```

### Update frontend contract config

After deploying to Sepolia, copy the ABI and contract address into the frontend:

- ABI source: `deployments/sepolia/SecretPlay.json` (copy the ABI array only)
- Frontend config: `home/src/config/contracts.ts`

Set `CONTRACT_ADDRESS` to the deployed address and replace `CONTRACT_ABI` with the ABI array.

### Run the frontend

```bash
cd home
npm install
npm run dev
```

Connect a wallet to Sepolia and use the UI to buy gold, build, and decrypt.

## Hardhat tasks

The `tasks/SecretPlay.ts` file exposes CLI helpers for encrypted flows:

- `npx hardhat --network localhost task:buy-gold --eth 0.001`
- `npx hardhat --network localhost task:build --building 2`
- `npx hardhat --network localhost task:decrypt-balance`
- `npx hardhat --network localhost task:decrypt-building`

Use `npx hardhat task:address` to print the deployed contract address.

## Usage flow (UI)

1. Connect wallet.
2. Buy encrypted gold with ETH.
3. Select a building and submit encrypted input.
4. Decrypt balance or building when ready.

## Limitations and considerations

- Encrypted state can only be decrypted by the wallet that owns it.
- Contract reads return encrypted handles, not clear values.
- Building selection only stores the latest choice per player.
- The frontend expects a valid Sepolia deployment and ABI in `home/src/config/contracts.ts`.

## Future roadmap

- Multi-building inventory with encrypted counts.
- Encrypted leaderboard and achievement badges.
- Time-based upgrades and build queues using encrypted timestamps.
- Gas and UX optimizations for larger encrypted state.
- Optional contract events for frontend analytics without exposing plaintext.

## License

BSD-3-Clause-Clear. See `LICENSE`.
