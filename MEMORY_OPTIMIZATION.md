# Memory Optimization for Docker Builds

## Problem
The original Docker build was failing with memory exhaustion during the `cargo install` step for the Stellar CLI. This is a common issue when building Rust applications in Docker containers with limited memory.

## Solutions

### 1. Multi-Stage Build (Recommended for High Memory Systems)
The `Dockerfile.deploy` now uses a multi-stage build approach:
- **Stage 1**: Rust builder with all dependencies
- **Stage 2**: Final Node.js image with copied binaries

**Benefits:**
- Separates memory-intensive compilation from final image
- Reduces final image size
- Better memory management

**Usage:**
```bash
# Auto-detect memory and choose strategy
./build-with-memory-options.sh

# Force multi-stage build
./build-with-memory-options.sh --multi
```

### 2. Simple Build (Recommended for Low Memory Systems)
The `Dockerfile.deploy.simple` avoids cargo install entirely:
- Uses pre-built binaries when available
- Falls back gracefully if binaries aren't available
- Minimal memory footprint

**Usage:**
```bash
# Use simple build strategy
./build-with-memory-options.sh --simple

# Build directly with Docker
docker build -f Dockerfile.deploy.simple -t websoroban-backend:latest .
```

### 3. Memory-Limited Builds
The build script can set memory limits for Docker builds:

```bash
# Set 4GB memory limit
./build-with-memory-options.sh --memory 4

# Set 2GB memory limit for low-memory systems
./build-with-memory-options.sh --memory 2
```

## Memory Requirements

| System Memory | Recommended Strategy | Memory Limit |
|---------------|---------------------|--------------|
| 8GB+          | Multi-stage build   | 6GB          |
| 4-8GB         | Optimized build     | 3GB          |
| <4GB          | Simple build        | 2GB          |

## Troubleshooting

### If you still get memory errors:

1. **Increase Docker memory allocation:**
   - Docker Desktop: Settings → Resources → Memory (increase to 8GB+)
   - Docker Engine: Add `--memory=8g` to daemon options

2. **Use swap space:**
   ```bash
   # On Linux, create swap file
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

3. **Build on a more powerful machine:**
   - Use a cloud instance with more RAM
   - Use GitHub Actions or similar CI/CD with higher memory limits

### Alternative: Skip Stellar CLI Installation

If you don't need the Stellar CLI in the container, you can modify the Dockerfile to skip it entirely:

```dockerfile
# Comment out or remove the Stellar CLI installation
# RUN cargo install --locked --git https://github.com/stellar/stellar-cli stellar-cli
```

## Environment Variables for Memory Optimization

You can set these environment variables to optimize the build:

```bash
# Reduce parallel jobs
export CARGO_BUILD_JOBS=1

# Use git CLI for fetching (more memory efficient)
export CARGO_NET_GIT_FETCH_WITH_CLI=true

# Optimize for current CPU
export RUSTFLAGS="-C target-cpu=native"

# Disable debug info to reduce memory usage
export RUSTFLAGS="$RUSTFLAGS -C debuginfo=0"
```

## Monitoring Memory Usage

To monitor memory usage during builds:

```bash
# Watch memory usage during build
watch -n 1 'free -h && docker stats --no-stream'

# Check Docker daemon memory usage
docker system df
```

## Best Practices

1. **Always use the build script** for consistent results
2. **Monitor system resources** before starting builds
3. **Use appropriate memory limits** for your system
4. **Consider using pre-built images** when possible
5. **Clean up Docker resources** regularly:
   ```bash
   docker system prune -a
   docker builder prune
   ``` 