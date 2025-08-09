#!/bin/bash

# Build script for Stellar smart contract
set -e

echo "Building Stellar smart contract..."

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "Error: Rust is not installed. Please install Rust first:"
    echo "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Check Rust version and install appropriate target
RUST_VERSION=$(rustc --version | cut -d' ' -f2 | cut -d'.' -f1-2)
echo "Rust version: $RUST_VERSION"

# For now, use the older target that we know works
echo "Using wasm32-unknown-unknown target (fallback)"
TARGET="wasm32-unknown-unknown"
# Check if wasm32 target is installed
if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
    echo "Installing wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

# Check if wasm-opt is available
if ! command -v wasm-opt &> /dev/null; then
    echo "Warning: wasm-opt not found. Install it for better optimization:"
    echo "npm install -g wasm-opt"
    echo "Continuing without wasm-opt..."
fi

# Build the contract
echo "Compiling contract with target: $TARGET..."
cd example-contract
cargo build --target $TARGET --release

# Optimize the WASM file if wasm-opt is available
if command -v wasm-opt &> /dev/null; then
    echo "Optimizing WASM file..."
    wasm-opt -Os target/$TARGET/release/example_contract.wasm -o target/$TARGET/release/example_contract.wasm
fi

# Copy the compiled WASM file
cp target/$TARGET/release/example_contract.wasm ../compiled-contract.wasm

echo "✅ Contract compiled successfully!"
echo "WASM file: ../compiled-contract.wasm"
echo "File size: $(ls -lh ../compiled-contract.wasm | awk '{print $5}')"

# Test the WASM file
echo "Validating WASM file..."
if file ../compiled-contract.wasm | grep -q "WebAssembly"; then
    echo "✅ WASM file is valid"
else
    echo "❌ WASM file validation failed"
    exit 1
fi

echo ""
echo "Ready for deployment! Use the compiled-contract.wasm file with your deployment service." 