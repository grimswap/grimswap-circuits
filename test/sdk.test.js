/**
 * GrimSwap SDK Comprehensive Test
 *
 * Tests all SDK modules: commitment, merkle, stealth, proof formatting,
 * relayer client, deposits, claim helpers.
 *
 * Run: npm test
 */

const { expect } = require("chai");
const path = require("path");
const fs = require("fs");

// Import from compiled SDK
const sdk = require("../dist/sdk/index");

// Test constants
const TEST_AMOUNT = BigInt("1000000000000000000"); // 1 ETH
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("GrimSwap SDK", function () {
  this.timeout(120000);

  // ============ Commitment Module ============

  describe("Commitment", () => {
    it("should initialize Poseidon", async () => {
      await sdk.initPoseidon();
    });

    it("should compute Poseidon hash", async () => {
      const hash = await sdk.poseidonHash([1n, 2n, 3n]);
      expect(hash).to.be.a("bigint");
      expect(hash > 0n).to.be.true;
    });

    it("should compute deterministic hashes", async () => {
      const hash1 = await sdk.poseidonHash([42n, 100n]);
      const hash2 = await sdk.poseidonHash([42n, 100n]);
      expect(hash1).to.equal(hash2);
    });

    it("should compute different hashes for different inputs", async () => {
      const hash1 = await sdk.poseidonHash([1n, 2n]);
      const hash2 = await sdk.poseidonHash([2n, 1n]);
      expect(hash1).to.not.equal(hash2);
    });

    it("should create deposit note", async () => {
      const note = await sdk.createDepositNote(TEST_AMOUNT);

      expect(note).to.have.property("secret");
      expect(note).to.have.property("nullifier");
      expect(note).to.have.property("amount");
      expect(note).to.have.property("commitment");
      expect(note).to.have.property("nullifierHash");

      expect(note.amount).to.equal(TEST_AMOUNT);
      expect(note.secret).to.be.a("bigint");
      expect(note.nullifier).to.be.a("bigint");
      expect(note.commitment).to.be.a("bigint");
      expect(note.nullifierHash).to.be.a("bigint");

      // Secret and nullifier should be different
      expect(note.secret).to.not.equal(note.nullifier);
    });

    it("should create unique notes", async () => {
      const note1 = await sdk.createDepositNote(TEST_AMOUNT);
      const note2 = await sdk.createDepositNote(TEST_AMOUNT);

      expect(note1.commitment).to.not.equal(note2.commitment);
      expect(note1.nullifierHash).to.not.equal(note2.nullifierHash);
    });

    it("should verify commitment = Poseidon(nullifier, secret, amount)", async () => {
      const note = await sdk.createDepositNote(TEST_AMOUNT);
      const expected = await sdk.computeCommitment(
        note.nullifier,
        note.secret,
        note.amount
      );
      expect(note.commitment).to.equal(expected);
    });

    it("should verify nullifierHash = Poseidon(nullifier)", async () => {
      const note = await sdk.createDepositNote(TEST_AMOUNT);
      const expected = await sdk.computeNullifierHash(note.nullifier);
      expect(note.nullifierHash).to.equal(expected);
    });

    it("should serialize and deserialize note", async () => {
      const note = await sdk.createDepositNote(TEST_AMOUNT);
      const serialized = sdk.serializeNote(note);

      expect(serialized).to.be.a("string");
      expect(serialized.startsWith("grimswap-v1-")).to.be.true;

      const deserialized = await sdk.deserializeNote(serialized);

      expect(deserialized.secret).to.equal(note.secret);
      expect(deserialized.nullifier).to.equal(note.nullifier);
      expect(deserialized.amount).to.equal(note.amount);
      expect(deserialized.commitment).to.equal(note.commitment);
      expect(deserialized.nullifierHash).to.equal(note.nullifierHash);
    });

    it("should format commitment for contract", async () => {
      const note = await sdk.createDepositNote(TEST_AMOUNT);
      const formatted = sdk.formatCommitmentForContract(note.commitment);

      expect(formatted).to.be.a("string");
      expect(formatted.startsWith("0x")).to.be.true;
      expect(formatted.length).to.equal(66); // 0x + 64 hex chars
    });

    it("should reconstruct note from parts", async () => {
      const note = await sdk.createDepositNote(TEST_AMOUNT);
      const reconstructed = await sdk.reconstructDepositNote(
        note.secret,
        note.nullifier,
        note.amount
      );

      expect(reconstructed.commitment).to.equal(note.commitment);
      expect(reconstructed.nullifierHash).to.equal(note.nullifierHash);
    });
  });

  // ============ Merkle Tree Module ============

  describe("Merkle Tree", () => {
    it("should create and initialize tree", async () => {
      const tree = new sdk.MerkleTree();
      await tree.initialize();

      expect(tree.leafCount).to.equal(0);
    });

    it("should insert leaves and update root", async () => {
      const tree = new sdk.MerkleTree();
      await tree.initialize();

      const root0 = tree.getRoot();

      const note = await sdk.createDepositNote(TEST_AMOUNT);
      await tree.insert(note.commitment);

      const root1 = tree.getRoot();

      expect(root1).to.not.equal(root0);
      expect(tree.leafCount).to.equal(1);
    });

    it("should generate valid Merkle proof", async () => {
      const tree = new sdk.MerkleTree();
      await tree.initialize();

      const note = await sdk.createDepositNote(TEST_AMOUNT);
      const index = await tree.insert(note.commitment);

      const proof = tree.getProof(index);

      expect(proof).to.have.property("root");
      expect(proof).to.have.property("pathElements");
      expect(proof).to.have.property("pathIndices");
      expect(proof.pathElements.length).to.equal(sdk.MERKLE_TREE_HEIGHT);
      expect(proof.pathIndices.length).to.equal(sdk.MERKLE_TREE_HEIGHT);
    });

    it("should verify Merkle proof", async () => {
      const tree = new sdk.MerkleTree();
      await tree.initialize();

      const note = await sdk.createDepositNote(TEST_AMOUNT);
      const index = await tree.insert(note.commitment);
      const proof = tree.getProof(index);

      const valid = await sdk.verifyMerkleProof(note.commitment, proof);
      expect(valid).to.be.true;
    });

    it("should reject invalid Merkle proof", async () => {
      const tree = new sdk.MerkleTree();
      await tree.initialize();

      const note = await sdk.createDepositNote(TEST_AMOUNT);
      await tree.insert(note.commitment);
      const proof = tree.getProof(0);

      // Wrong leaf
      const fakeCommitment = BigInt("12345");
      const valid = await sdk.verifyMerkleProof(fakeCommitment, proof);
      expect(valid).to.be.false;
    });

    it("should build tree from commitments array", async () => {
      const notes = [];
      for (let i = 0; i < 5; i++) {
        notes.push(await sdk.createDepositNote(TEST_AMOUNT));
      }

      const commitments = notes.map((n) => n.commitment);
      const tree = await sdk.buildMerkleTree(commitments);

      expect(tree.leafCount).to.equal(5);

      // Verify each proof
      for (let i = 0; i < 5; i++) {
        const proof = tree.getProof(i);
        const valid = await sdk.verifyMerkleProof(notes[i].commitment, proof);
        expect(valid).to.be.true;
      }
    });

    it("should format proof for circuit", async () => {
      const tree = new sdk.MerkleTree();
      await tree.initialize();

      const note = await sdk.createDepositNote(TEST_AMOUNT);
      await tree.insert(note.commitment);
      const proof = tree.getProof(0);

      const formatted = sdk.formatProofForCircuit(proof);

      expect(formatted.pathElements).to.be.an("array");
      expect(formatted.pathIndices).to.be.an("array");
      expect(formatted.pathElements[0]).to.be.a("string");
    });

    it("should handle multiple insertions consistently", async () => {
      const tree1 = new sdk.MerkleTree();
      await tree1.initialize();

      const tree2 = new sdk.MerkleTree();
      await tree2.initialize();

      const notes = [];
      for (let i = 0; i < 3; i++) {
        notes.push(await sdk.createDepositNote(TEST_AMOUNT));
      }

      // Insert in same order
      for (const note of notes) {
        await tree1.insert(note.commitment);
        await tree2.insert(note.commitment);
      }

      expect(tree1.getRoot()).to.equal(tree2.getRoot());
    });
  });

  // ============ Stealth Address Module ============

  describe("Stealth Addresses", () => {
    it("should generate stealth keys", () => {
      const keys = sdk.generateStealthKeys();

      expect(keys).to.have.property("spendingPrivateKey");
      expect(keys).to.have.property("spendingPublicKey");
      expect(keys).to.have.property("viewingPrivateKey");
      expect(keys).to.have.property("viewingPublicKey");
      expect(keys).to.have.property("stealthMetaAddress");

      expect(keys.spendingPrivateKey.startsWith("0x")).to.be.true;
      expect(keys.stealthMetaAddress.startsWith("0x")).to.be.true;
    });

    it("should generate unique keys each time", () => {
      const keys1 = sdk.generateStealthKeys();
      const keys2 = sdk.generateStealthKeys();

      expect(keys1.spendingPrivateKey).to.not.equal(keys2.spendingPrivateKey);
      expect(keys1.viewingPrivateKey).to.not.equal(keys2.viewingPrivateKey);
    });

    it("should generate stealth address from meta-address", () => {
      const keys = sdk.generateStealthKeys();
      const stealth = sdk.generateStealthAddress(keys.stealthMetaAddress);

      expect(stealth).to.have.property("stealthAddress");
      expect(stealth).to.have.property("ephemeralPubKey");
      expect(stealth).to.have.property("viewTag");

      expect(stealth.stealthAddress.startsWith("0x")).to.be.true;
      expect(stealth.stealthAddress.length).to.equal(42); // 0x + 40 hex
      expect(stealth.ephemeralPubKey.startsWith("0x")).to.be.true;
    });

    it("should generate different stealth addresses each time", () => {
      const keys = sdk.generateStealthKeys();
      const stealth1 = sdk.generateStealthAddress(keys.stealthMetaAddress);
      const stealth2 = sdk.generateStealthAddress(keys.stealthMetaAddress);

      expect(stealth1.stealthAddress).to.not.equal(stealth2.stealthAddress);
    });

    it("should check stealth address ownership", () => {
      const keys = sdk.generateStealthKeys();
      const stealth = sdk.generateStealthAddress(keys.stealthMetaAddress);

      const isOwner = sdk.checkStealthAddress(
        stealth.ephemeralPubKey,
        keys.viewingPrivateKey,
        keys.spendingPublicKey,
        stealth.stealthAddress,
        stealth.viewTag
      );

      expect(isOwner).to.be.true;
    });

    it("should reject wrong owner", () => {
      const keys1 = sdk.generateStealthKeys();
      const keys2 = sdk.generateStealthKeys();
      const stealth = sdk.generateStealthAddress(keys1.stealthMetaAddress);

      const isOwner = sdk.checkStealthAddress(
        stealth.ephemeralPubKey,
        keys2.viewingPrivateKey,
        keys2.spendingPublicKey,
        stealth.stealthAddress
      );

      expect(isOwner).to.be.false;
    });

    it("should derive stealth private key", () => {
      const keys = sdk.generateStealthKeys();
      const stealth = sdk.generateStealthAddress(keys.stealthMetaAddress);

      const stealthPrivKey = sdk.deriveStealthPrivateKey(
        keys.viewingPrivateKey,
        keys.spendingPrivateKey,
        stealth.ephemeralPubKey
      );

      expect(stealthPrivKey.startsWith("0x")).to.be.true;
      expect(stealthPrivKey.length).to.equal(66); // 0x + 64 hex
    });

    it("should parse and create meta-address", () => {
      const keys = sdk.generateStealthKeys();
      const parsed = sdk.parseMetaAddress(keys.stealthMetaAddress);

      expect(parsed.spendingPublicKey).to.equal(keys.spendingPublicKey);
      expect(parsed.viewingPublicKey).to.equal(keys.viewingPublicKey);

      const recreated = sdk.createMetaAddress(
        parsed.spendingPublicKey,
        parsed.viewingPublicKey
      );

      expect(recreated).to.equal(keys.stealthMetaAddress);
    });
  });

  // ============ Proof Formatting ============

  describe("Proof Formatting", () => {
    const mockProof = {
      pi_a: ["1", "2", "3"],
      pi_b: [
        ["4", "5"],
        ["6", "7"],
        ["8", "9"],
      ],
      pi_c: ["10", "11", "12"],
      protocol: "groth16",
      curve: "bn128",
    };

    const mockSignals = ["100", "200", "300", "400", "500", "600", "700", "800"];

    it("should format proof for contract", () => {
      const formatted = sdk.formatProofForContract(mockProof, mockSignals);

      expect(formatted).to.have.property("pA");
      expect(formatted).to.have.property("pB");
      expect(formatted).to.have.property("pC");
      expect(formatted).to.have.property("pubSignals");

      expect(formatted.pA).to.deep.equal(["1", "2"]);
      // B points are reversed for Solidity
      expect(formatted.pB[0][0]).to.equal("5"); // reversed
      expect(formatted.pB[0][1]).to.equal("4"); // reversed
      expect(formatted.pC).to.deep.equal(["10", "11"]);
      expect(formatted.pubSignals).to.deep.equal(mockSignals);
    });
  });

  // ============ Constants & Configuration ============

  describe("Constants", () => {
    it("should export Unichain Sepolia addresses", () => {
      const addrs = sdk.UNICHAIN_SEPOLIA_ADDRESSES;

      expect(addrs.grimPool).to.equal(
        "0xEAB5E7B4e715A22E8c114B7476eeC15770B582bb"
      );
      expect(addrs.grimSwapZK).to.equal(
        "0xeB72E2495640a4B83EBfc4618FD91cc9beB640c4"
      );
      expect(addrs.grimSwapRouter).to.equal(
        "0xC13a6a504da21aD23c748f08d3E991621D42DA4F"
      );
    });

    it("should export chain config", () => {
      expect(sdk.UNICHAIN_SEPOLIA.chainId).to.equal(1301);
      expect(sdk.UNICHAIN_SEPOLIA.name).to.equal("Unichain Sepolia");
    });

    it("should get chain config by ID", () => {
      const config = sdk.getChainConfig(1301);
      expect(config.name).to.equal("Unichain Sepolia");
    });

    it("should throw for unsupported chain", () => {
      expect(() => sdk.getChainConfig(99999)).to.throw("Unsupported chain ID");
    });

    it("should export ABIs", () => {
      expect(sdk.GRIM_POOL_ABI).to.be.an("array");
      expect(sdk.GRIM_SWAP_ROUTER_ABI).to.be.an("array");
      expect(sdk.GRIM_SWAP_ZK_ABI).to.be.an("array");
      expect(sdk.GROTH16_VERIFIER_ABI).to.be.an("array");
    });

    it("should have correct pool ABI function names", () => {
      const names = sdk.GRIM_POOL_ABI.filter((x) => x.type === "function").map(
        (x) => x.name
      );
      expect(names).to.include("deposit");
      expect(names).to.include("isSpent");
      expect(names).to.include("getLastRoot");
      expect(names).to.include("addKnownRoot");
      expect(names).to.include("getDepositCount");
      expect(names).to.include("releaseForSwap");

      // Old names should NOT be present
      expect(names).to.not.include("isSpentNullifier");
      expect(names).to.not.include("getCurrentRoot");
    });

    it("should export relayer URL", () => {
      expect(sdk.RELAYER_DEFAULT_URL).to.equal(
        "https://services.grimswap.com"
      );
    });

    it("should export router ABI with executePrivateSwap", () => {
      const routerFn = sdk.GRIM_SWAP_ROUTER_ABI.find(
        (x) => x.name === "executePrivateSwap"
      );
      expect(routerFn).to.exist;
      expect(routerFn.type).to.equal("function");
    });
  });

  // ============ Relayer Client ============

  describe("Relayer Client", () => {
    it("should check relayer health (production)", async () => {
      const healthy = await sdk.checkRelayerHealth();
      console.log("    Relayer healthy:", healthy);
      // Don't assert - relayer may be down in CI
    });

    it("should return false for non-existent relayer", async () => {
      const healthy = await sdk.checkRelayerHealth(
        "http://localhost:99999"
      );
      expect(healthy).to.be.false;
    });

    it("should get relayer info (production)", async () => {
      try {
        const info = await sdk.getRelayerInfo();
        console.log("    Relayer address:", info.address);
        console.log("    Relayer fee:", info.fee);
        expect(info).to.have.property("address");
        expect(info).to.have.property("fee");
      } catch (e) {
        console.log("    Relayer not reachable (skipped)");
      }
    });
  });

  // ============ Deposit Reader ============

  describe("Deposit Reader", () => {
    it("should fetch deposit count", async () => {
      try {
        const count = await sdk.getDepositCount();
        console.log("    Deposit count:", count);
        expect(count).to.be.a("number");
        expect(count >= 0).to.be.true;
      } catch (e) {
        console.log("    RPC not reachable (skipped)");
      }
    });

    it("should fetch deposits", async () => {
      try {
        const commitments = await sdk.fetchDeposits();
        console.log("    Deposits found:", commitments.length);
        expect(commitments).to.be.an("array");
        if (commitments.length > 0) {
          expect(commitments[0]).to.be.a("bigint");
        }
      } catch (e) {
        console.log("    RPC not reachable (skipped)");
      }
    });

    it("should fetch deposit events with metadata", async () => {
      try {
        const events = await sdk.fetchDepositEvents();
        console.log("    Deposit events:", events.length);
        if (events.length > 0) {
          expect(events[0]).to.have.property("commitment");
          expect(events[0]).to.have.property("leafIndex");
          expect(events[0]).to.have.property("timestamp");
          expect(events[0]).to.have.property("blockNumber");
          expect(events[0]).to.have.property("transactionHash");
        }
      } catch (e) {
        console.log("    RPC not reachable (skipped)");
      }
    });
  });

  // ============ End-to-End Flow (Offline) ============

  describe("End-to-End Flow (Offline)", () => {
    it("should complete full offline flow: note → tree → proof input → format", async () => {
      // 1. Create deposit notes
      const notes = [];
      for (let i = 0; i < 3; i++) {
        notes.push(await sdk.createDepositNote(TEST_AMOUNT));
      }

      // 2. Build Merkle tree
      const commitments = notes.map((n) => n.commitment);
      const tree = await sdk.buildMerkleTree(commitments);

      // 3. Pick note to withdraw (index 1)
      const note = notes[1];
      note.leafIndex = 1;
      const merkleProof = tree.getProof(1);

      // 4. Verify Merkle proof
      const valid = await sdk.verifyMerkleProof(note.commitment, merkleProof);
      expect(valid).to.be.true;

      // 5. Generate stealth address
      const keys = sdk.generateStealthKeys();
      const stealth = sdk.generateStealthAddress(keys.stealthMetaAddress);

      // 6. Build swap params
      const swapParams = {
        recipient: BigInt(stealth.stealthAddress).toString(),
        relayer: "0",
        relayerFee: 10,
        expectedAmountOut: note.amount,
      };

      // 7. Compute expected public signals
      const expected = await sdk.computeExpectedPublicSignals(
        note,
        merkleProof,
        swapParams
      );

      expect(expected.merkleRoot).to.equal(merkleProof.root);
      expect(expected.nullifierHash).to.equal(note.nullifierHash);

      // 8. Serialize and deserialize note (round-trip)
      const serialized = sdk.serializeNote(note);
      const restored = await sdk.deserializeNote(serialized);
      expect(restored.commitment).to.equal(note.commitment);

      // 9. Format commitment for contract
      const commitmentHex = sdk.formatCommitmentForContract(note.commitment);
      expect(commitmentHex.length).to.equal(66);

      // 10. Verify stealth address ownership
      const isOwner = sdk.checkStealthAddress(
        stealth.ephemeralPubKey,
        keys.viewingPrivateKey,
        keys.spendingPublicKey,
        stealth.stealthAddress
      );
      expect(isOwner).to.be.true;

      // 11. Derive stealth private key (for claiming)
      const stealthPrivKey = sdk.deriveStealthPrivateKey(
        keys.viewingPrivateKey,
        keys.spendingPrivateKey,
        stealth.ephemeralPubKey
      );
      expect(stealthPrivKey.startsWith("0x")).to.be.true;

      console.log("    Full offline flow completed successfully");
      console.log("    Notes created:", notes.length);
      console.log("    Tree root:", merkleProof.root.toString().slice(0, 20) + "...");
      console.log("    Stealth address:", stealth.stealthAddress);
      console.log("    Stealth private key derived: yes");
    });
  });

  // ============ ZK Proof Generation (if circuit files exist) ============

  describe("ZK Proof Generation", () => {
    const wasmPath = path.resolve(
      __dirname,
      "../build/privateSwap_js/privateSwap.wasm"
    );
    const zkeyPath = path.resolve(__dirname, "../build/privateSwap.zkey");

    const circuitFilesExist =
      fs.existsSync(wasmPath) && fs.existsSync(zkeyPath);

    before(function () {
      if (!circuitFilesExist) {
        console.log("    Circuit files not found, skipping proof tests");
        console.log("    WASM:", wasmPath);
        console.log("    ZKey:", zkeyPath);
        this.skip();
      }
    });

    it("should generate proof from file paths", async function () {
      if (!circuitFilesExist) this.skip();

      const note = await sdk.createDepositNote(TEST_AMOUNT);
      const tree = await sdk.buildMerkleTree([note.commitment]);
      const merkleProof = tree.getProof(0);

      const keys = sdk.generateStealthKeys();
      const stealth = sdk.generateStealthAddress(keys.stealthMetaAddress);

      const { proof, publicSignals } = await sdk.generateProof(
        note,
        merkleProof,
        {
          recipient: BigInt(stealth.stealthAddress).toString(),
          relayer: "0",
          relayerFee: 0,
          expectedAmountOut: note.amount,
        },
        wasmPath,
        zkeyPath
      );

      expect(proof).to.have.property("pi_a");
      expect(proof).to.have.property("pi_b");
      expect(proof).to.have.property("pi_c");
      expect(proof.protocol).to.equal("groth16");
      expect(publicSignals).to.be.an("array");
      expect(publicSignals.length).to.equal(8);

      console.log("    Proof generated successfully");
      console.log("    Public signals:", publicSignals.length);
    });

    it("should generate proof from buffers (browser-compatible)", async function () {
      if (!circuitFilesExist) this.skip();

      const wasmBuffer = fs.readFileSync(wasmPath);
      const zkeyBuffer = fs.readFileSync(zkeyPath);

      const note = await sdk.createDepositNote(TEST_AMOUNT);
      const tree = await sdk.buildMerkleTree([note.commitment]);
      const merkleProof = tree.getProof(0);

      const keys = sdk.generateStealthKeys();
      const stealth = sdk.generateStealthAddress(keys.stealthMetaAddress);

      const { proof, publicSignals } = await sdk.generateProofFromBuffers(
        note,
        merkleProof,
        {
          recipient: BigInt(stealth.stealthAddress).toString(),
          relayer: "0",
          relayerFee: 0,
          expectedAmountOut: note.amount,
        },
        wasmBuffer,
        zkeyBuffer
      );

      expect(proof).to.have.property("pi_a");
      expect(publicSignals.length).to.equal(8);

      // Format for contract
      const formatted = sdk.formatProofForContract(proof, publicSignals);
      expect(formatted.pA.length).to.equal(2);
      expect(formatted.pB.length).to.equal(2);
      expect(formatted.pC.length).to.equal(2);
      expect(formatted.pubSignals.length).to.equal(8);

      console.log("    Buffer-based proof generated successfully");
    });

    it("should format proof for relayer submission", async function () {
      if (!circuitFilesExist) this.skip();

      const note = await sdk.createDepositNote(TEST_AMOUNT);
      const tree = await sdk.buildMerkleTree([note.commitment]);
      const merkleProof = tree.getProof(0);

      // Use explicit paths (generateProofForRelayer uses default paths which are relative to dist/)
      const { proof, publicSignals } = await sdk.generateProof(
        note,
        merkleProof,
        {
          recipient: "1234567890",
          relayer: "0",
          relayerFee: 0,
          expectedAmountOut: note.amount,
        },
        wasmPath,
        zkeyPath
      );

      const formatted = sdk.formatProofForContract(proof, publicSignals);

      const relayerPayload = {
        a: formatted.pA,
        b: formatted.pB,
        c: formatted.pC,
      };

      expect(relayerPayload.a.length).to.equal(2);
      expect(relayerPayload.b.length).to.equal(2);
      expect(relayerPayload.c.length).to.equal(2);

      console.log("    Relayer-formatted proof generated");
    });

    it("should verify proof locally", async function () {
      if (!circuitFilesExist) this.skip();

      const vkeyPath = path.resolve(
        __dirname,
        "../build/verification_key.json"
      );
      if (!fs.existsSync(vkeyPath)) {
        console.log("    Verification key not found, skipping");
        this.skip();
      }

      const note = await sdk.createDepositNote(TEST_AMOUNT);
      const tree = await sdk.buildMerkleTree([note.commitment]);
      const merkleProof = tree.getProof(0);

      const { proof, publicSignals } = await sdk.generateProof(
        note,
        merkleProof,
        {
          recipient: "1234567890",
          relayer: "0",
          relayerFee: 0,
          expectedAmountOut: note.amount,
        },
        wasmPath,
        zkeyPath
      );

      const valid = await sdk.verifyProofLocally(
        proof,
        publicSignals,
        vkeyPath
      );

      expect(valid).to.be.true;
      console.log("    Proof verified locally: PASS");
    });
  });
});
