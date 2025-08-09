#!/bin/bash

# Build script with memory optimization options
set -e

echo "🔨 WebSoroban IDE Backend Build Script"
echo "========================================"

# Function to check available memory
check_memory() {
    if command -v free &> /dev/null; then
        MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
        echo "Available memory: ${MEMORY_GB}GB"
        return $MEMORY_GB
    else
        echo "Could not determine memory, assuming 4GB"
        return 4
    fi
}

# Function to build with memory limits
build_with_memory_limits() {
    local memory_limit=$1
    local dockerfile=$2
    
    echo "Building with memory limit: ${memory_limit}GB"
    echo "Using Dockerfile: ${dockerfile}"
    
    # Set Docker build memory limit
    export DOCKER_BUILDKIT=1
    
    # Build with memory constraints
    docker build \
        --memory=${memory_limit}g \
        --memory-swap=${memory_limit}g \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        -f "${dockerfile}" \
        -t websoroban-backend:latest .
    
    if [ $? -eq 0 ]; then
        echo "✅ Build completed successfully!"
        return 0
    else
        echo "❌ Build failed"
        return 1
    fi
}

# Main build logic
main() {
    local memory_gb=$(check_memory)
    
    echo "Memory check completed: ${memory_gb}GB available"
    
    # Choose build strategy based on available memory
    if [ $memory_gb -ge 8 ]; then
        echo "High memory system detected (${memory_gb}GB), using multi-stage build"
        build_with_memory_limits 6 "Dockerfile.deploy"
    elif [ $memory_gb -ge 4 ]; then
        echo "Medium memory system detected (${memory_gb}GB), using optimized build"
        build_with_memory_limits 3 "Dockerfile.deploy"
    else
        echo "Low memory system detected (${memory_gb}GB), using simple build"
        build_with_memory_limits 2 "Dockerfile.deploy.simple"
    fi
}

# Show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --simple     Use simple Dockerfile (no cargo install)"
    echo "  --multi      Use multi-stage Dockerfile"
    echo "  --memory N   Set memory limit in GB"
    echo "  --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Auto-detect memory and choose strategy"
    echo "  $0 --simple           # Use simple build (recommended for low memory)"
    echo "  $0 --multi            # Use multi-stage build (recommended for high memory)"
    echo "  $0 --memory 4         # Set 4GB memory limit"
}

# Parse command line arguments
case "${1:-}" in
    --simple)
        echo "Using simple build strategy..."
        build_with_memory_limits 2 "Dockerfile.deploy.simple"
        ;;
    --multi)
        echo "Using multi-stage build strategy..."
        build_with_memory_limits 6 "Dockerfile.deploy"
        ;;
    --memory)
        if [ -z "$2" ]; then
            echo "Error: Memory limit not specified"
            show_usage
            exit 1
        fi
        echo "Using custom memory limit: ${2}GB"
        build_with_memory_limits "$2" "Dockerfile.deploy"
        ;;
    --help|-h)
        show_usage
        exit 0
        ;;
    "")
        main
        ;;
    *)
        echo "Unknown option: $1"
        show_usage
        exit 1
        ;;
esac 