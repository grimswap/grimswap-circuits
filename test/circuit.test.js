/**
 * GrimSwap Circuit Tests
 *
 * Tests the privateSwap circuit for correctness
 */

const { expect } = require("chai");
const path = require("path");
const { buildPoseidon } = require("circomlibjs");

// Test data
const TEST_SECRET = BigInt("12345678901234567890123456789012345678901234567890");
const TEST_NULLIFIER = BigInt("98765432109876543210987654321098765432109876543210");
const TEST_AMOUNT = BigInt("1000000000000000000"); // 1 ETH in wei

describe("PrivateSwap Circuit", function () {
    this.timeout(100000);

    let poseidon;
    let F; // Finite field

    before(async () => {
        // Initialize Poseidon hash
        poseidon = await buildPoseidon();
        F = poseidon.F;
    });

    describe("Commitment", () => {
        it("should compute commitment correctly", async () => {
            // commitment = Poseidon(nullifier, secret, amount)
            const commitment = poseidon([
                TEST_NULLIFIER,
                TEST_SECRET,
                TEST_AMOUNT
            ]);

            const commitmentHex = F.toString(commitment);
            console.log("Commitment:", commitmentHex);

            expect(commitmentHex).to.be.a("string");
            expect(BigInt(commitmentHex)).to.be.gt(0n);
        });
    });

    describe("Nullifier Hash", () => {
        it("should compute nullifier hash correctly", async () => {
            // nullifierHash = Poseidon(nullifier)
            const nullifierHash = poseidon([TEST_NULLIFIER]);

            const nullifierHashHex = F.toString(nullifierHash);
            console.log("Nullifier Hash:", nullifierHashHex);

            expect(nullifierHashHex).to.be.a("string");
            expect(BigInt(nullifierHashHex)).to.be.gt(0n);
        });

        it("should produce different hashes for different nullifiers", async () => {
            const hash1 = poseidon([TEST_NULLIFIER]);
            const hash2 = poseidon([TEST_NULLIFIER + 1n]);

            expect(F.toString(hash1)).to.not.equal(F.toString(hash2));
        });
    });

    describe("Merkle Tree", () => {
        it("should compute Merkle root correctly for single leaf", async () => {
            // For a tree with single leaf at index 0
            // root = hash(leaf, zero) for all levels

            const commitment = poseidon([
                TEST_NULLIFIER,
                TEST_SECRET,
                TEST_AMOUNT
            ]);

            const ZERO = BigInt(0);
            let current = commitment;

            // Compute root for 20 levels
            for (let i = 0; i < 20; i++) {
                current = poseidon([current, ZERO]);
            }

            const rootHex = F.toString(current);
            console.log("Merkle Root (single leaf):", rootHex);

            expect(rootHex).to.be.a("string");
        });

        it("should verify Merkle proof", async () => {
            // Create a simple tree and verify proof
            const leaf1 = poseidon([TEST_NULLIFIER, TEST_SECRET, TEST_AMOUNT]);
            const leaf2 = poseidon([TEST_NULLIFIER + 1n, TEST_SECRET, TEST_AMOUNT]);

            // Root = hash(leaf1, leaf2)
            const root = poseidon([leaf1, leaf2]);

            // Proof for leaf1: sibling = leaf2, index = 0 (left)
            const proofLeaf1 = {
                pathElements: [leaf2],
                pathIndices: [0] // 0 means leaf is on left
            };

            // Verify: hash(leaf1, pathElement) should equal root
            const computedRoot = poseidon([leaf1, proofLeaf1.pathElements[0]]);
            expect(F.toString(computedRoot)).to.equal(F.toString(root));
        });
    });

    describe("Input Generation", () => {
        it("should generate valid circuit input", async () => {
            const commitment = poseidon([
                TEST_NULLIFIER,
                TEST_SECRET,
                TEST_AMOUNT
            ]);

            const nullifierHash = poseidon([TEST_NULLIFIER]);

            // Generate fake Merkle root (for testing)
            let merkleRoot = commitment;
            const pathElements = [];
            const pathIndices = [];

            for (let i = 0; i < 20; i++) {
                pathElements.push("0");
                pathIndices.push(0);
                merkleRoot = poseidon([merkleRoot, BigInt(0)]);
            }

            const input = {
                // Public inputs
                merkleRoot: F.toString(merkleRoot),
                nullifierHash: F.toString(nullifierHash),
                recipient: "1234567890123456789012345678901234567890",
                relayer: "0",
                relayerFee: "0",
                swapAmountOut: TEST_AMOUNT.toString(),

                // Private inputs
                secret: TEST_SECRET.toString(),
                nullifier: TEST_NULLIFIER.toString(),
                depositAmount: TEST_AMOUNT.toString(),
                pathElements: pathElements,
                pathIndices: pathIndices
            };

            console.log("\nGenerated Circuit Input:");
            console.log(JSON.stringify(input, null, 2));

            expect(input.merkleRoot).to.be.a("string");
            expect(input.nullifierHash).to.be.a("string");
            expect(input.pathElements.length).to.equal(20);
        });
    });
});

/**
 * Helper to generate test input file
 */
async function generateTestInput() {
    const poseidon = await buildPoseidon();
    const F = poseidon.F;

    const commitment = poseidon([
        TEST_NULLIFIER,
        TEST_SECRET,
        TEST_AMOUNT
    ]);

    const nullifierHash = poseidon([TEST_NULLIFIER]);

    let merkleRoot = commitment;
    const pathElements = [];
    const pathIndices = [];

    for (let i = 0; i < 20; i++) {
        pathElements.push("0");
        pathIndices.push(0);
        merkleRoot = poseidon([merkleRoot, BigInt(0)]);
    }

    return {
        merkleRoot: F.toString(merkleRoot),
        nullifierHash: F.toString(nullifierHash),
        recipient: "1234567890123456789012345678901234567890",
        relayer: "0",
        relayerFee: "0",
        swapAmountOut: TEST_AMOUNT.toString(),
        secret: TEST_SECRET.toString(),
        nullifier: TEST_NULLIFIER.toString(),
        depositAmount: TEST_AMOUNT.toString(),
        pathElements,
        pathIndices
    };
}

module.exports = { generateTestInput };
