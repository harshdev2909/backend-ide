const mongoose = require('mongoose');

const usageLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ['compile', 'deploy', 'function_test'],
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
  },
  contractAddress: {
    type: String,
    default: null
  },
  functionName: {
    type: String,
    default: null
  },
  success: {
    type: Boolean,
    default: true
  },
  error: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
usageLogSchema.index({ userId: 1, createdAt: -1 });
usageLogSchema.index({ userId: 1, action: 1, createdAt: -1 });
usageLogSchema.index({ contractAddress: 1 });

module.exports = mongoose.model('UsageLog', usageLogSchema);
