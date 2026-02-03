/**
 * GrimSwap ZK SDK - Merkle Tree Operations
 *
 * Handles Merkle tree construction and proof generation.
 * Uses Poseidon hash to match the circuit.
 */
import type { MerkleProof } from "./types";
export declare const MERKLE_TREE_HEIGHT = 20;
export declare const ZERO_VALUE: bigint;
/**
 * Simple in-memory Merkle tree
 * For production, this would be replaced with a more efficient implementation
 */
export declare class MerkleTree {
    private height;
    private leaves;
    private zeros;
    private layers;
    constructor(height?: number);
    /**
     * Initialize the tree with precomputed zeros
     */
    initialize(): Promise<void>;
    /**
     * Insert a leaf into the tree
     * @param leaf - The commitment to insert
     * @returns Index of the inserted leaf
     */
    insert(leaf: bigint): Promise<number>;
    /**
     * Update tree after insertion
     */
    private updateTree;
    /**
     * Get the current root
     */
    getRoot(): bigint;
    /**
     * Generate Merkle proof for a leaf
     * @param leafIndex - Index of the leaf
     * @returns MerkleProof
     */
    getProof(leafIndex: number): MerkleProof;
    /**
     * Get the number of leaves
     */
    get leafCount(): number;
}
/**
 * Verify a Merkle proof
 * @param leaf - The leaf value
 * @param proof - The Merkle proof
 * @returns True if valid
 */
export declare function verifyMerkleProof(leaf: bigint, proof: MerkleProof): Promise<boolean>;
/**
 * Build a Merkle tree from a list of leaves
 * @param leaves - Array of commitments
 * @returns MerkleTree instance
 */
export declare function buildMerkleTree(leaves: bigint[]): Promise<MerkleTree>;
/**
 * Format Merkle proof for circuit input
 */
export declare function formatProofForCircuit(proof: MerkleProof): {
    pathElements: string[];
    pathIndices: number[];
};
//# sourceMappingURL=merkle.d.ts.map