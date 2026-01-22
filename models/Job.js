const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['compile', 'deploy'],
    required: true
  },
  status: {
    type: String,
    enum: ['queued', 'active', 'completed', 'failed'],
    default: 'queued',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  bullJobId: {
    type: String,
    required: true,
    unique: true
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for faster queries
jobSchema.index({ userId: 1, createdAt: -1 });
jobSchema.index({ project: 1, createdAt: -1 });
jobSchema.index({ status: 1, createdAt: -1 });
// Note: bullJobId index is automatically created by unique: true

module.exports = mongoose.model('Job', jobSchema);

