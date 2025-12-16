const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Allowed frontend origins (hardcoded)
const allowedOrigins = [
  "https://web-soroban.vercel.app",
  "https://websoroban.in",
  "http://localhost:3000" // Keep localhost for local development
];

// CORS validation function
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io available globally for workers
global.io = io;

// Initialize socket service
const socketService = require('./services/socketService');
socketService.init(io);

// Middleware - CORS configuration
app.use(cors(corsOptions));
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
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`MongoDB URI: ${MONGODB_URI}`);
  
  // Verify Socket.IO is working
  console.log(`Socket.IO namespace: ${io.name}`);
  console.log(`Socket.IO engine: ${io.engine?.constructor?.name || 'unknown'}`);
}); 