"use strict";
/**
 * GrimSwap ZK SDK
 *
 * SDK for generating ZK proofs for private swaps on GrimSwap.
 *
 * @example
 * ```typescript
 * import {
 *   createDepositNote,
 *   MerkleTree,
 *   generateProofForRelayer,
 * } from '@grimswap/circuits-sdk';
 *
 * // 1. Create deposit note
 * const note = await createDepositNote(parseEther("1"));
 *
 * // 2. Get commitment for on-chain deposit
 * const commitment = formatCommitmentForContract(note.commitment);
 * // Submit commitment to GrimPool.deposit(commitment)
 *
 * // 3. After deposit confirmed, build Merkle proof
 * const tree = new MerkleTree();
 * await tree.initialize();
 * // Insert all commitments from contract events
 * for (const c of commitments) {
 *   await tree.insert(c);
 * }
 * const merkleProof = tree.getProof(note.leafIndex);
 *
 * // 4. Generate ZK proof
 * const { proof, publicSignals } = await generateProofForRelayer(
 *   note,
 *   merkleProof,
 *   {
 *     recipient: stealthAddress,
 *     relayer: relayerAddress,
 *     relayerFee: 10, // 0.1%
 *     expectedAmountOut: expectedOutput,
 *   }
 * );
 *
 * // 5. Submit to relayer
 * await fetch('/relay', {
 *   method: 'POST',
 *   body: JSON.stringify({ proof, publicSignals, swapParams }),
 * });
 * ```
 *
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPoseidon = exports.computeExpectedPublicSignals = exports.generateProofForRelayer = exports.verifyProofLocally = exports.encodeProofAsHookData = exports.formatProofForContract = exports.generateProof = exports.formatProofForCircuit = exports.buildMerkleTree = exports.verifyMerkleProof = exports.ZERO_VALUE = exports.MERKLE_TREE_HEIGHT = exports.MerkleTree = exports.formatCommitmentForContract = exports.deserializeNote = exports.serializeNote = exports.reconstructDepositNote = exports.createDepositNote = exports.computeNullifierHash = exports.computeCommitment = exports.poseidonHash = exports.initPoseidon = void 0;
// Commitment functions
var commitment_1 = require("./commitment");
Object.defineProperty(exports, "initPoseidon", { enumerable: true, get: function () { return commitment_1.initPoseidon; } });
Object.defineProperty(exports, "poseidonHash", { enumerable: true, get: function () { return commitment_1.poseidonHash; } });
Object.defineProperty(exports, "computeCommitment", { enumerable: true, get: function () { return commitment_1.computeCommitment; } });
Object.defineProperty(exports, "computeNullifierHash", { enumerable: true, get: function () { return commitment_1.computeNullifierHash; } });
Object.defineProperty(exports, "createDepositNote", { enumerable: true, get: function () { return commitment_1.createDepositNote; } });
Object.defineProperty(exports, "reconstructDepositNote", { enumerable: true, get: function () { return commitment_1.reconstructDepositNote; } });
Object.defineProperty(exports, "serializeNote", { enumerable: true, get: function () { return commitment_1.serializeNote; } });
Object.defineProperty(exports, "deserializeNote", { enumerable: true, get: function () { return commitment_1.deserializeNote; } });
Object.defineProperty(exports, "formatCommitmentForContract", { enumerable: true, get: function () { return commitment_1.formatCommitmentForContract; } });
// Merkle tree
var merkle_1 = require("./merkle");
Object.defineProperty(exports, "MerkleTree", { enumerable: true, get: function () { return merkle_1.MerkleTree; } });
Object.defineProperty(exports, "MERKLE_TREE_HEIGHT", { enumerable: true, get: function () { return merkle_1.MERKLE_TREE_HEIGHT; } });
Object.defineProperty(exports, "ZERO_VALUE", { enumerable: true, get: function () { return merkle_1.ZERO_VALUE; } });
Object.defineProperty(exports, "verifyMerkleProof", { enumerable: true, get: function () { return merkle_1.verifyMerkleProof; } });
Object.defineProperty(exports, "buildMerkleTree", { enumerable: true, get: function () { return merkle_1.buildMerkleTree; } });
Object.defineProperty(exports, "formatProofForCircuit", { enumerable: true, get: function () { return merkle_1.formatProofForCircuit; } });
// Proof generation
var proof_1 = require("./proof");
Object.defineProperty(exports, "generateProof", { enumerable: true, get: function () { return proof_1.generateProof; } });
Object.defineProperty(exports, "formatProofForContract", { enumerable: true, get: function () { return proof_1.formatProofForContract; } });
Object.defineProperty(exports, "encodeProofAsHookData", { enumerable: true, get: function () { return proof_1.encodeProofAsHookData; } });
Object.defineProperty(exports, "verifyProofLocally", { enumerable: true, get: function () { return proof_1.verifyProofLocally; } });
Object.defineProperty(exports, "generateProofForRelayer", { enumerable: true, get: function () { return proof_1.generateProofForRelayer; } });
Object.defineProperty(exports, "computeExpectedPublicSignals", { enumerable: true, get: function () { return proof_1.computeExpectedPublicSignals; } });
// Re-export commonly used utilities
var circomlibjs_1 = require("circomlibjs");
Object.defineProperty(exports, "buildPoseidon", { enumerable: true, get: function () { return circomlibjs_1.buildPoseidon; } });
//# sourceMappingURL=index.js.map