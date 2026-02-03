pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "./merkleTree.circom";

/**
 * PrivateSwap - Main ZK circuit for GrimSwap
 *
 * Proves:
 * 1. User knows (secret, nullifier) that hash to a commitment in the Merkle tree
 * 2. nullifierHash is correctly computed (for double-spend prevention)
 * 3. User has the right to withdraw the deposited amount
 *
 * @param levels - Merkle tree height (20 = 2^20 = ~1M deposits)
 */
template PrivateSwap(levels) {
    // ═══════════════════════════════════════════════════════════════════
    // PUBLIC INPUTS (visible on-chain, part of the proof)
    // ═══════════════════════════════════════════════════════════════════

    signal input merkleRoot;        // Current Merkle root of the deposit pool
    signal input nullifierHash;     // Hash of nullifier (stored on-chain to prevent reuse)
    signal input recipient;         // Stealth address to receive swap output
    signal input relayer;           // Relayer address (or 0 if self-relay)
    signal input relayerFee;        // Fee for relayer (in basis points or wei)
    signal input swapAmountOut;     // Expected output amount from swap

    // ═══════════════════════════════════════════════════════════════════
    // PRIVATE INPUTS (hidden, only prover knows)
    // ═══════════════════════════════════════════════════════════════════

    signal input secret;                    // Random 256-bit secret (user keeps safe)
    signal input nullifier;                 // Random 256-bit nullifier (user keeps safe)
    signal input depositAmount;             // Amount deposited (for amount-specific pools)
    signal input pathElements[levels];      // Merkle proof: sibling hashes
    signal input pathIndices[levels];       // Merkle proof: path directions (0=left, 1=right)

    // ═══════════════════════════════════════════════════════════════════
    // COMMITMENT COMPUTATION
    // ═══════════════════════════════════════════════════════════════════

    // commitment = Poseidon(nullifier, secret, depositAmount)
    // This is what was stored in the Merkle tree during deposit
    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== secret;
    commitmentHasher.inputs[2] <== depositAmount;
    signal commitment <== commitmentHasher.out;

    // ═══════════════════════════════════════════════════════════════════
    // MERKLE TREE VERIFICATION
    // ═══════════════════════════════════════════════════════════════════

    // Verify that the commitment is in the Merkle tree
    component merkleChecker = MerkleTreeChecker(levels);
    merkleChecker.leaf <== commitment;
    merkleChecker.root <== merkleRoot;
    for (var i = 0; i < levels; i++) {
        merkleChecker.pathElements[i] <== pathElements[i];
        merkleChecker.pathIndices[i] <== pathIndices[i];
    }

    // ═══════════════════════════════════════════════════════════════════
    // NULLIFIER HASH VERIFICATION
    // ═══════════════════════════════════════════════════════════════════

    // Compute nullifier hash (this will be stored on-chain)
    // nullifierHash = Poseidon(nullifier)
    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;

    // Verify the provided nullifierHash matches
    nullifierHash === nullifierHasher.out;

    // ═══════════════════════════════════════════════════════════════════
    // RECIPIENT VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    // Ensure recipient is not zero (would burn funds)
    component recipientNotZero = IsZero();
    recipientNotZero.in <== recipient;
    recipientNotZero.out === 0;  // recipient != 0

    // ═══════════════════════════════════════════════════════════════════
    // RELAYER FEE VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    // Fee must be less than 10% (1000 basis points) - sanity check
    // This is optional but prevents relayer from taking everything
    component feeCheck = LessThan(64);
    feeCheck.in[0] <== relayerFee;
    feeCheck.in[1] <== 1000;  // Max 10%
    feeCheck.out === 1;

    // If relayer is 0, fee must be 0
    component relayerIsZero = IsZero();
    relayerIsZero.in <== relayer;
    // If relayer == 0, then relayerFee must == 0
    // Constraint: relayerIsZero.out * relayerFee === 0
    relayerIsZero.out * relayerFee === 0;

    // ═══════════════════════════════════════════════════════════════════
    // OUTPUT SIGNALS (for logging/debugging, not constraints)
    // ═══════════════════════════════════════════════════════════════════

    // These can be used to verify the circuit outputs match expectations
    signal output computedCommitment <== commitment;
    signal output computedNullifierHash <== nullifierHasher.out;
}

/**
 * Commitment - Compute deposit commitment
 * Used by SDK to generate commitment for deposit
 */
template Commitment() {
    signal input nullifier;
    signal input secret;
    signal input amount;
    signal output commitment;

    component hasher = Poseidon(3);
    hasher.inputs[0] <== nullifier;
    hasher.inputs[1] <== secret;
    hasher.inputs[2] <== amount;
    commitment <== hasher.out;
}

/**
 * NullifierHash - Compute nullifier hash
 * Used for double-spend prevention
 */
template NullifierHash() {
    signal input nullifier;
    signal output nullifierHash;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== nullifier;
    nullifierHash <== hasher.out;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

// Instantiate with 20 levels (supports ~1 million deposits)
component main {public [
    merkleRoot,
    nullifierHash,
    recipient,
    relayer,
    relayerFee,
    swapAmountOut
]} = PrivateSwap(20);
