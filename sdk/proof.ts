/**
 * GrimSwap ZK SDK - Proof Generation
 *
 * Generates Groth16 ZK-SNARK proofs for private swaps.
 */

import * as snarkjs from "snarkjs";
import * as path from "path";
import * as fs from "fs";
import {
  computeCommitment,
  computeNullifierHash,
  initPoseidon,
} from "./commitment";
import { formatProofForCircuit } from "./merkle";
import type {
  DepositNote,
  MerkleProof,
  SwapParams,
  CircuitInput,
  Groth16Proof,
  ContractProof,
} from "./types";

// Default paths relative to SDK
const DEFAULT_WASM_PATH = "../build/privateSwap_js/privateSwap.wasm";
const DEFAULT_ZKEY_PATH = "../setup/privateSwap_final.zkey";

/**
 * Generate a ZK proof for a private swap
 *
 * @param note - The deposit note
 * @param merkleProof - Merkle proof of inclusion
 * @param swapParams - Swap parameters
 * @param wasmPath - Path to compiled circuit WASM
 * @param zkeyPath - Path to proving key
 * @returns Proof and public signals
 */
export async function generateProof(
  note: DepositNote,
  merkleProof: MerkleProof,
  swapParams: SwapParams,
  wasmPath?: string,
  zkeyPath?: string
): Promise<{
  proof: Groth16Proof;
  publicSignals: string[];
}> {
  await initPoseidon();

  // Resolve paths
  const wasm =
    wasmPath ||
    path.resolve(__dirname, DEFAULT_WASM_PATH);
  const zkey =
    zkeyPath ||
    path.resolve(__dirname, DEFAULT_ZKEY_PATH);

  // Verify files exist
  if (!fs.existsSync(wasm)) {
    throw new Error(`WASM file not found: ${wasm}`);
  }
  if (!fs.existsSync(zkey)) {
    throw new Error(`ZKey file not found: ${zkey}`);
  }

  // Format Merkle proof for circuit
  const { pathElements, pathIndices } = formatProofForCircuit(merkleProof);

  // Build circuit input
  const input: CircuitInput = {
    // Public inputs
    merkleRoot: merkleProof.root.toString(),
    nullifierHash: note.nullifierHash.toString(),
    recipient: swapParams.recipient,
    relayer: swapParams.relayer || "0",
    relayerFee: (swapParams.relayerFee || 0).toString(),
    swapAmountOut: swapParams.expectedAmountOut.toString(),

    // Private inputs
    secret: note.secret.toString(),
    nullifier: note.nullifier.toString(),
    depositAmount: note.amount.toString(),
    pathElements,
    pathIndices,
  };

  // Generate proof using snarkjs
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    wasm,
    zkey
  );

  return {
    proof: proof as Groth16Proof,
    publicSignals,
  };
}

/**
 * Format proof for smart contract call
 *
 * @param proof - Groth16 proof from snarkjs
 * @param publicSignals - Public signals array
 * @returns ContractProof formatted for Solidity
 */
export function formatProofForContract(
  proof: Groth16Proof,
  publicSignals: string[]
): ContractProof {
  // snarkjs outputs proof points differently than what the contract expects
  // pA: [x, y] (G1 point)
  // pB: [[x1, x2], [y1, y2]] (G2 point, note the reversed order for Solidity)
  // pC: [x, y] (G1 point)

  return {
    pA: [proof.pi_a[0], proof.pi_a[1]],
    pB: [
      [proof.pi_b[0][1], proof.pi_b[0][0]], // Reversed for Solidity
      [proof.pi_b[1][1], proof.pi_b[1][0]], // Reversed for Solidity
    ],
    pC: [proof.pi_c[0], proof.pi_c[1]],
    pubSignals: publicSignals,
  };
}

/**
 * Encode proof as hook data for Uniswap v4
 *
 * @param contractProof - Formatted contract proof
 * @returns ABI encoded bytes for hookData
 */
export function encodeProofAsHookData(contractProof: ContractProof): string {
  const { ethers } = require("ethers");

  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[8]"],
    [
      contractProof.pA,
      contractProof.pB,
      contractProof.pC,
      contractProof.pubSignals,
    ]
  );
}

/**
 * Verify a proof locally (for testing)
 *
 * @param proof - The Groth16 proof
 * @param publicSignals - Public signals
 * @param vkeyPath - Path to verification key JSON
 * @returns True if valid
 */
export async function verifyProofLocally(
  proof: Groth16Proof,
  publicSignals: string[],
  vkeyPath?: string
): Promise<boolean> {
  const vkey =
    vkeyPath ||
    path.resolve(__dirname, "../setup/verification_key.json");

  if (!fs.existsSync(vkey)) {
    throw new Error(`Verification key not found: ${vkey}`);
  }

  const verificationKey = JSON.parse(fs.readFileSync(vkey, "utf8"));

  return await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
}

/**
 * Generate proof and format for relayer submission
 *
 * @param note - Deposit note
 * @param merkleProof - Merkle proof
 * @param swapParams - Swap parameters
 * @returns Object ready for relayer API
 */
export async function generateProofForRelayer(
  note: DepositNote,
  merkleProof: MerkleProof,
  swapParams: SwapParams
): Promise<{
  proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  publicSignals: string[];
}> {
  const { proof, publicSignals } = await generateProof(
    note,
    merkleProof,
    swapParams
  );

  const formatted = formatProofForContract(proof, publicSignals);

  return {
    proof: {
      a: formatted.pA,
      b: formatted.pB,
      c: formatted.pC,
    },
    publicSignals: formatted.pubSignals,
  };
}

/**
 * Compute what the public signals should be (for verification)
 */
export async function computeExpectedPublicSignals(
  note: DepositNote,
  merkleProof: MerkleProof,
  swapParams: SwapParams
): Promise<{
  merkleRoot: bigint;
  nullifierHash: bigint;
  recipient: bigint;
  relayer: bigint;
  relayerFee: bigint;
  swapAmountOut: bigint;
}> {
  return {
    merkleRoot: merkleProof.root,
    nullifierHash: note.nullifierHash,
    recipient: BigInt(swapParams.recipient),
    relayer: BigInt(swapParams.relayer || "0"),
    relayerFee: BigInt(swapParams.relayerFee || 0),
    swapAmountOut: swapParams.expectedAmountOut,
  };
}
