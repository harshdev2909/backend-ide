const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { authenticate } = require('../middleware/auth');
const emailService = require('../services/emailService');

/**
 * POST /api/premium-gifts/gift
 * Gift premium subscription to a user (new or existing)
 */
router.post('/gift', authenticate, async (req, res) => {
  try {
    const { email, durationDays = 30 } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const duration = parseInt(durationDays, 10) || 30;

    // Find or create user
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Create new user with premium subscription
      user = new User({
        email: normalizedEmail,
        authMethod: 'gmail',
        subscription: {
          plan: 'plan3',
          status: 'active',
          startDate: new Date(),
        },
        usage: {
          deployments: {
            count: 0,
            limit: -1, // Unlimited
            lastResetDate: new Date()
          },
          functionTests: {
            count: 0,
            limit: -1, // Unlimited
            lastResetDate: new Date()
          }
        }
      });

      // Set end date
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + duration);
      user.subscription.endDate = endDate;

      await user.save();

      // Create subscription record
      const subscription = new Subscription({
        userId: user._id,
        plan: 'plan3',
        status: 'active',
        startDate: new Date(),
        endDate: endDate,
        amount: 0, // Gifted
        currency: 'XLM',
        paymentTxHash: `GIFTED-${Date.now()}`,
        autoRenew: false
      });
      await subscription.save();

      // Send email notification
      const emailResult = await emailService.sendPremiumGiftNotification(
        normalizedEmail,
        duration,
        true, // isNewUser
        endDate
      );

      if (!emailResult.success) {
        console.error(`[PremiumGifts] Failed to send email to ${normalizedEmail}:`, emailResult.error);
      }

      return res.json({
        success: true,
        message: `Premium subscription gifted to new user ${normalizedEmail}`,
        user: {
          email: user.email,
          subscription: {
            plan: user.subscription.plan,
            status: user.subscription.status,
            startDate: user.subscription.startDate,
            endDate: user.subscription.endDate
          }
        },
        isNewUser: true,
        emailSent: emailResult.success,
        emailError: emailResult.error || null
      });
    }

    // User exists - upgrade to premium
    const startDate = new Date();
    let endDate = new Date();

    // If user already has an active premium subscription, extend it
    if (user.subscription.plan === 'plan3' && user.subscription.status === 'active') {
      const currentEndDate = user.subscription.endDate ? new Date(user.subscription.endDate) : new Date();
      if (currentEndDate > new Date()) {
        // Extend existing subscription
        endDate = new Date(currentEndDate);
        endDate.setDate(endDate.getDate() + duration);
      } else {
        // Current subscription expired, start new one
        endDate.setDate(endDate.getDate() + duration);
      }
    } else {
      // New premium subscription
      endDate.setDate(endDate.getDate() + duration);
    }

    // Update user subscription
    await user.updateSubscription('plan3', `GIFTED-${Date.now()}`);
    user.subscription.endDate = endDate;
    user.subscription.status = 'active';
    await user.save();

    // Find or create subscription record
    let subscription = await Subscription.findOne({
      userId: user._id,
      plan: 'plan3',
      status: 'active'
    }).sort({ createdAt: -1 });

    if (subscription) {
      subscription.endDate = endDate;
      subscription.status = 'active';
      await subscription.save();
    } else {
      subscription = new Subscription({
        userId: user._id,
        plan: 'plan3',
        status: 'active',
        startDate: startDate,
        endDate: endDate,
        amount: 0, // Gifted
        currency: 'XLM',
        paymentTxHash: `GIFTED-${Date.now()}`,
        autoRenew: false
      });
      await subscription.save();
    }

    // Send email notification
    const emailResult = await emailService.sendPremiumGiftNotification(
      normalizedEmail,
      duration,
      false, // isNewUser
      endDate
    );

    if (!emailResult.success) {
      console.error(`[PremiumGifts] Failed to send email to ${normalizedEmail}:`, emailResult.error);
    }

    return res.json({
      success: true,
      message: `Premium subscription gifted to ${normalizedEmail}`,
      user: {
        email: user.email,
        subscription: {
          plan: user.subscription.plan,
          status: user.subscription.status,
          startDate: user.subscription.startDate,
          endDate: user.subscription.endDate
        }
      },
      isNewUser: false,
      emailSent: emailResult.success,
      emailError: emailResult.error || null
    });
  } catch (error) {
    console.error('Gift premium error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to gift premium subscription',
      message: error.message
    });
  }
});

/**
 * POST /api/premium-gifts/gift-bulk
 * Gift premium to multiple users
 */
router.post('/gift-bulk', authenticate, async (req, res) => {
  try {
    const { emails, durationDays = 30 } = req.body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array of email addresses is required'
      });
    }

    if (emails.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 emails per request'
      });
    }

    const duration = parseInt(durationDays, 10) || 30;
    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const email of emails) {
      if (!email || !email.includes('@')) {
        results.failed.push({
          email,
          error: 'Invalid email address'
        });
        continue;
      }

      const normalizedEmail = email.toLowerCase().trim();

      try {
        // Find or create user
        let user = await User.findOne({ email: normalizedEmail });

        if (!user) {
          // Create new user
          user = new User({
            email: normalizedEmail,
            authMethod: 'gmail',
            subscription: {
              plan: 'plan3',
              status: 'active',
              startDate: new Date(),
            },
            usage: {
              deployments: {
                count: 0,
                limit: -1,
                lastResetDate: new Date()
              },
              functionTests: {
                count: 0,
                limit: -1,
                lastResetDate: new Date()
              }
            }
          });

          const endDate = new Date();
          endDate.setDate(endDate.getDate() + duration);
          user.subscription.endDate = endDate;
          await user.save();

          // Create subscription record
          const subscription = new Subscription({
            userId: user._id,
            plan: 'plan3',
            status: 'active',
            startDate: new Date(),
            endDate: endDate,
            amount: 0,
            currency: 'XLM',
            paymentTxHash: `GIFTED-${Date.now()}`,
            autoRenew: false
          });
          await subscription.save();

          // Send email notification
          const emailResult = await emailService.sendPremiumGiftNotification(
            normalizedEmail,
            duration,
            true, // isNewUser
            endDate
          );

          if (!emailResult.success) {
            console.error(`[PremiumGifts] Failed to send email to ${normalizedEmail}:`, emailResult.error);
          }

          results.success.push({
            email: normalizedEmail,
            isNewUser: true,
            emailSent: emailResult.success
          });
        } else {
          // Update existing user
          let endDate = new Date();

          if (user.subscription.plan === 'plan3' && user.subscription.status === 'active') {
            const currentEndDate = user.subscription.endDate ? new Date(user.subscription.endDate) : new Date();
            if (currentEndDate > new Date()) {
              endDate = new Date(currentEndDate);
              endDate.setDate(endDate.getDate() + duration);
            } else {
              endDate.setDate(endDate.getDate() + duration);
            }
          } else {
            endDate.setDate(endDate.getDate() + duration);
          }

          await user.updateSubscription('plan3', `GIFTED-${Date.now()}`);
          user.subscription.endDate = endDate;
          user.subscription.status = 'active';
          await user.save();

          // Update subscription record
          let subscription = await Subscription.findOne({
            userId: user._id,
            plan: 'plan3',
            status: 'active'
          }).sort({ createdAt: -1 });

          if (subscription) {
            subscription.endDate = endDate;
            subscription.status = 'active';
            await subscription.save();
          } else {
            subscription = new Subscription({
              userId: user._id,
              plan: 'plan3',
              status: 'active',
              startDate: new Date(),
              endDate: endDate,
              amount: 0,
              currency: 'XLM',
              paymentTxHash: `GIFTED-${Date.now()}`,
              autoRenew: false
            });
            await subscription.save();
          }

          // Send email notification
          const emailResult = await emailService.sendPremiumGiftNotification(
            normalizedEmail,
            duration,
            false, // isNewUser
            endDate
          );

          if (!emailResult.success) {
            console.error(`[PremiumGifts] Failed to send email to ${normalizedEmail}:`, emailResult.error);
          }

          results.success.push({
            email: normalizedEmail,
            isNewUser: false,
            emailSent: emailResult.success
          });
        }
      } catch (error) {
        results.failed.push({
          email: normalizedEmail,
          error: error.message
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    res.json({
      success: true,
      message: `Processed ${emails.length} emails`,
      results: {
        success: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      details: {
        success: results.success,
        failed: results.failed,
        skipped: results.skipped
      }
    });
  } catch (error) {
    console.error('Bulk gift premium error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to gift premium subscriptions',
      message: error.message
    });
  }
});

/**
 * GET /api/premium-gifts/list
 * Get list of all premium gifts (users with plan3)
 */
router.get('/list', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const skip = parseInt(req.query.skip) || 0;

    const users = await User.find({
      'subscription.plan': 'plan3'
    })
      .sort({ 'subscription.startDate': -1 })
      .limit(limit)
      .skip(skip)
      .select('email subscription.name subscription.picture subscription.startDate subscription.endDate subscription.status createdAt');

    const total = await User.countDocuments({
      'subscription.plan': 'plan3'
    });

    res.json({
      success: true,
      users: users.map(user => ({
        email: user.email,
        name: user.name,
        picture: user.picture,
        subscription: {
          plan: user.subscription.plan,
          status: user.subscription.status,
          startDate: user.subscription.startDate,
          endDate: user.subscription.endDate
        },
        createdAt: user.createdAt
      })),
      total,
      limit,
      skip
    });
  } catch (error) {
    console.error('List premium gifts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list premium gifts',
      message: error.message
    });
  }
});

module.exports = router;
