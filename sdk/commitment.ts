/**
 * GrimSwap ZK SDK - Commitment Generation
 *
 * Handles creating deposit notes with commitments and nullifier hashes.
 * The commitment is what gets stored in the Merkle tree on-chain.
 */

import { buildPoseidon } from "circomlibjs";
import { randomBytes } from "crypto";
import type { DepositNote } from "./types";

let poseidon: any;
let F: any;

/**
 * Initialize the Poseidon hasher
 * Must be called before using other functions
 */
export async function initPoseidon(): Promise<void> {
  if (!poseidon) {
    poseidon = await buildPoseidon();
    F = poseidon.F;
  }
}

/**
 * Generate cryptographically secure random field element
 */
function randomFieldElement(): bigint {
  // BN254 field modulus
  const FIELD_SIZE = BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617"
  );

  // Generate 32 random bytes and reduce modulo field size
  const bytes = randomBytes(32);
  const num = BigInt("0x" + bytes.toString("hex"));
  return num % FIELD_SIZE;
}

/**
 * Compute Poseidon hash
 * @param inputs - Array of bigints to hash
 * @returns Hash as bigint
 */
export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  await initPoseidon();
  const hash = poseidon(inputs);
  return BigInt(F.toString(hash));
}

/**
 * Compute commitment = Poseidon(nullifier, secret, amount)
 * @param nullifier - Random nullifier
 * @param secret - Random secret
 * @param amount - Deposit amount in wei
 * @returns Commitment as bigint
 */
export async function computeCommitment(
  nullifier: bigint,
  secret: bigint,
  amount: bigint
): Promise<bigint> {
  return poseidonHash([nullifier, secret, amount]);
}

/**
 * Compute nullifier hash = Poseidon(nullifier)
 * @param nullifier - The nullifier
 * @returns Nullifier hash as bigint
 */
export async function computeNullifierHash(nullifier: bigint): Promise<bigint> {
  return poseidonHash([nullifier]);
}

/**
 * Create a new deposit note
 * This generates all the secret values needed for a deposit
 *
 * @param amount - Deposit amount in wei
 * @returns DepositNote containing all deposit information
 */
export async function createDepositNote(amount: bigint): Promise<DepositNote> {
  await initPoseidon();

  // Generate random secret and nullifier
  const secret = randomFieldElement();
  const nullifier = randomFieldElement();

  // Compute commitment and nullifier hash
  const commitment = await computeCommitment(nullifier, secret, amount);
  const nullifierHash = await computeNullifierHash(nullifier);

  return {
    secret,
    nullifier,
    amount,
    commitment,
    nullifierHash,
  };
}

/**
 * Reconstruct a deposit note from saved data
 *
 * @param secret - The secret value
 * @param nullifier - The nullifier value
 * @param amount - The deposit amount
 * @param leafIndex - Optional leaf index in Merkle tree
 * @returns Reconstructed DepositNote
 */
export async function reconstructDepositNote(
  secret: bigint,
  nullifier: bigint,
  amount: bigint,
  leafIndex?: number
): Promise<DepositNote> {
  const commitment = await computeCommitment(nullifier, secret, amount);
  const nullifierHash = await computeNullifierHash(nullifier);

  return {
    secret,
    nullifier,
    amount,
    commitment,
    nullifierHash,
    leafIndex,
  };
}

/**
 * Serialize a deposit note to a string for storage
 * Format: grimswap-v1-<secret>-<nullifier>-<amount>
 *
 * @param note - The deposit note
 * @returns Serialized note string
 */
export function serializeNote(note: DepositNote): string {
  const secretHex = note.secret.toString(16).padStart(64, "0");
  const nullifierHex = note.nullifier.toString(16).padStart(64, "0");
  const amountHex = note.amount.toString(16);
  return `grimswap-v1-${secretHex}-${nullifierHex}-${amountHex}`;
}

/**
 * Deserialize a deposit note from string
 *
 * @param noteString - Serialized note string
 * @returns Promise<DepositNote>
 */
export async function deserializeNote(noteString: string): Promise<DepositNote> {
  const parts = noteString.split("-");
  if (parts.length !== 5 || parts[0] !== "grimswap" || parts[1] !== "v1") {
    throw new Error("Invalid note format");
  }

  const secret = BigInt("0x" + parts[2]);
  const nullifier = BigInt("0x" + parts[3]);
  const amount = BigInt("0x" + parts[4]);

  return reconstructDepositNote(secret, nullifier, amount);
}

/**
 * Format commitment for smart contract (bytes32)
 */
export function formatCommitmentForContract(commitment: bigint): string {
  return "0x" + commitment.toString(16).padStart(64, "0");
}
