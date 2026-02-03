/**
 * GrimSwap ZK SDK Types
 */
export interface Groth16Proof {
    pi_a: [string, string, string];
    pi_b: [[string, string], [string, string], [string, string]];
    pi_c: [string, string, string];
    protocol: "groth16";
    curve: "bn128";
}
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
export interface PrivateInputs {
    secret: string;
    nullifier: string;
    depositAmount: string;
    pathElements: string[];
    pathIndices: number[];
}
export interface CircuitInput extends PrivateInputs {
    merkleRoot: string;
    nullifierHash: string;
    recipient: string;
    relayer: string;
    relayerFee: string;
    swapAmountOut: string;
}
export interface DepositNote {
    secret: bigint;
    nullifier: bigint;
    amount: bigint;
    commitment: bigint;
    nullifierHash: bigint;
    leafIndex?: number;
}
export interface ContractProof {
    pA: [string, string];
    pB: [[string, string], [string, string]];
    pC: [string, string];
    pubSignals: string[];
}
export interface MerkleProof {
    root: bigint;
    pathElements: bigint[];
    pathIndices: number[];
}
export interface SwapParams {
    recipient: string;
    relayer?: string;
    relayerFee?: number;
    expectedAmountOut: bigint;
}
//# sourceMappingURL=types.d.ts.map