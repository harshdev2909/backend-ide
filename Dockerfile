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

# Install Stellar CLI (Linux x86_64)
RUN curl -L "https://github.com/stellar/stellar-cli/releases/download/v23.0.0/stellar-cli-23.0.0-x86_64-unknown-linux-gnu.tar.gz" \
    -o stellar-cli.tar.gz \
    && tar -xzf stellar-cli.tar.gz \
    && mv stellar-cli-*/stellar /usr/local/bin/stellar \
    && rm -rf stellar-cli*

# Create symlink for backward compatibility (soroban -> stellar)
RUN ln -s /usr/local/bin/stellar /usr/local/bin/soroban

# Create working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Clean npm cache and install dependencies
RUN npm cache clean --force \
    && npm install --production --no-optional \
    && npm cache clean --force

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