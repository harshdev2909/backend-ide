# Queue-Based Architecture Documentation

## Overview

The backend has been refactored to use BullMQ + Redis for queue-based job processing, enabling horizontal scalability and handling 10,000+ concurrent users.

## Architecture Changes

### 1. Queue Infrastructure

- **queues/bullmq.js**: Shared BullMQ setup with Redis connection
- **queues/compileQueue.js**: Compile job queue
- **queues/deployQueue.js**: Deploy job queue

### 2. Workers

- **workers/compileWorker.js**: Processes compile jobs
- **workers/deployWorker.js**: Processes deploy jobs

Workers run independently and can be scaled horizontally.

### 3. Job Model

- **models/Job.js**: MongoDB model for tracking job status
  - Fields: `type`, `status`, `project`, `bullJobId`, `result`, `error`
  - Statuses: `queued`, `active`, `completed`, `failed`

### 4. API Changes

#### Compile Endpoint (`POST /api/compile`)
- Returns `202 Accepted` immediately with `jobId`
- Job is queued for async processing
- Check status via `GET /api/jobs/:id`

#### Deploy Endpoint (`POST /api/deploy`)
- Returns `202 Accepted` immediately with `jobId`
- Job is queued for async processing
- Check status via `GET /api/jobs/:id`

#### Job Status Endpoint (`GET /api/jobs/:id`)
- Returns current job status and result
- Use this to poll for completion

## Environment Variables

```bash
# Redis configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Worker concurrency
COMPILE_WORKER_CONCURRENCY=2
DEPLOY_WORKER_CONCURRENCY=2

# Worker type (for worker containers)
WORKER_TYPE=compile  # or 'deploy'
```

## Running Locally

### Prerequisites
- Redis running on localhost:6379
- MongoDB running

**Important**: Make sure Redis is running before starting the API or workers:
```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or using Homebrew (macOS)
brew services start redis

# Or using system package manager
# Ubuntu/Debian: sudo systemctl start redis
# macOS: redis-server
```

### Start API Server
```bash
# Make sure REDIS_HOST=localhost in your .env file
npm start
# or
npm run dev
```

### Start Workers
```bash
# Terminal 1: Compile worker
npm run worker:compile

# Terminal 2: Deploy worker
npm run worker:deploy
```

### Environment Variables for Local Development

Create a `.env` file with:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
MONGODB_URI=mongodb://localhost:27017/soroban-ide
```

## Docker Deployment

### Using docker-compose

```bash
docker-compose up -d
```

This starts:
- `redis`: Redis 7 for queue storage
- `mongodb`: MongoDB 7 for data storage
- `api`: Express API server
- `worker-compile`: Compile job worker
- `worker-deploy`: Deploy job worker

### Scaling Workers

To scale workers horizontally:

```bash
docker-compose up -d --scale worker-compile=3 --scale worker-deploy=2
```

## Job Flow

1. **Client** → `POST /api/compile` or `POST /api/deploy`
2. **API** → Creates Job document in MongoDB
3. **API** → Enqueues job to BullMQ queue
4. **API** → Returns `202 Accepted` with `jobId`
5. **Worker** → Picks up job from queue
6. **Worker** → Updates Job status to `active`
7. **Worker** → Calls service (compilationService/deploymentService)
8. **Worker** → Updates Job status to `completed` or `failed`
9. **Worker** → Updates Project document
10. **Client** → Polls `GET /api/jobs/:id` for status

## Benefits

- **Horizontal Scalability**: Add more workers as needed
- **Resilience**: Jobs are persisted in Redis and MongoDB
- **Non-blocking**: API responds immediately
- **Monitoring**: Job status tracked in MongoDB
- **Retry Logic**: BullMQ handles retries automatically

## Monitoring

- Check job status: `GET /api/jobs/:id`
- List jobs: `GET /api/jobs?projectId=xxx&status=queued`
- Redis CLI: `redis-cli` → `KEYS bull:*` to see queue keys

