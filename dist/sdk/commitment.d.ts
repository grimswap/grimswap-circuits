/**
 * GrimSwap ZK SDK - Commitment Generation
 *
 * Handles creating deposit notes with commitments and nullifier hashes.
 * The commitment is what gets stored in the Merkle tree on-chain.
 */
import type { DepositNote } from "./types";
/**
 * Initialize the Poseidon hasher
 * Must be called before using other functions
 */
export declare function initPoseidon(): Promise<void>;
/**
 * Compute Poseidon hash
 * @param inputs - Array of bigints to hash
 * @returns Hash as bigint
 */
export declare function poseidonHash(inputs: bigint[]): Promise<bigint>;
/**
 * Compute commitment = Poseidon(nullifier, secret, amount)
 * @param nullifier - Random nullifier
 * @param secret - Random secret
 * @param amount - Deposit amount in wei
 * @returns Commitment as bigint
 */
export declare function computeCommitment(nullifier: bigint, secret: bigint, amount: bigint): Promise<bigint>;
/**
 * Compute nullifier hash = Poseidon(nullifier)
 * @param nullifier - The nullifier
 * @returns Nullifier hash as bigint
 */
export declare function computeNullifierHash(nullifier: bigint): Promise<bigint>;
/**
 * Create a new deposit note
 * This generates all the secret values needed for a deposit
 *
 * @param amount - Deposit amount in wei
 * @returns DepositNote containing all deposit information
 */
export declare function createDepositNote(amount: bigint): Promise<DepositNote>;
/**
 * Reconstruct a deposit note from saved data
 *
 * @param secret - The secret value
 * @param nullifier - The nullifier value
 * @param amount - The deposit amount
 * @param leafIndex - Optional leaf index in Merkle tree
 * @returns Reconstructed DepositNote
 */
export declare function reconstructDepositNote(secret: bigint, nullifier: bigint, amount: bigint, leafIndex?: number): Promise<DepositNote>;
/**
 * Serialize a deposit note to a string for storage
 * Format: grimswap-v1-<secret>-<nullifier>-<amount>
 *
 * @param note - The deposit note
 * @returns Serialized note string
 */
export declare function serializeNote(note: DepositNote): string;
/**
 * Deserialize a deposit note from string
 *
 * @param noteString - Serialized note string
 * @returns Promise<DepositNote>
 */
export declare function deserializeNote(noteString: string): Promise<DepositNote>;
/**
 * Format commitment for smart contract (bytes32)
 */
export declare function formatCommitmentForContract(commitment: bigint): string;
//# sourceMappingURL=commitment.d.ts.map