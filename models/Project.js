const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'file'
  },
  content: {
    type: String,
    default: ''
  }
});

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: 'Untitled Project'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  files: [fileSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastDeployed: {
    type: Date,
    default: null
  },
  contractAddress: {
    type: String,
    default: null
  },
  deploymentHistory: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    contractAddress: String,
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success'
    },
    logs: [String]
  }],
  isLocal: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
projectSchema.index({ userId: 1, updatedAt: -1 });

// Update the updatedAt field when files are modified
projectSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Project', projectSchema); 