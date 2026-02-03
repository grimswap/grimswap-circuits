#!/bin/bash

# GrimSwap Trusted Setup Script
# Uses Powers of Tau ceremony for Groth16 proving/verification keys

set -e

CIRCUIT_NAME="privateSwap"
BUILD_DIR="build"
PTAU_FILE="powersOfTau28_hez_final_15.ptau"
PTAU_URL="https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau"

echo "================================================"
echo "  GrimSwap ZK Trusted Setup"
echo "================================================"
echo ""

# Check if R1CS exists
if [ ! -f "${BUILD_DIR}/${CIRCUIT_NAME}.r1cs" ]; then
    echo "ERROR: R1CS file not found. Run './scripts/compile.sh' first."
    exit 1
fi

# Download Powers of Tau if not exists
if [ ! -f "${BUILD_DIR}/${PTAU_FILE}" ]; then
    echo "[1/5] Downloading Powers of Tau ceremony file..."
    echo "      This is a one-time download (~1.6GB)"
    echo "      Source: Hermez Network ceremony"
    echo ""
    curl -L -o ${BUILD_DIR}/${PTAU_FILE} ${PTAU_URL}
    echo ""
else
    echo "[1/5] Powers of Tau file exists, skipping download"
fi

echo "[2/5] Generating proving key (Phase 2 setup)..."
echo ""

# Generate the proving key
snarkjs groth16 setup \
    ${BUILD_DIR}/${CIRCUIT_NAME}.r1cs \
    ${BUILD_DIR}/${PTAU_FILE} \
    ${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey

echo ""
echo "[3/5] Contributing to Phase 2 ceremony..."
echo ""

# Add a contribution to the ceremony (random entropy)
# In production, multiple parties would contribute
snarkjs zkey contribute \
    ${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey \
    ${BUILD_DIR}/${CIRCUIT_NAME}_0001.zkey \
    --name="GrimSwap Phase 2 Contribution" \
    -e="$(head -c 64 /dev/urandom | xxd -p)"

echo ""
echo "[4/5] Finalizing proving key..."
echo ""

# Finalize the key (beacon)
snarkjs zkey beacon \
    ${BUILD_DIR}/${CIRCUIT_NAME}_0001.zkey \
    ${BUILD_DIR}/${CIRCUIT_NAME}.zkey \
    0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f \
    10 \
    -n="Final Beacon phase2"

echo ""
echo "[5/5] Exporting verification key..."
echo ""

# Export verification key (JSON format)
snarkjs zkey export verificationkey \
    ${BUILD_DIR}/${CIRCUIT_NAME}.zkey \
    ${BUILD_DIR}/verification_key.json

# Cleanup intermediate files
rm -f ${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey
rm -f ${BUILD_DIR}/${CIRCUIT_NAME}_0001.zkey

echo "================================================"
echo "  Trusted Setup Complete!"
echo "================================================"
echo ""
echo "Generated files:"
echo "  - ${BUILD_DIR}/${CIRCUIT_NAME}.zkey       (proving key)"
echo "  - ${BUILD_DIR}/verification_key.json      (verification key)"
echo ""
echo "Next step: Run './scripts/generateVerifier.sh' to export Solidity verifier"
echo ""

# Verify the setup
echo "Verifying setup integrity..."
snarkjs zkey verify \
    ${BUILD_DIR}/${CIRCUIT_NAME}.r1cs \
    ${BUILD_DIR}/${PTAU_FILE} \
    ${BUILD_DIR}/${CIRCUIT_NAME}.zkey

echo ""
echo "Setup verification passed!"
echo ""
