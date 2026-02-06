# @grimswap/circuits

ZK-SNARK SDK for privacy-preserving swaps on Uniswap v4.

Deposit ETH, then swap privately through stealth addresses — no link between depositor and recipient.

## Install

```bash
npm install @grimswap/circuits
```

## Quick Start (10 lines)

```typescript
import {
  createDepositNote,
  formatCommitmentForContract,
  executePrivateSwap,
  UNICHAIN_SEPOLIA_ADDRESSES,
} from "@grimswap/circuits";

// 1. Create deposit note + deposit on-chain
const note = await createDepositNote(parseEther("1"));
const commitment = formatCommitmentForContract(note.commitment);
// → call GrimPool.deposit(commitment, { value: parseEther("1") })
// → save note.leafIndex from the Deposit event

// 2. Load circuit files (host on your CDN or copy from node_modules)
const wasm = await fetch("/circuits/privateSwap.wasm").then(r => r.arrayBuffer());
const zkey = await fetch("/circuits/privateSwap.zkey").then(r => r.arrayBuffer());

// 3. Execute private swap — builds tree, generates proof, submits to relayer
const result = await executePrivateSwap({
  note,
  recipient: stealthAddress,
  poolKey: {
    currency0: "0x0000000000000000000000000000000000000000",
    currency1: tokenAddress,
    fee: 3000,
    tickSpacing: 60,
    hooks: UNICHAIN_SEPOLIA_ADDRESSES.grimSwapZK,
  },
  zeroForOne: true,
  amountSpecified: -note.amount,
  wasmBuffer: wasm,
  zkeyBuffer: zkey,
});

console.log(result.txHash); // done!
```

## Setup Circuit Files

Copy the WASM and zkey files to your app's public directory:

```bash
npx grimswap-copy-circuits public/circuits
```

Or manually copy from `node_modules/@grimswap/circuits/build/`.

## Step-by-Step Integration

### 1. Deposit

```typescript
import {
  createDepositNote,
  formatCommitmentForContract,
  serializeNote,
  GRIM_POOL_ABI,
  UNICHAIN_SEPOLIA_ADDRESSES,
} from "@grimswap/circuits";

const note = await createDepositNote(parseEther("1"));
const commitment = formatCommitmentForContract(note.commitment);

// Deposit on-chain (use viem, ethers, or wagmi)
const tx = await walletClient.writeContract({
  address: UNICHAIN_SEPOLIA_ADDRESSES.grimPool,
  abi: GRIM_POOL_ABI,
  functionName: "deposit",
  args: [commitment],
  value: parseEther("1"),
});

// Save the note — user needs it to withdraw!
// Set leafIndex from the Deposit event
note.leafIndex = depositEvent.args.leafIndex;
const saved = serializeNote(note);
localStorage.setItem("grimswap_note", saved);
```

### 2. Add Merkle Root (Testnet Only)

```typescript
const { fetchDeposits, buildMerkleTree } = await import("@grimswap/circuits");

const commitments = await fetchDeposits();
const tree = await buildMerkleTree(commitments);
const merkleProof = tree.getProof(note.leafIndex);

// Testnet: depositor adds their own root
const rootHex = "0x" + merkleProof.root.toString(16).padStart(64, "0");
await walletClient.writeContract({
  address: UNICHAIN_SEPOLIA_ADDRESSES.grimPool,
  abi: GRIM_POOL_ABI,
  functionName: "addKnownRoot",
  args: [rootHex],
});
```

### 3. Private Swap

Use `executePrivateSwap()` (recommended) or build manually:

```typescript
import {
  generateProofFromBuffers,
  formatProofForContract,
  submitToRelayer,
  getRelayerInfo,
} from "@grimswap/circuits";

// Get relayer info
const relayer = await getRelayerInfo();

// Generate proof
const { proof, publicSignals } = await generateProofFromBuffers(
  note, merkleProof,
  {
    recipient: stealthAddress,
    relayer: relayer.address,
    relayerFee: relayer.fee,
    expectedAmountOut: note.amount,
  },
  wasmBuffer, zkeyBuffer
);

// Format and submit
const formatted = formatProofForContract(proof, publicSignals);
const result = await submitToRelayer(
  undefined, // uses default relayer URL
  { a: formatted.pA, b: formatted.pB, c: formatted.pC },
  formatted.pubSignals,
  {
    poolKey,
    zeroForOne: true,
    amountSpecified: (-note.amount).toString(),
    sqrtPriceLimitX96: "4295128740",
  }
);
```

## API Reference

### High-Level

| Function | Description |
|----------|-------------|
| `executePrivateSwap(params)` | Complete private swap in one call |
| `fetchDeposits(rpcUrl?)` | Fetch all deposit commitments from GrimPool |
| `fetchDepositEvents(rpcUrl?)` | Fetch deposits with full metadata |
| `getDepositCount(rpcUrl?)` | Get current deposit count |

### Proof Generation

| Function | Environment | Description |
|----------|-------------|-------------|
| `generateProofFromBuffers()` | Browser + Node | Generate proof from in-memory buffers |
| `generateProof()` | Node.js only | Generate proof from file paths |
| `formatProofForContract()` | Both | Format proof for Solidity |

### Commitment & Merkle Tree

| Function | Description |
|----------|-------------|
| `createDepositNote(amount)` | Create deposit note with random secret + nullifier |
| `formatCommitmentForContract(commitment)` | Format as bytes32 for deposit tx |
| `serializeNote(note)` / `deserializeNote(str)` | Save/restore note |
| `buildMerkleTree(commitments)` | Build Poseidon Merkle tree |

### Relayer Client

| Function | Description |
|----------|-------------|
| `submitToRelayer(url, proof, signals, swapParams)` | Submit proof for execution |
| `getRelayerInfo(url?)` | Get relayer address and fee |
| `checkRelayerHealth(url?)` | Check if relayer is online |

### Stealth Addresses (ERC-5564)

| Function | Description |
|----------|-------------|
| `generateStealthKeys()` | Generate spending + viewing key pair |
| `generateStealthAddress(metaAddress)` | Derive one-time stealth address |
| `scanAnnouncements(params)` | Scan chain for payments to you |

### Claiming from Stealth Addresses

| Function | Description |
|----------|-------------|
| `claimStealthTokens(params)` | Sweep ERC20 tokens from stealth address to your wallet |
| `getStealthBalance(...)` | Check token balance at stealth address |
| `getStealthEthBalance(...)` | Check ETH balance (gas availability) |

### Constants & ABIs

```typescript
import {
  UNICHAIN_SEPOLIA_ADDRESSES,  // All contract addresses
  GRIM_POOL_ABI,               // deposit, isSpent, getLastRoot, addKnownRoot
  GRIM_SWAP_ROUTER_ABI,        // executePrivateSwap
  GRIM_SWAP_ZK_ABI,            // Hook events
  GROTH16_VERIFIER_ABI,        // verifyProof
  RELAYER_DEFAULT_URL,          // https://services.grimswap.com
} from "@grimswap/circuits";
```

### Types

```typescript
import type {
  DepositNote,
  MerkleProof,
  SwapParams,
  PoolKey,
  PrivateSwapParams,
  RelayerRequest,
  RelayerResponse,
  DepositEvent,
  Groth16Proof,
  ContractProof,
  StealthKeys,
  ClaimParams,
  ClaimResult,
  GrimAddresses,
  ChainConfig,
} from "@grimswap/circuits";
```

## Contract Addresses (Unichain Sepolia)

| Contract | Address |
|----------|---------|
| GrimPool | `0xEAB5E7B4e715A22E8c114B7476eeC15770B582bb` |
| GrimSwapZK (Hook) | `0x3bee7D1A5914d1ccD34D2a2d00C359D0746400C4` |
| GrimSwapRouter | `0xC13a6a504da21aD23c748f08d3E991621D42DA4F` |
| Groth16Verifier | `0xF7D14b744935cE34a210D7513471a8E6d6e696a0` |
| PoolManager | `0x00B036B58a818B1BC34d502D3fE730Db729e62AC` |

## Pool Configuration

### Fee/TickSpacing

| Fee | TickSpacing | Use Case |
|-----|-------------|----------|
| 500 | 10 | Stable pairs |
| 3000 | 60 | Most pairs |
| 10000 | 200 | Exotic pairs |

### sqrtPriceX96 for ETH/USDC

For ETH = currency0, USDC = currency1 (6 decimals):
- $2000/ETH: `3543191142285914205922034`
- $3000/ETH: `4339505028714986015908034`

Formula: `sqrt(price_usdc * 10^6 / 10^18) * 2^96`

## Integration Flow

```
User                    Frontend                  GrimPool          Relayer          Router
 |                         |                         |                 |                |
 |  deposit 1 ETH          |                         |                 |                |
 |------------------------>|  deposit(commitment)     |                 |                |
 |                         |------------------------>|                 |                |
 |                         |                         |                 |                |
 |  swap privately         |                         |                 |                |
 |------------------------>|  executePrivateSwap()    |                 |                |
 |                         |  1. fetchDeposits()      |                 |                |
 |                         |  2. buildMerkleTree()    |                 |                |
 |                         |  3. generateProof()      |                 |                |
 |                         |  4. submitToRelayer() ---|---------------->|                |
 |                         |                         |                 |                |
 |                         |                         |  executePrivateSwap              |
 |                         |                         |<----------------|--------------->|
 |                         |                         |                 |                |
 |                         |  { txHash, success }     |                 |                |
 |                         |<-----------------------------------------|                |
 |                         |                         |                 |                |
 |  tokens at stealth addr |                         |                 |                |
 |<------------------------|                         |                 |                |
```

## 4. Claim Tokens from Stealth Address

After a private swap, tokens land at a stealth address. The relayer automatically funds it with ETH for gas. Use `claimStealthTokens()` to sweep tokens to your wallet:

```typescript
import {
  claimStealthTokens,
  getStealthBalance,
} from "@grimswap/circuits";

// Check balance first
const { stealthAddress, balance } = await getStealthBalance(
  keys.spendingPrivateKey,
  keys.viewingPrivateKey,
  stealth.ephemeralPubKey,
  outputTokenAddress,
);

console.log(`${balance} tokens at ${stealthAddress}`);

// Sweep tokens to your wallet
const result = await claimStealthTokens({
  spendingPrivateKey: keys.spendingPrivateKey,
  viewingPrivateKey: keys.viewingPrivateKey,
  ephemeralPubKey: stealth.ephemeralPubKey,
  tokenAddress: outputTokenAddress,
  toAddress: "0xYourWallet...",
});

console.log(result.txHash); // claimed!
```

No ethers/viem dependency required — works via raw JSON-RPC.

## Circuit Architecture

```
Public Inputs:                          Private Inputs:
  merkleRoot                              secret (256-bit random)
  nullifierHash                           nullifier (256-bit random)
  recipient (stealth address)             amount (deposit amount)
  relayerFee                              pathElements[20] (siblings)
                                          pathIndices[20] (directions)

Constraints:
  1. commitment = Poseidon(nullifier, secret, amount)
  2. MerkleProof(commitment, path) == merkleRoot
  3. nullifierHash == Poseidon(nullifier)
```

## Building Circuits from Source

```bash
npm install
npm run compile           # Compile Circom circuits
npm run setup             # Trusted setup (Powers of Tau)
npm run generate-verifier # Solidity verifier
```

Requires Circom 2.1.x and Node.js >= 18.

## License

MIT
