pragma circom 2.1.6;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/switcher.circom";

/**
 * MerkleTreeChecker - Verifies a Merkle proof using Poseidon hash
 *
 * This circuit proves that a leaf is included in a Merkle tree
 * without revealing which leaf position.
 *
 * @param levels - Height of the Merkle tree (20 = 2^20 = 1M leaves)
 */
template MerkleTreeChecker(levels) {
    signal input leaf;                      // The leaf to prove membership of
    signal input root;                      // The expected Merkle root
    signal input pathElements[levels];      // Sibling hashes along the path
    signal input pathIndices[levels];       // 0 = left, 1 = right for each level

    // Intermediate hash values
    signal hashes[levels + 1];
    hashes[0] <== leaf;

    // Hash up the tree
    component hashers[levels];
    component switchers[levels];

    for (var i = 0; i < levels; i++) {
        // Ensure pathIndices are binary (0 or 1)
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        // Switcher determines order of inputs based on pathIndex
        // If pathIndex = 0, leaf is on the left
        // If pathIndex = 1, leaf is on the right
        switchers[i] = Switcher();
        switchers[i].sel <== pathIndices[i];
        switchers[i].L <== hashes[i];
        switchers[i].R <== pathElements[i];

        // Poseidon hash of the two children
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== switchers[i].outL;
        hashers[i].inputs[1] <== switchers[i].outR;

        hashes[i + 1] <== hashers[i].out;
    }

    // Final hash must equal the root
    root === hashes[levels];
}

/**
 * HashLeftRight - Helper to hash two values with Poseidon
 */
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    hash <== hasher.out;
}

/**
 * DualMux - Multiplexer for two inputs
 * If sel = 0: out = [in0, in1]
 * If sel = 1: out = [in1, in0]
 */
template DualMux() {
    signal input in[2];
    signal input sel;
    signal output out[2];

    sel * (1 - sel) === 0;  // sel must be 0 or 1
    out[0] <== (in[1] - in[0]) * sel + in[0];
    out[1] <== (in[0] - in[1]) * sel + in[1];
}

/**
 * Switcher - Alternative implementation using DualMux
 * Swaps L and R based on sel
 */
template Switcher() {
    signal input sel;
    signal input L;
    signal input R;
    signal output outL;
    signal output outR;

    component mux = DualMux();
    mux.in[0] <== L;
    mux.in[1] <== R;
    mux.sel <== sel;
    outL <== mux.out[0];
    outR <== mux.out[1];
}

/**
 * MerkleTreeUpdater - For computing new root after insertion
 * (Used by the pool contract, not for proving)
 */
template MerkleTreeUpdater(levels) {
    signal input oldLeaf;
    signal input newLeaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal output oldRoot;
    signal output newRoot;

    component oldChecker = MerkleTreeChecker(levels);
    component newChecker = MerkleTreeChecker(levels);

    // Check old leaf and get old root
    oldChecker.leaf <== oldLeaf;
    for (var i = 0; i < levels; i++) {
        oldChecker.pathElements[i] <== pathElements[i];
        oldChecker.pathIndices[i] <== pathIndices[i];
    }

    // Compute new root with new leaf
    newChecker.leaf <== newLeaf;
    for (var i = 0; i < levels; i++) {
        newChecker.pathElements[i] <== pathElements[i];
        newChecker.pathIndices[i] <== pathIndices[i];
    }

    // We need to verify against roots, but for updater we compute them
    // This is a simplified version - in practice roots come from contract
    oldRoot <== oldChecker.root;
    newRoot <== newChecker.root;
}

/**
 * LeafIndexToPathIndices - Convert leaf index to binary path
 */
template LeafIndexToPathIndices(levels) {
    signal input leafIndex;
    signal output pathIndices[levels];

    component bits = Num2Bits(levels);
    bits.in <== leafIndex;

    for (var i = 0; i < levels; i++) {
        pathIndices[i] <== bits.out[i];
    }
}
