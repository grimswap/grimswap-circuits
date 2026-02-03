/**
 * GrimSwap ZK SDK - Proof Generation
 *
 * Generates Groth16 ZK-SNARK proofs for private swaps.
 */
import type { DepositNote, MerkleProof, SwapParams, Groth16Proof, ContractProof } from "./types";
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
export declare function generateProof(note: DepositNote, merkleProof: MerkleProof, swapParams: SwapParams, wasmPath?: string, zkeyPath?: string): Promise<{
    proof: Groth16Proof;
    publicSignals: string[];
}>;
/**
 * Format proof for smart contract call
 *
 * @param proof - Groth16 proof from snarkjs
 * @param publicSignals - Public signals array
 * @returns ContractProof formatted for Solidity
 */
export declare function formatProofForContract(proof: Groth16Proof, publicSignals: string[]): ContractProof;
/**
 * Encode proof as hook data for Uniswap v4
 *
 * @param contractProof - Formatted contract proof
 * @returns ABI encoded bytes for hookData
 */
export declare function encodeProofAsHookData(contractProof: ContractProof): string;
/**
 * Verify a proof locally (for testing)
 *
 * @param proof - The Groth16 proof
 * @param publicSignals - Public signals
 * @param vkeyPath - Path to verification key JSON
 * @returns True if valid
 */
export declare function verifyProofLocally(proof: Groth16Proof, publicSignals: string[], vkeyPath?: string): Promise<boolean>;
/**
 * Generate proof and format for relayer submission
 *
 * @param note - Deposit note
 * @param merkleProof - Merkle proof
 * @param swapParams - Swap parameters
 * @returns Object ready for relayer API
 */
export declare function generateProofForRelayer(note: DepositNote, merkleProof: MerkleProof, swapParams: SwapParams): Promise<{
    proof: {
        a: [string, string];
        b: [[string, string], [string, string]];
        c: [string, string];
    };
    publicSignals: string[];
}>;
/**
 * Compute what the public signals should be (for verification)
 */
export declare function computeExpectedPublicSignals(note: DepositNote, merkleProof: MerkleProof, swapParams: SwapParams): Promise<{
    merkleRoot: bigint;
    nullifierHash: bigint;
    recipient: bigint;
    relayer: bigint;
    relayerFee: bigint;
    swapAmountOut: bigint;
}>;
//# sourceMappingURL=proof.d.ts.map