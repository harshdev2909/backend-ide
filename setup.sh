#!/bin/bash

echo "🚀 Setting up WebSoroban IDE Backend..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

echo "✅ Docker found"

# Build the compiler Docker image
echo "🔨 Building Rust compiler Docker image..."
docker build -t websoroban-compiler:latest .

if [ $? -eq 0 ]; then
    echo "✅ Compiler image built successfully"
else
    echo "❌ Failed to build compiler image"
    exit 1
fi

# Check if Soroban CLI is installed
if ! command -v soroban &> /dev/null; then
    echo "⚠️  Soroban CLI is not installed. Installing..."
    # Try the correct installation method
    curl -sSfL https://soroban.stellar.org/install.sh | sh
    if [ $? -eq 0 ]; then
        export PATH="$HOME/.local/bin:$PATH"
        echo "✅ Soroban CLI installed"
    else
        echo "❌ Failed to install Soroban CLI. Please install manually:"
        echo "   Visit: https://soroban.stellar.org/docs/getting-started/setup"
        echo "   Or run: cargo install --locked --git https://github.com/stellar/soroban-cli soroban-cli"
    fi
else
    echo "✅ Soroban CLI found"
fi

echo "🎉 Setup complete! You can now start the backend with: npm run dev" 