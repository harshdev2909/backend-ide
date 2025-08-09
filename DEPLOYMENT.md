# WebSoroban Backend Deployment Guide

This guide covers deploying the WebSoroban backend with Docker support for Rust compilation.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)
- MongoDB (local or cloud)

## Deployment Options

### Option 1: Local Deployment with Docker Compose (Recommended)

```bash
# Navigate to backend directory
cd backend

# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

This will:
- Build the Rust compiler Docker image
- Start the Node.js backend
- Start MongoDB
- Set up all necessary volumes and networking

### Option 2: Render Deployment

1. **Connect your repository to Render**
2. **Create a new Web Service**
3. **Configure the service:**
   - **Build Command:** `docker build -t websoroban-compiler:latest . && npm ci --only=production`
   - **Start Command:** `npm start`
   - **Environment Variables:**
     - `NODE_ENV=production`
     - `PORT=3001`
     - `MONGODB_URI=your_mongodb_connection_string`
   - **Health Check Path:** `/api/health`

4. **Use the `Dockerfile.simple` for Render deployment**

### Option 3: Railway Deployment

1. **Connect your repository to Railway**
2. **Railway will auto-detect the Node.js app**
3. **Add environment variables:**
   - `NODE_ENV=production`
   - `MONGODB_URI=your_mongodb_connection_string`
4. **Railway will automatically deploy**

### Option 4: Heroku Deployment

```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Add MongoDB addon
heroku addons:create mongolab:sandbox

# Deploy
git push heroku main
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3001` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/soroban-ide` |

## Docker Images

### Backend Image (`Dockerfile.backend`)
- Node.js 18 Alpine
- Includes Docker CLI for container management
- Runs the Express.js API server

### Compiler Image (`Dockerfile`)
- Rust 1.85 with Soroban CLI
- Used for compiling Rust contracts to WASM
- Built separately and referenced by the backend

### Simple Image (`Dockerfile.simple`)
- All-in-one container with both Node.js and Rust
- Useful for platforms that don't support Docker-in-Docker
- Larger image size but simpler deployment

## Health Checks

The backend includes a health check endpoint at `/api/health` that returns:
```json
{
  "status": "healthy",
  "timestamp": "2024-08-07T19:30:00.000Z",
  "mongodb": "connected"
}
```

## Troubleshooting

### Common Issues

1. **Docker permission denied**
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

2. **MongoDB connection failed**
   - Check if MongoDB is running
   - Verify connection string
   - Ensure network connectivity

3. **Compiler image not found**
   ```bash
   docker build -t websoroban-compiler:latest .
   ```

4. **Port already in use**
   ```bash
   # Check what's using the port
   lsof -i :3001
   # Kill the process or change PORT environment variable
   ```

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend

# View container logs
docker logs <container_name>
```

## Production Considerations

1. **Use external MongoDB** (MongoDB Atlas, Railway, etc.)
2. **Set up proper environment variables**
3. **Configure CORS for your frontend domain**
4. **Set up monitoring and logging**
5. **Use HTTPS in production**
6. **Consider using a reverse proxy (nginx)**

## Security

- Never commit `.env` files
- Use strong MongoDB passwords
- Configure CORS properly
- Set up rate limiting
- Use HTTPS in production 