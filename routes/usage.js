const express = require('express');
const router = express.Router();
const User = require('../models/User');
const UsageLog = require('../models/UsageLog');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/usage
 * Get current user's usage statistics
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const user = req.user;
    
    // Get usage logs for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const logs = await UsageLog.find({
      userId: user._id,
      createdAt: { $gte: thirtyDaysAgo }
    }).sort({ createdAt: -1 }).limit(100);
    
    // Calculate statistics
    const stats = {
      deployments: {
        total: logs.filter(l => l.action === 'deploy').length,
        successful: logs.filter(l => l.action === 'deploy' && l.success).length,
        failed: logs.filter(l => l.action === 'deploy' && !l.success).length
      },
      compilations: {
        total: logs.filter(l => l.action === 'compile').length,
        successful: logs.filter(l => l.action === 'compile' && l.success).length,
        failed: logs.filter(l => l.action === 'compile' && !l.success).length
      },
      functionTests: {
        total: logs.filter(l => l.action === 'function_test').length,
        successful: logs.filter(l => l.action === 'function_test' && l.success).length,
        failed: logs.filter(l => l.action === 'function_test' && !l.success).length
      }
    };
    
    res.json({
      success: true,
      usage: {
        deployments: {
          count: user.usage.deployments.count,
          limit: user.usage.deployments.limit,
          remaining: user.usage.deployments.limit === -1 
            ? 'unlimited' 
            : Math.max(0, user.usage.deployments.limit - user.usage.deployments.count),
          lastResetDate: user.usage.deployments.lastResetDate
        },
        functionTests: {
          count: user.usage.functionTests.count,
          limit: user.usage.functionTests.limit,
          remaining: user.usage.functionTests.limit === -1 
            ? 'unlimited' 
            : Math.max(0, user.usage.functionTests.limit - user.usage.functionTests.count),
          lastResetDate: user.usage.functionTests.lastResetDate
        }
      },
      statistics: stats,
      logs: logs.slice(0, 20) // Return last 20 logs
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage statistics',
      message: error.message
    });
  }
});

module.exports = router;
