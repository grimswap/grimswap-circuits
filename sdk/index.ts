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

// Types
export type {
  Groth16Proof,
  PublicSignals,
  PrivateInputs,
  CircuitInput,
  DepositNote,
  ContractProof,
  MerkleProof,
  SwapParams,
} from "./types";

// Commitment functions
export {
  initPoseidon,
  poseidonHash,
  computeCommitment,
  computeNullifierHash,
  createDepositNote,
  reconstructDepositNote,
  serializeNote,
  deserializeNote,
  formatCommitmentForContract,
} from "./commitment";

// Merkle tree
export {
  MerkleTree,
  MERKLE_TREE_HEIGHT,
  ZERO_VALUE,
  verifyMerkleProof,
  buildMerkleTree,
  formatProofForCircuit,
} from "./merkle";

// Proof generation
export {
  generateProof,
  formatProofForContract,
  encodeProofAsHookData,
  verifyProofLocally,
  generateProofForRelayer,
  computeExpectedPublicSignals,
} from "./proof";

// Re-export commonly used utilities
export { buildPoseidon } from "circomlibjs";
