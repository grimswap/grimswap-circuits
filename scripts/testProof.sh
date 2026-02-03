#!/bin/bash

# GrimSwap Test Proof Generator
# Creates a test proof and verifies it

set -e

CIRCUIT_NAME="privateSwap"
BUILD_DIR="build"

echo "================================================"
echo "  GrimSwap Test Proof Generator"
echo "================================================"
echo ""

# Check if required files exist
if [ ! -f "${BUILD_DIR}/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm" ]; then
    echo "ERROR: WASM file not found. Run './scripts/compile.sh' first."
    exit 1
fi

if [ ! -f "${BUILD_DIR}/${CIRCUIT_NAME}.zkey" ]; then
    echo "ERROR: Proving key not found. Run './scripts/setup.sh' first."
    exit 1
fi

# Create test input
echo "[1/4] Creating test input..."
echo ""

cat > ${BUILD_DIR}/input.json << 'EOF'
{
    "merkleRoot": "11469701942666298368112882412133877458305516134926649826543144744382391691533",
    "nullifierHash": "7267988895294922832456016946284614420706655522028093281341753940664046044706",
    "recipient": "1234567890123456789012345678901234567890",
    "relayer": "0",
    "relayerFee": "0",
    "swapAmountOut": "1000000000000000000",
    "secret": "12345678901234567890123456789012345678901234567890123456789012345678901234567890",
    "nullifier": "98765432109876543210987654321098765432109876543210987654321098765432109876543210",
    "depositAmount": "1000000000000000000",
    "pathElements": [
        "0", "0", "0", "0", "0",
        "0", "0", "0", "0", "0",
        "0", "0", "0", "0", "0",
        "0", "0", "0", "0", "0"
    ],
    "pathIndices": [
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0,
        0, 0, 0, 0, 0
    ]
}
EOF

echo "Test input created: ${BUILD_DIR}/input.json"
echo ""

echo "[2/4] Generating witness..."
echo ""

# Generate witness
node ${BUILD_DIR}/${CIRCUIT_NAME}_js/generate_witness.js \
    ${BUILD_DIR}/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm \
    ${BUILD_DIR}/input.json \
    ${BUILD_DIR}/witness.wtns

echo "Witness generated: ${BUILD_DIR}/witness.wtns"
echo ""

echo "[3/4] Generating proof..."
echo ""

# Generate proof
snarkjs groth16 prove \
    ${BUILD_DIR}/${CIRCUIT_NAME}.zkey \
    ${BUILD_DIR}/witness.wtns \
    ${BUILD_DIR}/proof.json \
    ${BUILD_DIR}/public.json

echo "Proof generated:"
echo "  - ${BUILD_DIR}/proof.json"
echo "  - ${BUILD_DIR}/public.json"
echo ""

echo "[4/4] Verifying proof..."
echo ""

# Verify proof
snarkjs groth16 verify \
    ${BUILD_DIR}/verification_key.json \
    ${BUILD_DIR}/public.json \
    ${BUILD_DIR}/proof.json

echo ""
echo "================================================"
echo "  Test Complete!"
echo "================================================"
echo ""
echo "Proof verified successfully!"
echo ""

# Show proof for Solidity
echo "Solidity calldata for verification:"
echo ""
snarkjs zkey export soliditycalldata \
    ${BUILD_DIR}/public.json \
    ${BUILD_DIR}/proof.json

echo ""
