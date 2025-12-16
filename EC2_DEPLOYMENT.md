# EC2 Deployment Guide

This guide provides step-by-step commands to deploy the WebSoroban backend on an AWS EC2 instance.

## Prerequisites

- AWS EC2 instance (Ubuntu 22.04 LTS recommended)
- Security Group configured to allow:
  - Port 22 (SSH)
  - Port 3001 (Backend API)
  - Port 6379 (Redis - optional, only if accessing externally)
- MongoDB Atlas account (or MongoDB running elsewhere)

## Step 1: Connect to EC2 Instance

```bash
# Replace with your EC2 key pair and instance details
ssh -i /path/to/your-key.pem ubuntu@your-ec2-instance-ip
```

## Step 2: Update System and Install Dependencies

```bash
# Update package list
sudo apt-get update

# Install required packages
sudo apt-get install -y \
    curl \
    git \
    ca-certificates \
    gnupg \
    lsb-release

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Activate docker group without logging out
newgrp docker

# Verify installations
docker --version
docker-compose --version
```

## Step 3: Clone Repository

```bash
# Create application directory
mkdir -p ~/apps
cd ~/apps

# Clone your repository (replace with your repo URL)
git clone https://github.com/your-username/your-repo.git ide
cd ide/backend-ide

# Or if using SSH:
# git clone git@github.com:your-username/your-repo.git ide
```

## Step 4: Set Up Environment Variables

```bash
# Create .env file
cp env.example .env

# Edit .env file with your configuration
nano .env
```

**Required `.env` configuration:**

```bash
# Server Configuration
PORT=3001
NODE_ENV=production

# MongoDB (use MongoDB Atlas or external MongoDB)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/soroban-ide?retryWrites=true&w=majority

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Frontend URL (for CORS and Socket.IO)
FRONTEND_URL=https://your-frontend-domain.com

# Worker Concurrency
COMPILE_WORKER_CONCURRENCY=2
DEPLOY_WORKER_CONCURRENCY=2
```

**Save and exit:** Press `Ctrl+X`, then `Y`, then `Enter`

## Step 5: Check Disk Space and Clean Up Docker

**IMPORTANT:** EC2 instances often have limited disk space. Check and clean up before building:

```bash
# Check disk space
df -h

# Check Docker disk usage
docker system df

# Clean up Docker (removes unused images, containers, volumes, and build cache)
docker system prune -a --volumes -f

# If still low on space, remove specific unused resources
# Remove stopped containers
docker container prune -f

# Remove unused images
docker image prune -a -f

# Remove unused volumes
docker volume prune -f

# Remove build cache (this can free up significant space)
docker builder prune -a -f

# Check disk space again
df -h
```

**If disk space is still low (< 2GB free):**
- Consider resizing your EBS volume (see AWS Console → EC2 → Volumes)
- Or use a larger instance type
- Minimum recommended: 10GB free space for Docker builds

## Step 6: Build Docker Images

```bash
# Build the compiler image first
docker build -t websoroban-compiler:latest -f Dockerfile .

# Verify image was created
docker images | grep websoroban-compiler
```

## Step 7: Start Services with Docker Compose

```bash
# Start all services (Redis, API, Workers)
docker compose up -d

# Check service status
docker compose ps

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f api
docker compose logs -f worker-compile
docker compose logs -f worker-deploy
```

## Step 8: Verify Deployment

```bash
# Check health endpoint
curl http://localhost:3001/api/health

# Expected response:
# {"status":"healthy","timestamp":"...","mongodb":"connected"}

# Check if all containers are running
docker compose ps
```

## Step 9: Configure Security Group (AWS Console)

1. Go to **EC2 Dashboard** → **Security Groups**
2. Select your instance's security group
3. Add **Inbound Rule**:
   - **Type:** Custom TCP
   - **Port:** 3001
   - **Source:** 0.0.0.0/0 (or your specific IP for security)
   - **Description:** Backend API

## Step 10: Set Up Nginx Reverse Proxy (Optional but Recommended)

```bash
# Install Nginx
sudo apt-get install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/backend-ide
```

**Nginx configuration:**

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain or EC2 IP

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/backend-ide /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx to start on boot
sudo systemctl enable nginx
```

## Step 11: Set Up SSL with Let's Encrypt (Optional)

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Certbot will automatically configure Nginx and set up auto-renewal
```

## Step 12: Set Up Auto-Start on Reboot

```bash
# Create systemd service for Docker Compose
sudo nano /etc/systemd/system/backend-ide.service
```

**Service file:**

```ini
[Unit]
Description=WebSoroban Backend IDE
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/apps/ide/backend-ide
ExecStart=/usr/local/bin/docker compose up -d
ExecStop=/usr/local/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable backend-ide.service
sudo systemctl start backend-ide.service

# Check status
sudo systemctl status backend-ide.service
```

## Useful Commands

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f worker-compile
docker compose logs -f worker-deploy
docker compose logs -f redis

# Last 100 lines
docker compose logs --tail=100 api
```

### Restart Services
```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart api
docker compose restart worker-compile
docker compose restart worker-deploy
```

### Stop Services
```bash
# Stop all services
docker compose down

# Stop and remove volumes (⚠️ deletes data)
docker compose down -v
```

### Update Application
```bash
# Pull latest code
cd ~/apps/ide/backend-ide
git pull

# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d

# Or rebuild specific service
docker compose build api
docker compose up -d api
```

### Check Resource Usage
```bash
# Container stats
docker stats

# Disk usage
df -h
docker system df
```

### Clean Up Docker
```bash
# Remove unused images, containers, networks
docker system prune -a

# Remove volumes (⚠️ deletes data)
docker volume prune
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using port 3001
sudo lsof -i :3001

# Kill the process
sudo kill -9 <PID>
```

### Docker Permission Denied
```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker
```

### MongoDB Connection Failed
```bash
# Test MongoDB connection
docker compose exec api node -e "require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(e => console.error(e))"

# Check MongoDB URI in .env
cat .env | grep MONGODB_URI
```

### Redis Connection Failed
```bash
# Test Redis connection
docker compose exec redis redis-cli ping

# Check Redis logs
docker compose logs redis
```

### Container Keeps Restarting
```bash
# Check container logs
docker compose logs api

# Check container status
docker compose ps

# Inspect container
docker inspect backend-ide-api-1
```

## Monitoring

### Set Up CloudWatch (Optional)
```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure CloudWatch agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -c ssm:AmazonCloudWatch-linux -s
```

## Security Best Practices

1. **Use MongoDB Atlas** instead of local MongoDB
2. **Restrict Security Group** to specific IPs instead of 0.0.0.0/0
3. **Use Environment Variables** for sensitive data, never commit `.env`
4. **Set up Firewall** (UFW):
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```
5. **Regular Updates**:
   ```bash
   sudo apt-get update && sudo apt-get upgrade -y
   ```
6. **Use SSL/HTTPS** with Let's Encrypt
7. **Monitor Logs** regularly for suspicious activity

## Quick Start Script

Save this as `deploy-ec2.sh` and run it:

```bash
#!/bin/bash
set -e

echo "🚀 Starting EC2 deployment..."

# Update system
sudo apt-get update

# Install Docker
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Build compiler image
docker build -t websoroban-compiler:latest -f Dockerfile .

# Start services
docker compose up -d

echo "✅ Deployment complete!"
echo "Check logs with: docker compose logs -f"
echo "Check health: curl http://localhost:3001/api/health"
```

Make it executable:
```bash
chmod +x deploy-ec2.sh
./deploy-ec2.sh
```

