"use strict";
/**
 * GrimSwap ZK SDK - Proof Generation
 *
 * Generates Groth16 ZK-SNARK proofs for private swaps.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateProof = generateProof;
exports.formatProofForContract = formatProofForContract;
exports.encodeProofAsHookData = encodeProofAsHookData;
exports.verifyProofLocally = verifyProofLocally;
exports.generateProofForRelayer = generateProofForRelayer;
exports.computeExpectedPublicSignals = computeExpectedPublicSignals;
const snarkjs = __importStar(require("snarkjs"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const commitment_1 = require("./commitment");
const merkle_1 = require("./merkle");
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
async function generateProof(note, merkleProof, swapParams, wasmPath, zkeyPath) {
    await (0, commitment_1.initPoseidon)();
    // Resolve paths
    const wasm = wasmPath ||
        path.resolve(__dirname, DEFAULT_WASM_PATH);
    const zkey = zkeyPath ||
        path.resolve(__dirname, DEFAULT_ZKEY_PATH);
    // Verify files exist
    if (!fs.existsSync(wasm)) {
        throw new Error(`WASM file not found: ${wasm}`);
    }
    if (!fs.existsSync(zkey)) {
        throw new Error(`ZKey file not found: ${zkey}`);
    }
    // Format Merkle proof for circuit
    const { pathElements, pathIndices } = (0, merkle_1.formatProofForCircuit)(merkleProof);
    // Build circuit input
    const input = {
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
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);
    return {
        proof: proof,
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
function formatProofForContract(proof, publicSignals) {
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
function encodeProofAsHookData(contractProof) {
    const { ethers } = require("ethers");
    return ethers.AbiCoder.defaultAbiCoder().encode(["uint256[2]", "uint256[2][2]", "uint256[2]", "uint256[8]"], [
        contractProof.pA,
        contractProof.pB,
        contractProof.pC,
        contractProof.pubSignals,
    ]);
}
/**
 * Verify a proof locally (for testing)
 *
 * @param proof - The Groth16 proof
 * @param publicSignals - Public signals
 * @param vkeyPath - Path to verification key JSON
 * @returns True if valid
 */
async function verifyProofLocally(proof, publicSignals, vkeyPath) {
    const vkey = vkeyPath ||
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
async function generateProofForRelayer(note, merkleProof, swapParams) {
    const { proof, publicSignals } = await generateProof(note, merkleProof, swapParams);
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
async function computeExpectedPublicSignals(note, merkleProof, swapParams) {
    return {
        merkleRoot: merkleProof.root,
        nullifierHash: note.nullifierHash,
        recipient: BigInt(swapParams.recipient),
        relayer: BigInt(swapParams.relayer || "0"),
        relayerFee: BigInt(swapParams.relayerFee || 0),
        swapAmountOut: swapParams.expectedAmountOut,
    };
}
//# sourceMappingURL=proof.js.map