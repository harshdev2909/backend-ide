const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io available globally for workers
global.io = io;

// Initialize socket service
const socketService = require('./services/socketService');
socketService.init(io);

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soroban-ide';
mongoose.connect(MONGODB_URI);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Routes
app.use('/api/projects', require('./routes/projects'));
app.use('/api/compile', require('./routes/compile'));
app.use('/api/deploy', require('./routes/deploy'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/jobs', require('./routes/jobs'));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  
  // Handle job subscription
  socket.on('subscribe:job', (jobId) => {
    console.log(`[Socket.IO] Client ${socket.id} subscribed to job: ${jobId}`);
    socket.join(`job:${jobId}`);
  });
  
  // Handle job unsubscription
  socket.on('unsubscribe:job', (jobId) => {
    console.log(`[Socket.IO] Client ${socket.id} unsubscribed from job: ${jobId}`);
    socket.leave(`job:${jobId}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.IO server initialized`);
  console.log(`Socket.IO CORS origin: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
  console.log(`MongoDB URI: ${MONGODB_URI}`);
  
  // Verify Socket.IO is working
  console.log(`Socket.IO namespace: ${io.name}`);
  console.log(`Socket.IO engine: ${io.engine?.constructor?.name || 'unknown'}`);
}); 