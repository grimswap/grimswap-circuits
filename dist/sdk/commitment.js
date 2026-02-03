"use strict";
/**
 * GrimSwap ZK SDK - Commitment Generation
 *
 * Handles creating deposit notes with commitments and nullifier hashes.
 * The commitment is what gets stored in the Merkle tree on-chain.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPoseidon = initPoseidon;
exports.poseidonHash = poseidonHash;
exports.computeCommitment = computeCommitment;
exports.computeNullifierHash = computeNullifierHash;
exports.createDepositNote = createDepositNote;
exports.reconstructDepositNote = reconstructDepositNote;
exports.serializeNote = serializeNote;
exports.deserializeNote = deserializeNote;
exports.formatCommitmentForContract = formatCommitmentForContract;
const circomlibjs_1 = require("circomlibjs");
const crypto_1 = require("crypto");
let poseidon;
let F;
/**
 * Initialize the Poseidon hasher
 * Must be called before using other functions
 */
async function initPoseidon() {
    if (!poseidon) {
        poseidon = await (0, circomlibjs_1.buildPoseidon)();
        F = poseidon.F;
    }
}
/**
 * Generate cryptographically secure random field element
 */
function randomFieldElement() {
    // BN254 field modulus
    const FIELD_SIZE = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    // Generate 32 random bytes and reduce modulo field size
    const bytes = (0, crypto_1.randomBytes)(32);
    const num = BigInt("0x" + bytes.toString("hex"));
    return num % FIELD_SIZE;
}
/**
 * Compute Poseidon hash
 * @param inputs - Array of bigints to hash
 * @returns Hash as bigint
 */
async function poseidonHash(inputs) {
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
async function computeCommitment(nullifier, secret, amount) {
    return poseidonHash([nullifier, secret, amount]);
}
/**
 * Compute nullifier hash = Poseidon(nullifier)
 * @param nullifier - The nullifier
 * @returns Nullifier hash as bigint
 */
async function computeNullifierHash(nullifier) {
    return poseidonHash([nullifier]);
}
/**
 * Create a new deposit note
 * This generates all the secret values needed for a deposit
 *
 * @param amount - Deposit amount in wei
 * @returns DepositNote containing all deposit information
 */
async function createDepositNote(amount) {
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
async function reconstructDepositNote(secret, nullifier, amount, leafIndex) {
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
function serializeNote(note) {
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
async function deserializeNote(noteString) {
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
function formatCommitmentForContract(commitment) {
    return "0x" + commitment.toString(16).padStart(64, "0");
}
//# sourceMappingURL=commitment.js.map