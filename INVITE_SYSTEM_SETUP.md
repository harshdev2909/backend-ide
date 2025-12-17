# Invite System Setup Guide

## Email Configuration

### Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account → Security
   - Under "2-Step Verification", click "App passwords"
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Update `.env` file**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM=your-email@gmail.com
SMTP_FROM_NAME=WebSoroban IDE
FRONTEND_URL=https://websoroban.in
```

### Other Email Providers

**Outlook/Hotmail:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

**Mailgun:**
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
```

## Installation

```bash
npm install
```

## Usage

### 1. Generate 50 Invite Codes

```bash
npm run generate-invites
```

This creates 50 invite codes in the database (not sent yet).

### 2. Send Invite to Single Email (Admin Dashboard)

```javascript
POST /api/invites/send
Body: {
  "email": "user@example.com"
}
```

This will:
- Create invite code if doesn't exist
- Mark as sent
- Send email with invite code

### 3. Send Invites to Multiple Emails

```javascript
POST /api/invites/send-bulk
Body: {
  "emails": [
    "user1@example.com",
    "user2@example.com",
    "user3@example.com"
  ]
}
```

### 4. Check Invite Status (User)

```javascript
POST /api/invites/check
Body: {
  "email": "user@example.com"
}
```

Response:
- `hasInvite: false` → Show waitlist message
- `hasInvite: true` → Show invite code modal

### 5. Validate Invite Code (User)

```javascript
POST /api/invites/validate
Body: {
  "email": "user@example.com",
  "inviteCode": "INV-XXXX-XXXX-XXXX"
}
```

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/invites/send` | Send invite to single email | Admin |
| POST | `/api/invites/send-bulk` | Send invites to multiple emails | Admin |
| POST | `/api/invites/check` | Check if user has invite | Public |
| POST | `/api/invites/validate` | Validate and use invite code | Public |
| GET | `/api/invites` | List all invites (with filters) | Admin |
| POST | `/api/invites/generate-bulk` | Generate bulk invite codes | Admin |

## Email Template

The email includes:
- Professional HTML template
- Invite code prominently displayed
- Instructions on how to use
- Link to frontend application

## Testing Email

To test email without sending:

1. Set up email credentials in `.env`
2. Use a test email service like [Mailtrap](https://mailtrap.io) for development
3. Or use Gmail with app password

## Troubleshooting

**Email not sending:**
- Check SMTP credentials in `.env`
- Verify app password (for Gmail)
- Check firewall/network restrictions
- Review server logs for SMTP errors

**Invite code not working:**
- Ensure code matches exactly (case-insensitive)
- Check if invite is already used
- Verify email matches the one invite was sent to

