# GrimSwap ZK Circuits

Groth16 ZK-SNARK circuits for privacy-preserving swaps on Uniswap v4.

## Overview

This package contains the Circom circuits that prove:

1. **Membership**: User has deposited funds (commitment in Merkle tree)
2. **Non-double-spend**: Nullifier has not been used before
3. **Validity**: Output goes to a valid stealth address

## Circuit Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    privateSwap.circom                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Public Inputs:                                             │
│  ├── merkleRoot        (current root of deposit tree)       │
│  ├── nullifierHash     (prevents double-spend)              │
│  ├── recipient         (stealth address)                    │
│  └── relayerFee        (fee for gas payment)                │
│                                                             │
│  Private Inputs:                                            │
│  ├── secret            (256-bit random)                     │
│  ├── nullifier         (256-bit random)                     │
│  ├── amount            (deposit amount)                     │
│  ├── pathElements[20]  (Merkle proof siblings)              │
│  └── pathIndices[20]   (path direction: 0=left, 1=right)    │
│                                                             │
│  Constraints:                                               │
│  1. commitment = Poseidon(nullifier, secret, amount)        │
│  2. MerkleProof(commitment, path) == merkleRoot             │
│  3. nullifierHash == Poseidon(nullifier)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js >= 18
- Circom 2.1.x
- snarkjs 0.7.x

### Install Circom

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh

# Clone and build Circom
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
sudo cp target/release/circom /usr/local/bin/
```

## Installation

```bash
npm install
```

## Build

```bash
# Compile circuits
npm run compile

# Run trusted setup (uses Powers of Tau)
npm run setup

# Generate Solidity verifier
npm run generate-verifier

# Or run all steps:
npm run build
```

## Output Files

After building:

```
build/
├── privateSwap.r1cs           # Circuit constraints
├── privateSwap_js/
│   ├── privateSwap.wasm       # WASM for witness generation
│   └── witness_calculator.js
├── privateSwap.zkey           # Proving key
├── verification_key.json      # Verification key
└── Groth16Verifier.sol        # Solidity verifier contract
```

## Testing

```bash
npm test
```

## Security

- Uses Poseidon hash (ZK-friendly, ~200 constraints)
- Merkle tree height: 20 (supports 1,048,576 deposits)
- Trusted setup: Uses existing Powers of Tau ceremony

## Gas Costs

| Operation | Gas |
|-----------|-----|
| Proof verification | ~190,000 |
| Calldata (472 bytes) | ~8,000 |
| **Total** | **~198,000** |

## License

MIT
