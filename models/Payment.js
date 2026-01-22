const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null
  },
  plan: {
    type: String,
    enum: ['plan2', 'plan3'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'XLM'
  },
  txHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  network: {
    type: String,
    enum: ['testnet', 'mainnet'],
    required: true
  },
  fromAddress: {
    type: String,
    required: true
  },
  toAddress: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'refunded'],
    default: 'pending'
  },
  confirmedAt: {
    type: Date,
    default: null
  },
  blockNumber: {
    type: Number,
    default: null
  },
  memo: {
    type: String,
    default: null
  },
  verified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ txHash: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
