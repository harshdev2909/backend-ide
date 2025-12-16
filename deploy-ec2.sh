#!/bin/bash
# EC2 Deployment Script for WebSoroban Backend
# Run this script on your EC2 instance

set -e

echo "🚀 Starting EC2 deployment for WebSoroban Backend..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Update system
echo -e "${YELLOW}Step 1: Updating system packages...${NC}"
sudo apt-get update -y
sudo apt-get install -y curl git ca-certificates gnupg lsb-release

# Step 2: Install Docker
echo -e "${YELLOW}Step 2: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}✓ Docker installed${NC}"
    echo -e "${YELLOW}⚠️  Activating docker group...${NC}"
    newgrp docker << EOF
# Continue script in new shell with docker group
EOF
else
    echo -e "${GREEN}✓ Docker already installed${NC}"
fi

# Ensure user is in docker group
if ! groups | grep -q docker; then
    echo -e "${YELLOW}Adding user to docker group...${NC}"
    sudo usermod -aG docker $USER
    echo -e "${YELLOW}⚠️  Please run: newgrp docker${NC}"
    echo -e "${YELLOW}Or use sudo with docker commands${NC}"
fi

# Step 3: Install Docker Compose
echo -e "${YELLOW}Step 3: Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✓ Docker Compose already installed${NC}"
fi

# Step 4: Verify installations
echo -e "${YELLOW}Step 4: Verifying installations...${NC}"
docker --version
docker-compose --version

# Step 5: Check if repository exists
echo -e "${YELLOW}Step 5: Checking repository...${NC}"
if [ ! -d "backend-ide" ]; then
    echo -e "${RED}✗ backend-ide directory not found${NC}"
    echo -e "${YELLOW}Please clone your repository first:${NC}"
    echo "  git clone <your-repo-url>"
    echo "  cd ide/backend-ide"
    exit 1
fi

cd backend-ide

# Step 6: Check .env file
echo -e "${YELLOW}Step 6: Checking environment configuration...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env from env.example...${NC}"
    cp env.example .env
    echo -e "${RED}⚠️  Please edit .env file with your configuration before continuing!${NC}"
    echo -e "${YELLOW}Required variables:${NC}"
    echo "  - MONGODB_URI (MongoDB Atlas connection string)"
    echo "  - FRONTEND_URL (Your frontend domain)"
    echo ""
    read -p "Press Enter after you've configured .env file..."
fi

# Step 7: Check disk space and clean up Docker
echo -e "${YELLOW}Step 7: Checking disk space...${NC}"
AVAILABLE_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
echo "Available disk space: ${AVAILABLE_SPACE}GB"

if [ "$AVAILABLE_SPACE" -lt 2 ]; then
    echo -e "${YELLOW}⚠️  Low disk space detected. Cleaning up Docker...${NC}"
    docker system prune -a --volumes -f || true
    docker builder prune -a -f || true
    echo -e "${GREEN}✓ Docker cleanup completed${NC}"
    
    # Check again
    AVAILABLE_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    echo "Available disk space after cleanup: ${AVAILABLE_SPACE}GB"
    
    if [ "$AVAILABLE_SPACE" -lt 2 ]; then
        echo -e "${RED}✗ Still low on disk space (< 2GB). Please free up space or resize EBS volume.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Sufficient disk space available${NC}"
fi

# Step 8: Build compiler image
echo -e "${YELLOW}Step 8: Building compiler Docker image...${NC}"
docker build -t websoroban-compiler:latest -f Dockerfile . || {
    echo -e "${RED}✗ Failed to build compiler image${NC}"
    echo -e "${YELLOW}This might be due to low disk space. Try cleaning up:${NC}"
    echo "  docker system prune -a --volumes -f"
    echo "  docker builder prune -a -f"
    exit 1
}
echo -e "${GREEN}✓ Compiler image built${NC}"

# Step 9: Start services
echo -e "${YELLOW}Step 9: Starting services with Docker Compose...${NC}"
docker compose up -d || {
    echo -e "${RED}✗ Failed to start services${NC}"
    exit 1
}

# Step 10: Wait for services to be healthy
echo -e "${YELLOW}Step 10: Waiting for services to start...${NC}"
sleep 10

# Step 11: Check health
echo -e "${YELLOW}Step 11: Checking service health...${NC}"
for i in {1..30}; do
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API is healthy!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ API health check failed after 30 attempts${NC}"
        echo -e "${YELLOW}Check logs with: docker compose logs${NC}"
        exit 1
    fi
    echo -n "."
    sleep 2
done

# Step 12: Show status
echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${YELLOW}Service Status:${NC}"
docker compose ps

echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  View logs:        docker compose logs -f"
echo "  View API logs:    docker compose logs -f api"
echo "  Restart services: docker compose restart"
echo "  Stop services:    docker compose down"
echo "  Health check:     curl http://localhost:3001/api/health"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to:${NC}"
echo "  1. Configure EC2 Security Group to allow port 3001"
echo "  2. Set up Nginx reverse proxy (optional but recommended)"
echo "  3. Configure SSL certificate (optional)"
echo ""

