FROM rust:1.85-slim

# Install system dependencies including Node.js
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    pkg-config \
    libssl-dev \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install wasm32v1 target for Rust 1.85+
RUN rustup target add wasm32v1-none

# Install Stellar CLI (which includes Soroban functionality)
# Use pre-compiled binary to avoid memory issues during compilation
RUN curl -L -o /tmp/stellar-cli.tar.gz https://github.com/stellar/stellar-cli/releases/download/v23.0.0/stellar-cli-23.0.0-x86_64-unknown-linux-gnu.tar.gz \
    && tar -xzf /tmp/stellar-cli.tar.gz -C /tmp \
    && mv /tmp/stellar-cli-23.0.0-x86_64-unknown-linux-gnu/stellar /usr/local/bin/stellar \
    && chmod +x /usr/local/bin/stellar \
    && rm -rf /tmp/stellar-cli*

# Create symlink for backward compatibility (soroban -> stellar)
RUN ln -s /usr/local/bin/stellar /usr/local/bin/soroban

# Create working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Copy compilation script
COPY scripts/compile.sh /usr/local/bin/compile.sh
RUN chmod +x /usr/local/bin/compile.sh

# Create necessary directories
RUN mkdir -p /app/temp /app/logs

# Expose port
EXPOSE 3001

# Start the Node.js application
CMD ["npm", "start"]