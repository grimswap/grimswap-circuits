#!/bin/bash

# GrimSwap Solidity Verifier Generator
# Exports Groth16 verifier contract from proving key

set -e

CIRCUIT_NAME="privateSwap"
BUILD_DIR="build"
CONTRACTS_DIR="../grimswap-contracts/src/zk"

echo "================================================"
echo "  GrimSwap Solidity Verifier Generator"
echo "================================================"
echo ""

# Check if zkey exists
if [ ! -f "${BUILD_DIR}/${CIRCUIT_NAME}.zkey" ]; then
    echo "ERROR: Proving key not found. Run './scripts/setup.sh' first."
    exit 1
fi

# Create contracts directory if it doesn't exist
mkdir -p ${CONTRACTS_DIR}

echo "[1/2] Generating Solidity verifier..."
echo ""

# Export Solidity verifier
snarkjs zkey export solidityverifier \
    ${BUILD_DIR}/${CIRCUIT_NAME}.zkey \
    ${BUILD_DIR}/Groth16Verifier.sol

echo "[2/2] Copying to contracts directory..."
echo ""

# Copy to contracts directory
cp ${BUILD_DIR}/Groth16Verifier.sol ${CONTRACTS_DIR}/Groth16Verifier.sol

# Also generate calldata helper
snarkjs zkey export soliditycalldata \
    ${BUILD_DIR}/public.json \
    ${BUILD_DIR}/proof.json 2>/dev/null || true

echo "================================================"
echo "  Verifier Generation Complete!"
echo "================================================"
echo ""
echo "Generated files:"
echo "  - ${BUILD_DIR}/Groth16Verifier.sol"
echo "  - ${CONTRACTS_DIR}/Groth16Verifier.sol"
echo ""
echo "The verifier contract is ready for deployment!"
echo ""
echo "Gas cost for verification: ~190,000 gas"
echo ""
