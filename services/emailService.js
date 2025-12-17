require('dotenv').config();
const nodemailer = require('nodemailer');

/**
 * Email service for sending invite codes
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  /**
   * Initialize nodemailer transporter
   */
  initialize() {
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    };

    // Only create transporter if credentials are provided
    if (emailConfig.auth.user && emailConfig.auth.pass) {
      this.transporter = nodemailer.createTransport(emailConfig);
      
      // Verify connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('[EmailService] SMTP connection error:', error);
        } else {
          console.log('[EmailService] SMTP server is ready to send emails');
        }
      });
    } else {
      console.warn('[EmailService] SMTP credentials not configured. Email sending disabled.');
    }
  }

  /**
   * Generate HTML email template for invite code
   */
  generateInviteEmailTemplate(inviteCode, appName = 'WebSoroban IDE') {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Invite Code - ${appName}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to ${appName}!</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      You've been invited to join <strong>${appName}</strong>! We're excited to have you on board.
    </p>
    
    <div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Your Invite Code</p>
      <p style="margin: 0; font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 3px; font-family: 'Courier New', monospace;">${inviteCode}</p>
    </div>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      To get started:
    </p>
    
    <ol style="font-size: 16px; margin-bottom: 30px; padding-left: 20px;">
      <li style="margin-bottom: 10px;">Log in to your account</li>
      <li style="margin-bottom: 10px;">Click on the invite code button</li>
      <li style="margin-bottom: 10px;">Enter the code above when prompted</li>
      <li style="margin-bottom: 10px;">Start building amazing Soroban smart contracts!</li>
    </ol>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="${process.env.FRONTEND_URL || 'https://websoroban.in'}" 
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
        Get Started
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
      If you didn't request this invite, you can safely ignore this email.
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text email template for invite code
   */
  generateInviteEmailText(inviteCode, appName = 'WebSoroban IDE') {
    return `
Welcome to ${appName}!

You've been invited to join ${appName}! We're excited to have you on board.

Your Invite Code: ${inviteCode}

To get started:
1. Log in to your account
2. Click on the invite code button
3. Enter the code above when prompted
4. Start building amazing Soroban smart contracts!

Visit: ${process.env.FRONTEND_URL || 'https://websoroban.in'}

If you didn't request this invite, you can safely ignore this email.

© ${new Date().getFullYear()} ${appName}. All rights reserved.
    `.trim();
  }

  /**
   * Send invite code email
   * @param {string} to - Recipient email address
   * @param {string} inviteCode - Invite code to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendInviteCode(to, inviteCode, options = {}) {

    if (!this.transporter) {
      console.log('[EmailService] Transporter not initialized, attempting to initialize...');
      this.initialize();
      
      // Check again after initialization
      if (!this.transporter) {
        const missingConfig = [];
        if (!process.env.SMTP_USER) missingConfig.push('SMTP_USER');
        if (!process.env.SMTP_PASSWORD) missingConfig.push('SMTP_PASSWORD');
        
        const errorMsg = missingConfig.length > 0
          ? `Email service not configured. Missing: ${missingConfig.join(', ')}`
          : 'Email service not configured. Please check SMTP settings.';
        
        console.warn(`[EmailService] ${errorMsg}`);
        console.warn(`[EmailService] SMTP_USER: ${process.env.SMTP_USER ? 'SET' : 'NOT SET'}`);
        console.warn(`[EmailService] SMTP_PASSWORD: ${process.env.SMTP_PASSWORD ? 'SET' : 'NOT SET'}`);
        return {
          success: false,
          error: errorMsg
        };
      }
    }

    const appName = options.appName || 'WebSoroban IDE';
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || appName;

    if (!fromEmail) {
      const errorMsg = 'SMTP_FROM or SMTP_USER environment variable is required';
      console.error(`[EmailService] ${errorMsg}`);
      return {
        success: false,
        error: errorMsg
      };
    }

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: to,
      subject: options.subject || `Your Invite Code for ${appName}`,
      text: this.generateInviteEmailText(inviteCode, appName),
      html: this.generateInviteEmailTemplate(inviteCode, appName)
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] Invite code email sent to ${to}:`, info.messageId);
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error(`[EmailService] Failed to send email to ${to}:`, error);
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.code === 'EAUTH') {
        errorMessage = 'SMTP authentication failed. Please check your SMTP_USER and SMTP_PASSWORD.';
      } else if (error.code === 'ECONNECTION') {
        errorMessage = `Cannot connect to SMTP server (${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || '587'}). Please check SMTP_HOST and SMTP_PORT.`;
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'SMTP connection timed out. Please check your network connection and SMTP settings.';
      }
      
      return {
        success: false,
        error: errorMessage,
        errorCode: error.code
      };
    }
  }

  /**
   * Send bulk invite codes
   * @param {Array} invites - Array of {email, inviteCode} objects
   * @returns {Promise<Object>} Send results
   */
  async sendBulkInviteCodes(invites) {
    const results = {
      success: [],
      failed: []
    };

    for (const invite of invites) {
      const result = await this.sendInviteCode(invite.email, invite.inviteCode);
      if (result.success) {
        results.success.push(invite.email);
      } else {
        results.failed.push({
          email: invite.email,
          error: result.error
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }
}

module.exports = new EmailService();

