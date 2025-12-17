require('dotenv').config();
const mongoose = require('mongoose');
const Invite = require('../models/Invite');
const crypto = require('crypto');

/**
 * Generate invite code format: INV-XXXX-XXXX-XXXX
 */
function generateInviteCode() {
  const segments = [];
  for (let i = 0; i < 3; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `INV-${segments.join('-')}`;
}

/**
 * Generate 50 invite codes
 */
async function generateInvites() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/soroban-ide';
  
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const count = 50;
    const invites = [];
    const errors = [];

    console.log(`Generating ${count} invite codes...`);

    for (let i = 0; i < count; i++) {
      try {
        // Generate placeholder email if not provided
        const email = `invite-${Date.now()}-${i}@placeholder.com`;
        const normalizedEmail = email.toLowerCase().trim();

        // Check if invite already exists
        let invite = await Invite.findOne({ email: normalizedEmail });
        
        if (!invite) {
          invite = new Invite({
            email: normalizedEmail,
            inviteCode: generateInviteCode(),
            sent: false // Not sent yet, admin will send via API
          });
          await invite.save();
        }

        invites.push({
          email: invite.email,
          inviteCode: invite.inviteCode,
          sent: invite.sent,
          used: invite.used
        });

        console.log(`[${i + 1}/${count}] Generated: ${invite.inviteCode} for ${invite.email}`);
      } catch (error) {
        errors.push({ index: i, error: error.message });
        console.error(`Error generating invite ${i + 1}:`, error.message);
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total generated: ${invites.length}`);
    console.log(`Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(err => console.log(`  - Index ${err.index}: ${err.error}`));
    }

    console.log('\n=== Invite Codes ===');
    invites.forEach((invite, index) => {
      console.log(`${index + 1}. ${invite.inviteCode} - ${invite.email} (sent: ${invite.sent}, used: ${invite.used})`);
    });

    // Save to file
    const fs = require('fs');
    const outputFile = 'invites-generated.json';
    fs.writeFileSync(outputFile, JSON.stringify(invites, null, 2));
    console.log(`\nInvites saved to ${outputFile}`);

    await mongoose.connection.close();
    console.log('\nDone!');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
generateInvites();

