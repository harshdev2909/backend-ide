const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['free', 'plan2', 'plan3'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired'],
    default: 'active'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  paymentTxHash: {
    type: String,
    default: null,
    index: true
  },
  paymentNetwork: {
    type: String,
    enum: ['testnet', 'mainnet'],
    default: null
  },
  amount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'XLM'
  },
  autoRenew: {
    type: Boolean,
    default: false
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancelledReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ paymentTxHash: 1 });
subscriptionSchema.index({ endDate: 1 });

// Method to check if subscription is active
subscriptionSchema.methods.isActive = function() {
  if (this.status !== 'active') {
    return false;
  }
  
  if (this.endDate && new Date() > this.endDate) {
    return false;
  }
  
  return true;
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
