const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/payments/verify
 * Verify payment transaction
 */
router.post('/verify', authenticate, async (req, res) => {
  try {
    const { txHash, plan } = req.body;
    const user = req.user;
    
    if (!txHash || !plan) {
      return res.status(400).json({
        success: false,
        error: 'Transaction hash and plan are required'
      });
    }
    
    if (!['plan2', 'plan3'].includes(plan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid plan'
      });
    }
    
    const price = plan === 'plan2' ? 50 : 100;
    const memo = user._id.toString();
    
    // Process payment
    const result = await paymentService.processPayment(txHash, user._id, plan);
    
    if (result.success) {
      // Refresh user data
      await user.populate('subscription');
      
      res.json({
        success: true,
        message: result.message,
        payment: {
          txHash: result.payment.txHash,
          status: result.payment.status,
          amount: result.payment.amount
        },
        subscription: {
          plan: user.subscription.plan,
          status: user.subscription.status,
          endDate: user.subscription.endDate
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment',
      message: error.message
    });
  }
});

/**
 * GET /api/payments/history
 * Get payment history for current user
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await paymentService.monitorPayments(req.user._id, limit);
    
    if (result.success) {
      res.json({
        success: true,
        payments: result.payments
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get payment history',
      message: error.message
    });
  }
});

module.exports = router;
