/**
 * GrimSwap ZK SDK - High-Level Private Swap
 *
 * Single-function interface for executing a complete private swap.
 * Handles: tree building, proof generation, formatting, relayer submission.
 */

import { buildMerkleTree } from "./merkle";
import { generateProofFromBuffers, formatProofForContract } from "./proof";
import { submitToRelayer, getRelayerInfo } from "./relayer";
import { fetchDeposits } from "./deposits";
import { RELAYER_DEFAULT_URL, UNICHAIN_SEPOLIA } from "./constants";
import type {
  DepositNote,
  PoolKey,
  RelayerResponse,
} from "./types";

/** Configuration for executePrivateSwap */
export interface PrivateSwapParams {
  /** The deposit note (from createDepositNote) */
  note: DepositNote;
  /** Recipient stealth address */
  recipient: string;
  /** Pool key for the swap */
  poolKey: PoolKey;
  /** true = currency0 -> currency1, false = currency1 -> currency0 */
  zeroForOne: boolean;
  /** Swap amount (negative = exact input, positive = exact output) */
  amountSpecified: bigint;
  /** Price limit (use MIN_SQRT_PRICE+1 for zeroForOne, MAX_SQRT_PRICE-1 for !zeroForOne) */
  sqrtPriceLimitX96?: bigint;
  /** Circuit WASM as buffer (fetch from CDN or node_modules) */
  wasmBuffer: ArrayBuffer | Uint8Array;
  /** Proving key as buffer (fetch from CDN or node_modules) */
  zkeyBuffer: ArrayBuffer | Uint8Array;
  /** Relayer URL (defaults to RELAYER_DEFAULT_URL) */
  relayerUrl?: string;
  /** RPC URL for reading deposits (defaults to Unichain Sepolia) */
  rpcUrl?: string;
  /** Pre-fetched commitments array (skip fetching if provided) */
  commitments?: bigint[];
}

// Uniswap v4 sqrt price limits
const MIN_SQRT_PRICE_X96 = BigInt("4295128740"); // MIN + 1
const MAX_SQRT_PRICE_X96 = BigInt("1461446703485210103287273052203988822378723970341"); // MAX - 1

/**
 * Execute a complete private swap in one call
 *
 * This is the main entry point for partners. It handles:
 * 1. Fetching all deposits from GrimPool (or uses provided commitments)
 * 2. Building the Merkle tree
 * 3. Generating the ZK proof
 * 4. Formatting and submitting to the relayer
 *
 * @returns RelayerResponse with txHash on success
 *
 * @example
 * ```typescript
 * import {
 *   createDepositNote,
 *   executePrivateSwap,
 *   UNICHAIN_SEPOLIA_ADDRESSES,
 * } from "@grimswap/circuits";
 *
 * // After depositing on-chain...
 * const result = await executePrivateSwap({
 *   note,
 *   recipient: stealthAddress,
 *   poolKey: {
 *     currency0: "0x0000000000000000000000000000000000000000",
 *     currency1: tokenAddress,
 *     fee: 3000,
 *     tickSpacing: 60,
 *     hooks: UNICHAIN_SEPOLIA_ADDRESSES.grimSwapZK,
 *   },
 *   zeroForOne: true,
 *   amountSpecified: -note.amount, // exact input
 *   wasmBuffer,
 *   zkeyBuffer,
 * });
 *
 * console.log(result.txHash);
 * ```
 */
export async function executePrivateSwap(
  params: PrivateSwapParams
): Promise<RelayerResponse> {
  const {
    note,
    recipient,
    poolKey,
    zeroForOne,
    amountSpecified,
    wasmBuffer,
    zkeyBuffer,
    relayerUrl,
    rpcUrl,
    commitments: preloadedCommitments,
  } = params;

  const sqrtPriceLimitX96 =
    params.sqrtPriceLimitX96 ??
    (zeroForOne ? MIN_SQRT_PRICE_X96 : MAX_SQRT_PRICE_X96);

  const url = relayerUrl || RELAYER_DEFAULT_URL;

  // 1. Get relayer info for fee + address
  const relayerInfo = await getRelayerInfo(url);

  // 2. Fetch deposits and build Merkle tree
  const commitments = preloadedCommitments || await fetchDeposits(rpcUrl);
  const tree = await buildMerkleTree(commitments);

  if (note.leafIndex === undefined) {
    throw new Error(
      "note.leafIndex is required. Set it after deposit confirmation " +
      "(matches the leafIndex from the Deposit event)."
    );
  }

  const merkleProof = tree.getProof(note.leafIndex);

  // 3. Generate ZK proof
  const { proof, publicSignals } = await generateProofFromBuffers(
    note,
    merkleProof,
    {
      recipient,
      relayer: relayerInfo.address,
      relayerFee: relayerInfo.fee,
      expectedAmountOut: note.amount,
    },
    wasmBuffer,
    zkeyBuffer
  );

  // 4. Format and submit to relayer
  const formatted = formatProofForContract(proof, publicSignals);

  return submitToRelayer(
    url,
    {
      a: formatted.pA,
      b: formatted.pB,
      c: formatted.pC,
    },
    formatted.pubSignals,
    {
      poolKey,
      zeroForOne,
      amountSpecified: amountSpecified.toString(),
      sqrtPriceLimitX96: sqrtPriceLimitX96.toString(),
    }
  );
}
