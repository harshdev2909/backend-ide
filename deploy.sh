#!/bin/bash

echo "🚀 Deploying WebSoroban Backend..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose found"

# Build the compiler image first
echo "🔨 Building Rust compiler image..."
docker build -t websoroban-compiler:latest .

if [ $? -eq 0 ]; then
    echo "✅ Compiler image built successfully"
else
    echo "❌ Failed to build compiler image"
    exit 1
fi

# Create necessary directories
mkdir -p temp logs

# Set environment variables
export NODE_ENV=production
export PORT=3001

# If MONGODB_URI is not set, use local MongoDB
if [ -z "$MONGODB_URI" ]; then
    echo "ℹ️  Using local MongoDB. Set MONGODB_URI environment variable for external database."
fi

# Build and start services
echo "🚀 Starting services with Docker Compose..."
docker-compose up --build -d

if [ $? -eq 0 ]; then
    echo "✅ Services started successfully"
    echo "📊 Backend is running on http://localhost:3001"
    echo "📊 MongoDB is running on localhost:27017"
    echo ""
    echo "🔍 Check logs with: docker-compose logs -f"
    echo "🛑 Stop services with: docker-compose down"
else
    echo "❌ Failed to start services"
    exit 1
fi 