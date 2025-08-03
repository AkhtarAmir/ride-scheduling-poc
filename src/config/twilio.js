const twilio = require('twilio');

// Mock mode for development (change to false for production)
const MOCK_TWILIO = false;


// Twilio configuration
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Validate WhatsApp configuration
function validateWhatsAppConfig() {
  const issues = [];
  
  if (!process.env.TWILIO_ACCOUNT_SID) {
    issues.push('TWILIO_ACCOUNT_SID is not set');
  }
  
  if (!process.env.TWILIO_AUTH_TOKEN) {
    issues.push('TWILIO_AUTH_TOKEN is not set');
  }
  
  if (!process.env.TWILIO_PHONE_NUMBER) {
    issues.push('TWILIO_PHONE_NUMBER is not set');
  } else {
    // Check if it looks like a valid phone number (should NOT include whatsapp: prefix)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    const cleanNumber = process.env.TWILIO_PHONE_NUMBER.replace('whatsapp:', '');
    
    if (!phoneRegex.test(cleanNumber)) {
      issues.push('TWILIO_PHONE_NUMBER should be in international format (e.g., +1234567890) without whatsapp: prefix');
    }
    
    // If it has whatsapp: prefix, warn but don't fail
    if (process.env.TWILIO_PHONE_NUMBER.includes('whatsapp:')) {
      console.warn('⚠️  TWILIO_PHONE_NUMBER should not include "whatsapp:" prefix. Using clean number.');
    }
  }
  
  if (issues.length > 0) {
    console.warn('⚠️  WhatsApp Configuration Issues:');
    issues.forEach(issue => console.warn(`   - ${issue}`));
    console.warn('   Using mock mode for WhatsApp messages');
    return false;
  }
  
  return true;
}

// Check configuration on startup
const isWhatsAppConfigured = validateWhatsAppConfig();

module.exports = {
  twilioClient,
  MOCK_TWILIO,
  isWhatsAppConfigured
}; 