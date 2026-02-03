/**
 * GrimSwap ZK SDK Types
 */

// Groth16 proof structure
export interface Groth16Proof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: "groth16";
  curve: "bn128";
}

// Public signals for the privateSwap circuit
export interface PublicSignals {
  merkleRoot: string;
  nullifierHash: string;
  recipient: string;
  relayer: string;
  relayerFee: string;
  swapAmountOut: string;
  depositAmount: string;
  commitment: string;
}

// Private inputs for proof generation
export interface PrivateInputs {
  secret: string;
  nullifier: string;
  depositAmount: string;
  pathElements: string[];
  pathIndices: number[];
}

// Circuit input (public + private)
export interface CircuitInput extends PrivateInputs {
  merkleRoot: string;
  nullifierHash: string;
  recipient: string;
  relayer: string;
  relayerFee: string;
  swapAmountOut: string;
}

// Deposit note - what users store locally
export interface DepositNote {
  secret: bigint;
  nullifier: bigint;
  amount: bigint;
  commitment: bigint;
  nullifierHash: bigint;
  leafIndex?: number;
}

// Formatted proof for smart contract
export interface ContractProof {
  pA: [string, string];
  pB: [[string, string], [string, string]];
  pC: [string, string];
  pubSignals: string[];
}

// Merkle proof
export interface MerkleProof {
  root: bigint;
  pathElements: bigint[];
  pathIndices: number[];
}

// Swap parameters
export interface SwapParams {
  recipient: string;
  relayer?: string;
  relayerFee?: number; // basis points
  expectedAmountOut: bigint;
}
