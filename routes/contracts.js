const express = require('express');
const router = express.Router();
const User = require('../models/User');
const UsageLog = require('../models/UsageLog');
const deploymentService = require('../services/deploymentService');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/contracts/:contractAddress/invoke
 * Invoke a contract function (with usage limit check)
 */
router.post('/:contractAddress/invoke', authenticate, async (req, res) => {
  try {
    const { contractAddress } = req.params;
    const { functionName, args = [], network = 'testnet' } = req.body;
    const user = req.user;
    
    if (!functionName) {
      return res.status(400).json({
        success: false,
        error: 'Function name is required'
      });
    }
    
    // Check function test limit
    const canTest = user.canTestFunction();
    if (!canTest.allowed) {
      return res.status(403).json({
        success: false,
        error: canTest.reason,
        current: canTest.current,
        limit: canTest.limit,
        upgradeRequired: true
      });
    }
    
    // Log usage attempt
    const usageLog = new UsageLog({
      userId: user._id,
      action: 'function_test',
      contractAddress,
      functionName,
      success: false,
      metadata: {
        args,
        network
      }
    });
    
    try {
      // Invoke contract function
      const result = await deploymentService.invokeContract(
        contractAddress,
        functionName,
        args,
        null, // sourceAccount - will use default
        network
      );
      
      // Increment usage count
      await user.incrementFunctionTest();
      
      // Update usage log
      usageLog.success = result.success;
      usageLog.metadata.output = result.output;
      if (!result.success) {
        usageLog.error = result.error;
      }
      await usageLog.save();
      
      if (result.success) {
        res.json({
          success: true,
          output: result.output,
          contractAddress,
          functionName,
          args,
          usage: {
            count: user.usage.functionTests.count,
            limit: user.usage.functionTests.limit,
            remaining: user.usage.functionTests.limit === -1 
              ? 'unlimited' 
              : Math.max(0, user.usage.functionTests.limit - user.usage.functionTests.count)
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          logs: result.logs
        });
      }
    } catch (error) {
      // Update usage log with error
      usageLog.success = false;
      usageLog.error = error.message;
      await usageLog.save();
      
      console.error('Contract invocation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to invoke contract function',
        message: error.message
      });
    }
  } catch (error) {
    console.error('Invoke contract error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invoke contract',
      message: error.message
    });
  }
});

/**
 * GET /api/contracts/:contractAddress
 * Get contract information
 */
router.get('/:contractAddress', authenticate, async (req, res) => {
  try {
    const { contractAddress } = req.params;
    
    // Get usage logs for this contract
    const logs = await UsageLog.find({
      contractAddress,
      userId: req.user._id,
      action: 'function_test'
    }).sort({ createdAt: -1 }).limit(10);
    
    res.json({
      success: true,
      contractAddress,
      functionTests: logs.length,
      recentTests: logs.map(log => ({
        functionName: log.functionName,
        success: log.success,
        createdAt: log.createdAt
      }))
    });
  } catch (error) {
    console.error('Get contract error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contract information',
      message: error.message
    });
  }
});

module.exports = router;
