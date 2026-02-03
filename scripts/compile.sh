#!/bin/bash

# GrimSwap Circuit Compilation Script
# Compiles Circom circuits to R1CS, WASM, and C++

set -e

CIRCUIT_NAME="privateSwap"
CIRCUIT_PATH="circuits/${CIRCUIT_NAME}.circom"
BUILD_DIR="build"

echo "================================================"
echo "  GrimSwap ZK Circuit Compiler"
echo "================================================"
echo ""

# Create build directory
mkdir -p ${BUILD_DIR}

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo "ERROR: circom is not installed"
    echo ""
    echo "Install circom:"
    echo "  curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh"
    echo "  git clone https://github.com/iden3/circom.git"
    echo "  cd circom && cargo build --release"
    echo "  sudo cp target/release/circom /usr/local/bin/"
    exit 1
fi

echo "[1/3] Compiling circuit: ${CIRCUIT_PATH}"
echo "      Output: ${BUILD_DIR}/"
echo ""

# Compile circuit
# --r1cs: Generate R1CS constraint system
# --wasm: Generate WASM for witness generation
# --sym: Generate symbol file for debugging
# --c: Generate C++ code (optional, for faster witness generation)
circom ${CIRCUIT_PATH} \
    --r1cs \
    --wasm \
    --sym \
    -o ${BUILD_DIR}/ \
    -l node_modules/

echo ""
echo "[2/3] Circuit compiled successfully!"
echo ""

# Show circuit info
echo "[3/3] Circuit statistics:"
echo ""
snarkjs r1cs info ${BUILD_DIR}/${CIRCUIT_NAME}.r1cs

echo ""
echo "================================================"
echo "  Compilation Complete!"
echo "================================================"
echo ""
echo "Generated files:"
echo "  - ${BUILD_DIR}/${CIRCUIT_NAME}.r1cs          (constraint system)"
echo "  - ${BUILD_DIR}/${CIRCUIT_NAME}_js/           (WASM + JS)"
echo "  - ${BUILD_DIR}/${CIRCUIT_NAME}.sym           (symbols)"
echo ""
echo "Next step: Run './scripts/setup.sh' for trusted setup"
echo ""
