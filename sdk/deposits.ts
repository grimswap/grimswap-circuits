/**
 * GrimSwap ZK SDK - Deposit Reader
 *
 * Reads deposit events from GrimPool to build commitment arrays.
 * Uses raw JSON-RPC calls — no ethers/viem dependency required.
 * Works in both Node.js and browser.
 */

import { UNICHAIN_SEPOLIA_ADDRESSES, UNICHAIN_SEPOLIA } from "./constants";

/** Deposit event parsed from GrimPool */
export interface DepositEvent {
  commitment: bigint;
  leafIndex: number;
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: string;
}

// Deposit event topic: keccak256("Deposit(bytes32,uint32,uint256)")
const DEPOSIT_EVENT_TOPIC =
  "0xa945e51eec50ab98c161376f0db4cf2aeba3ec92755fe2fcd388bdbbb80ff196";

/**
 * Fetch all deposit commitments from GrimPool
 *
 * Returns ordered array of commitments ready for buildMerkleTree().
 *
 * @param rpcUrl - JSON-RPC endpoint URL (defaults to Unichain Sepolia)
 * @param poolAddress - GrimPool contract address (defaults to Unichain Sepolia)
 * @param fromBlock - Block to start scanning from (defaults to 0)
 * @returns Ordered array of commitment bigints
 *
 * @example
 * ```typescript
 * import { fetchDeposits, buildMerkleTree } from "@grimswap/circuits";
 *
 * const commitments = await fetchDeposits();
 * const tree = await buildMerkleTree(commitments);
 * ```
 */
export async function fetchDeposits(
  rpcUrl?: string,
  poolAddress?: string,
  fromBlock?: number
): Promise<bigint[]> {
  const events = await fetchDepositEvents(rpcUrl, poolAddress, fromBlock);

  // Sort by leafIndex to ensure correct tree ordering
  events.sort((a, b) => a.leafIndex - b.leafIndex);

  return events.map((e) => e.commitment);
}

/**
 * Fetch full deposit events with metadata
 *
 * @param rpcUrl - JSON-RPC endpoint URL
 * @param poolAddress - GrimPool contract address
 * @param fromBlock - Block to start scanning from
 * @returns Array of DepositEvent objects
 */
export async function fetchDepositEvents(
  rpcUrl?: string,
  poolAddress?: string,
  fromBlock?: number
): Promise<DepositEvent[]> {
  const url = rpcUrl || UNICHAIN_SEPOLIA.rpcUrl;
  const pool = poolAddress || UNICHAIN_SEPOLIA_ADDRESSES.grimPool;
  const startBlock = fromBlock || 0;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [
        {
          address: pool,
          topics: [DEPOSIT_EVENT_TOPIC],
          fromBlock: "0x" + startBlock.toString(16),
          toBlock: "latest",
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`);
  }

  const json = (await response.json()) as {
    result?: Array<{
      topics: string[];
      data: string;
      blockNumber: string;
      transactionHash: string;
    }>;
    error?: { message: string };
  };

  if (json.error) {
    throw new Error(`RPC error: ${json.error.message}`);
  }

  const logs = json.result || [];

  return logs.map((log) => {
    // topics[1] = commitment (indexed bytes32)
    const commitment = BigInt(log.topics[1]);

    // data = abi.encode(uint32 leafIndex, uint256 timestamp)
    // leafIndex is in first 32 bytes, timestamp in next 32
    const data = log.data.slice(2); // remove 0x
    const leafIndex = parseInt(data.slice(0, 64), 16);
    const timestamp = BigInt("0x" + data.slice(64, 128));

    return {
      commitment,
      leafIndex,
      timestamp,
      blockNumber: BigInt(log.blockNumber),
      transactionHash: log.transactionHash,
    };
  });
}

/**
 * Get the current deposit count from GrimPool
 *
 * @param rpcUrl - JSON-RPC endpoint URL
 * @param poolAddress - GrimPool contract address
 * @returns Current number of deposits
 */
export async function getDepositCount(
  rpcUrl?: string,
  poolAddress?: string
): Promise<number> {
  const url = rpcUrl || UNICHAIN_SEPOLIA.rpcUrl;
  const pool = poolAddress || UNICHAIN_SEPOLIA_ADDRESSES.grimPool;

  // getDepositCount() selector = keccak256("getDepositCount()")[:4]
  const selector = "0x8656d066";

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: pool, data: selector }, "latest"],
    }),
  });

  const json = (await response.json()) as {
    result?: string;
    error?: { message: string };
  };

  if (json.error) {
    throw new Error(`RPC error: ${json.error.message}`);
  }

  return parseInt(json.result || "0x0", 16);
}
