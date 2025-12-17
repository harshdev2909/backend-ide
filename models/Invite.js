const mongoose = require('mongoose');
const crypto = require('crypto');

const inviteSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  inviteCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => {
      // Generate secure random code: INV-XXXX-XXXX-XXXX format
      const segments = [];
      for (let i = 0; i < 3; i++) {
        segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
      }
      return `INV-${segments.join('-')}`;
    }
  },
  sent: {
    type: Boolean,
    default: false,
    index: true
  },
  sentAt: {
    type: Date,
    default: null
  },
  used: {
    type: Boolean,
    default: false,
    index: true
  },
  usedAt: {
    type: Date,
    default: null
  },
  usedBy: {
    type: String, // Email of user who used it
    default: null
  }
}, {
  timestamps: true
});

// Index for faster queries
inviteSchema.index({ email: 1, sent: 1 });
inviteSchema.index({ inviteCode: 1, used: 1 });

// Method to mark invite as sent
inviteSchema.methods.markAsSent = function() {
  this.sent = true;
  this.sentAt = new Date();
  return this.save();
};

// Method to mark invite as used
inviteSchema.methods.markAsUsed = function(userEmail) {
  this.used = true;
  this.usedAt = new Date();
  this.usedBy = userEmail;
  return this.save();
};

module.exports = mongoose.model('Invite', inviteSchema);

