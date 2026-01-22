/* 
 * INVITE SYSTEM - COMMENTED OUT
 * This entire invite system has been replaced with premium gifting functionality.
 * The new system allows gifting premium subscriptions directly to users via email.
 * See /api/premium-gifts routes for the new implementation.
 */

/*
const express = require('express');
const router = express.Router();
const Invite = require('../models/Invite');
const crypto = require('crypto');
const emailService = require('../services/emailService');

// Generate invite code format: INV-XXXX-XXXX-XXXX
function generateInviteCode() {
  const segments = [];
  for (let i = 0; i < 3; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `INV-${segments.join('-')}`;
}

// POST /api/invites/send
// Admin endpoint: Send invite code to an email
router.post('/send', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if invite already exists for this email
    let invite = await Invite.findOne({ email: normalizedEmail });

    if (invite) {
      // If already sent, resend the email
      if (invite.sent) {
        // Resend email with existing code
        const emailResult = await emailService.sendInviteCode(normalizedEmail, invite.inviteCode);
        
        if (!emailResult.success) {
          console.error(`[Invites] Failed to resend email to ${normalizedEmail}:`, emailResult.error);
        }
        
        return res.json({
          success: true,
          message: 'Invite code resent successfully',
          emailSent: emailResult.success,
          emailError: emailResult.error || null,
          invite: {
            email: invite.email,
            inviteCode: invite.inviteCode,
            sentAt: invite.sentAt,
            used: invite.used
          }
        });
      }
      
      // If exists but not sent, mark as sent and send email
      await invite.markAsSent();
      
      // Send email with invite code
      const emailResult = await emailService.sendInviteCode(normalizedEmail, invite.inviteCode);
      
      return res.json({
        success: true,
        message: 'Invite code sent successfully',
        emailSent: emailResult.success,
        emailError: emailResult.error,
        invite: {
          email: invite.email,
          inviteCode: invite.inviteCode,
          sentAt: invite.sentAt
        }
      });
    }

    // Create new invite
    invite = new Invite({
      email: normalizedEmail,
      inviteCode: generateInviteCode(),
      sent: true,
      sentAt: new Date()
    });

    await invite.save();

    // Send email with invite code
    const emailResult = await emailService.sendInviteCode(normalizedEmail, invite.inviteCode);

    res.json({
      success: true,
      message: 'Invite code sent successfully',
      emailSent: emailResult.success,
      emailError: emailResult.error,
      invite: {
        email: invite.email,
        inviteCode: invite.inviteCode,
        sentAt: invite.sentAt
      }
    });
  } catch (error) {
    console.error('Send invite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send invite',
      message: error.message
    });
  }
});

// POST /api/invites/check
// User endpoint: Check if invite exists for email (waitlist-first approach)
router.post('/check', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let invite = await Invite.findOne({ email: normalizedEmail });

    // If email doesn't exist in DB, create it and add to waitlist
    if (!invite) {
      invite = new Invite({
        email: normalizedEmail,
        inviteCode: generateInviteCode(),
        sent: false,
        sentAt: null
      });
      await invite.save();
      
      return res.json({
        success: true,
        hasInvite: false,
        isWaitlist: true,
        isNew: true,
        message: 'You have been added to the waitlist. An invite code will be sent to your email soon.'
      });
    }

    // Email exists - check if invite has been sent
    if (!invite.sent) {
      return res.json({
        success: true,
        hasInvite: false,
        isWaitlist: true,
        isNew: false,
        message: 'You are already on the waitlist. An invite code will be sent to your email soon.'
      });
    }

    // Invite has been sent - always allow code input
    return res.json({
      success: true,
      hasInvite: true,
      isWaitlist: false,
      used: invite.used || false,
      message: invite.used 
        ? 'Please enter your invite code to verify access.'
        : 'Invite code has been sent to your email. Please enter it below.'
    });
  } catch (error) {
    console.error('Check invite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check invite status',
      message: error.message
    });
  }
});

// POST /api/invites/validate
// User endpoint: Validate and use invite code
router.post('/validate', async (req, res) => {
  try {
    const { email, inviteCode } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address is required'
      });
    }

    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        error: 'Invite code is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = inviteCode.trim().toUpperCase();

    // First check if invite exists for this email
    const emailInvite = await Invite.findOne({ email: normalizedEmail });

    if (!emailInvite || !emailInvite.sent) {
      return res.status(404).json({
        success: false,
        error: 'waitlist',
        message: 'You are on the waitlist. An invite code will be sent to your email soon.'
      });
    }

    const storedCodeNormalized = (emailInvite.inviteCode || '').toUpperCase().trim().replace(/\s+/g, '');
    const providedCodeNormalized = normalizedCode.replace(/\s+/g, '');

    // Validate the code matches
    if (storedCodeNormalized !== providedCodeNormalized) {
      return res.status(400).json({
        success: false,
        error: 'Invalid invite code. Please check and try again.'
      });
    }

    // Mark as used only if not already used
    if (!emailInvite.used) {
      await emailInvite.markAsUsed(normalizedEmail);
    }

    res.json({
      success: true,
      message: 'Invite code validated successfully',
      invite: {
        email: emailInvite.email,
        inviteCode: emailInvite.inviteCode,
        used: emailInvite.used,
        usedAt: emailInvite.usedAt
      }
    });
  } catch (error) {
    console.error('Validate invite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate invite code',
      message: error.message
    });
  }
});

// GET /api/invites
// Admin endpoint: List all invites with filters
router.get('/', async (req, res) => {
  try {
    const { email, sent, used, limit = 100, skip = 0 } = req.query;
    
    const query = {};
    if (email) query.email = email.toLowerCase().trim();
    if (sent !== undefined) query.sent = sent === 'true';
    if (used !== undefined) query.used = used === 'true';

    const invites = await Invite.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip(parseInt(skip, 10));

    const total = await Invite.countDocuments(query);

    res.json({
      success: true,
      invites: invites.map(invite => ({
        _id: invite._id,
        email: invite.email,
        inviteCode: invite.inviteCode,
        sent: invite.sent,
        sentAt: invite.sentAt,
        used: invite.used,
        usedAt: invite.usedAt,
        usedBy: invite.usedBy,
        createdAt: invite.createdAt,
        updatedAt: invite.updatedAt
      })),
      total,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10)
    });
  } catch (error) {
    console.error('List invites error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invites',
      message: error.message
    });
  }
});

// POST /api/invites/send-bulk
// Admin endpoint: Send invite codes to multiple emails
router.post('/send-bulk', async (req, res) => {
  try {
    const { emails } = req.body;
    
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
        let invite = await Invite.findOne({ email: normalizedEmail });

        if (invite && invite.sent && invite.used) {
          results.skipped.push({
            email: normalizedEmail,
            reason: 'Already used'
          });
          continue;
        }

        if (!invite) {
          invite = new Invite({
            email: normalizedEmail,
            inviteCode: generateInviteCode(),
            sent: true,
            sentAt: new Date()
          });
          await invite.save();
        } else if (!invite.sent) {
          await invite.markAsSent();
        }

        const emailResult = await emailService.sendInviteCode(normalizedEmail, invite.inviteCode);

        if (emailResult.success) {
          results.success.push({
            email: normalizedEmail,
            inviteCode: invite.inviteCode
          });
        } else {
          results.failed.push({
            email: normalizedEmail,
            error: emailResult.error || 'Failed to send email'
          });
        }
      } catch (error) {
        results.failed.push({
          email: normalizedEmail,
          error: error.message
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));
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
    console.error('Send bulk invites error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send bulk invites',
      message: error.message
    });
  }
});

// POST /api/invites/generate-bulk
// Admin endpoint: Generate multiple invite codes
router.post('/generate-bulk', async (req, res) => {
  try {
    const { count = 50, emails } = req.body;
    
    const inviteCount = parseInt(count, 10);
    if (inviteCount < 1 || inviteCount > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Count must be between 1 and 1000'
      });
    }

    const invites = [];
    const emailList = emails && Array.isArray(emails) ? emails : [];

    for (let i = 0; i < inviteCount; i++) {
      const email = emailList[i] || `invite-${Date.now()}-${i}@placeholder.com`;
      const normalizedEmail = email.toLowerCase().trim();

      let invite = await Invite.findOne({ email: normalizedEmail });
      
      if (!invite) {
        invite = new Invite({
          email: normalizedEmail,
          inviteCode: generateInviteCode(),
          sent: false
        });
        await invite.save();
      }

      invites.push({
        email: invite.email,
        inviteCode: invite.inviteCode,
        sent: invite.sent,
        used: invite.used
      });
    }

    res.json({
      success: true,
      message: `Generated ${invites.length} invite codes`,
      invites,
      total: invites.length
    });
  } catch (error) {
    console.error('Generate bulk invites error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate invites',
      message: error.message
    });
  }
});

module.exports = router;
*/

// Export empty router since invite system is disabled
const express = require('express');
const router = express.Router();

// All invite routes are disabled - use /api/premium-gifts instead
router.use((req, res) => {
  res.status(410).json({
    success: false,
    error: 'Invite system has been disabled. Please use the premium gifting system at /api/premium-gifts instead.'
  });
});

module.exports = router;
