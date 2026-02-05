/**
 * GrimSwap ZK SDK - Relayer Client
 *
 * Simple fetch-based client for submitting ZK proofs to the GrimSwap relayer.
 * Works in both Node.js and browser environments.
 */

import type { RelayerRequest, RelayerResponse } from "./types";
import { RELAYER_DEFAULT_URL } from "./constants";

/**
 * Submit a private swap proof to the relayer for execution
 *
 * @param relayerUrl - Relayer endpoint URL
 * @param proof - Formatted proof (a, b, c points)
 * @param publicSignals - Public signals array
 * @param swapParams - Swap parameters including pool key
 * @returns Relayer response with tx hash on success
 */
export async function submitToRelayer(
  relayerUrl: string,
  proof: RelayerRequest["proof"],
  publicSignals: string[],
  swapParams: RelayerRequest["swapParams"]
): Promise<RelayerResponse> {
  const url = relayerUrl || RELAYER_DEFAULT_URL;

  const body: RelayerRequest = {
    proof,
    publicSignals,
    swapParams,
  };

  const response = await fetch(`${url}/relay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    return {
      success: false,
      error: `Relayer returned ${response.status}: ${errorText}`,
    };
  }

  return (await response.json()) as RelayerResponse;
}

/**
 * Get relayer info (address, fee)
 *
 * @param relayerUrl - Relayer endpoint URL
 * @returns Relayer address and fee info
 */
export async function getRelayerInfo(
  relayerUrl?: string
): Promise<{ address: string; fee: number }> {
  const url = relayerUrl || RELAYER_DEFAULT_URL;

  const response = await fetch(`${url}/info`);

  if (!response.ok) {
    throw new Error(`Failed to get relayer info: ${response.status}`);
  }

  return (await response.json()) as { address: string; fee: number };
}

/**
 * Check if the relayer is healthy and accepting requests
 *
 * @param relayerUrl - Relayer endpoint URL
 * @returns true if relayer is healthy
 */
export async function checkRelayerHealth(
  relayerUrl?: string
): Promise<boolean> {
  const url = relayerUrl || RELAYER_DEFAULT_URL;

  try {
    const response = await fetch(`${url}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
