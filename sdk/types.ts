/**
 * GrimSwap ZK SDK Types
 */

type Address = `0x${string}`;
type Hex = `0x${string}`;

// ============ Groth16 Proof Types ============

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

// ============ Stealth Address Types ============

export interface StealthKeys {
  /** Private key for spending (keep secret) */
  spendingPrivateKey: Hex;
  /** Public key for spending */
  spendingPublicKey: Hex;
  /** Private key for viewing/scanning (keep secret) */
  viewingPrivateKey: Hex;
  /** Public key for viewing */
  viewingPublicKey: Hex;
  /** Meta-address to share with senders (66 bytes: spending || viewing) */
  stealthMetaAddress: Hex;
}

export interface GeneratedStealthAddress {
  /** The one-time stealth address */
  stealthAddress: Address;
  /** Ephemeral public key for recipient to derive private key */
  ephemeralPubKey: Hex;
  /** View tag for efficient scanning (1 byte) */
  viewTag: number;
}

export interface StealthPayment {
  /** The stealth address that received payment */
  stealthAddress: Address;
  /** Ephemeral public key from announcement */
  ephemeralPubKey: Hex;
  /** View tag */
  viewTag: number;
  /** Token address (address(0) for ETH) */
  token: Address;
  /** Amount received */
  amount: bigint;
  /** Block number of the announcement */
  blockNumber: bigint;
  /** Transaction hash */
  txHash: Hex;
}

// ============ Relayer Types ============

export interface RelayerRequest {
  proof: {
    a: [string, string];
    b: [[string, string], [string, string]];
    c: [string, string];
  };
  publicSignals: string[];
  swapParams: {
    poolKey: PoolKey;
    zeroForOne: boolean;
    amountSpecified: string;
    sqrtPriceLimitX96: string;
  };
}

export interface RelayerResponse {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  fundingTxHash?: string;
  recipientAddress?: string;
  error?: string;
}

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface PrivateSwapConfig {
  note: DepositNote;
  merkleProof: MerkleProof;
  swapParams: SwapParams;
  poolKey: PoolKey;
  zeroForOne: boolean;
  amountSpecified: bigint;
  sqrtPriceLimitX96: bigint;
  relayerUrl?: string;
}

// ============ Scanner Types ============

export interface ScanParams {
  /** Public client for reading chain (viem PublicClient) */
  publicClient: any;
  /** Viewing private key for scanning */
  viewingPrivateKey: Hex;
  /** Spending public key to check against */
  spendingPublicKey: Hex;
  /** Block to start scanning from */
  fromBlock?: bigint;
  /** Block to scan to (default: latest) */
  toBlock?: bigint;
}
