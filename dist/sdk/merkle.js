"use strict";
/**
 * GrimSwap ZK SDK - Merkle Tree Operations
 *
 * Handles Merkle tree construction and proof generation.
 * Uses Poseidon hash to match the circuit.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerkleTree = exports.ZERO_VALUE = exports.MERKLE_TREE_HEIGHT = void 0;
exports.verifyMerkleProof = verifyMerkleProof;
exports.buildMerkleTree = buildMerkleTree;
exports.formatProofForCircuit = formatProofForCircuit;
const commitment_1 = require("./commitment");
// Default tree height (2^20 = ~1M leaves)
exports.MERKLE_TREE_HEIGHT = 20;
// Zero value for empty leaves (same as GrimPool.sol)
exports.ZERO_VALUE = BigInt("21663839004416932945382355908790599225266501822907911457504978515578255421292");
/**
 * Simple in-memory Merkle tree
 * For production, this would be replaced with a more efficient implementation
 */
class MerkleTree {
    constructor(height = exports.MERKLE_TREE_HEIGHT) {
        this.height = height;
        this.leaves = [];
        this.zeros = [];
        this.layers = [];
    }
    /**
     * Initialize the tree with precomputed zeros
     */
    async initialize() {
        await (0, commitment_1.initPoseidon)();
        // Compute zero values for each level
        this.zeros = [exports.ZERO_VALUE];
        for (let i = 1; i <= this.height; i++) {
            const prevZero = this.zeros[i - 1];
            this.zeros[i] = await (0, commitment_1.poseidonHash)([prevZero, prevZero]);
        }
        // Initialize layers with zeros
        this.layers = [];
        for (let i = 0; i <= this.height; i++) {
            this.layers[i] = [];
        }
    }
    /**
     * Insert a leaf into the tree
     * @param leaf - The commitment to insert
     * @returns Index of the inserted leaf
     */
    async insert(leaf) {
        if (this.zeros.length === 0) {
            await this.initialize();
        }
        const index = this.leaves.length;
        this.leaves.push(leaf);
        // Update the tree
        await this.updateTree(index);
        return index;
    }
    /**
     * Update tree after insertion
     */
    async updateTree(index) {
        let currentIndex = index;
        let currentValue = this.leaves[index];
        this.layers[0][index] = currentValue;
        for (let level = 0; level < this.height; level++) {
            const isLeft = currentIndex % 2 === 0;
            const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
            // Get sibling value (or zero if doesn't exist)
            const sibling = this.layers[level][siblingIndex] ?? this.zeros[level];
            // Compute parent
            const [left, right] = isLeft
                ? [currentValue, sibling]
                : [sibling, currentValue];
            currentValue = await (0, commitment_1.poseidonHash)([left, right]);
            currentIndex = Math.floor(currentIndex / 2);
            this.layers[level + 1][currentIndex] = currentValue;
        }
    }
    /**
     * Get the current root
     */
    getRoot() {
        if (this.layers[this.height] && this.layers[this.height][0]) {
            return this.layers[this.height][0];
        }
        // Return zero root if tree is empty
        return this.zeros[this.height];
    }
    /**
     * Generate Merkle proof for a leaf
     * @param leafIndex - Index of the leaf
     * @returns MerkleProof
     */
    getProof(leafIndex) {
        if (leafIndex >= this.leaves.length) {
            throw new Error("Leaf index out of bounds");
        }
        const pathElements = [];
        const pathIndices = [];
        let currentIndex = leafIndex;
        for (let level = 0; level < this.height; level++) {
            const isLeft = currentIndex % 2 === 0;
            const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
            // Get sibling value (or zero if doesn't exist)
            const sibling = this.layers[level][siblingIndex] ?? this.zeros[level];
            pathElements.push(sibling);
            pathIndices.push(isLeft ? 0 : 1);
            currentIndex = Math.floor(currentIndex / 2);
        }
        return {
            root: this.getRoot(),
            pathElements,
            pathIndices,
        };
    }
    /**
     * Get the number of leaves
     */
    get leafCount() {
        return this.leaves.length;
    }
}
exports.MerkleTree = MerkleTree;
/**
 * Verify a Merkle proof
 * @param leaf - The leaf value
 * @param proof - The Merkle proof
 * @returns True if valid
 */
async function verifyMerkleProof(leaf, proof) {
    await (0, commitment_1.initPoseidon)();
    let current = leaf;
    for (let i = 0; i < proof.pathElements.length; i++) {
        const sibling = proof.pathElements[i];
        const isLeft = proof.pathIndices[i] === 0;
        const [left, right] = isLeft ? [current, sibling] : [sibling, current];
        current = await (0, commitment_1.poseidonHash)([left, right]);
    }
    return current === proof.root;
}
/**
 * Build a Merkle tree from a list of leaves
 * @param leaves - Array of commitments
 * @returns MerkleTree instance
 */
async function buildMerkleTree(leaves) {
    const tree = new MerkleTree();
    await tree.initialize();
    for (const leaf of leaves) {
        await tree.insert(leaf);
    }
    return tree;
}
/**
 * Format Merkle proof for circuit input
 */
function formatProofForCircuit(proof) {
    return {
        pathElements: proof.pathElements.map((e) => e.toString()),
        pathIndices: proof.pathIndices,
    };
}
//# sourceMappingURL=merkle.js.map