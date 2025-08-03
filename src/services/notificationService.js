const { twilioClient, MOCK_TWILIO, isWhatsAppConfigured } = require('../config/twilio');
const { calculateDistance } = require('./mapsService');

async function sendNotification(to, message) {
  try {
    // Check if we should use mock mode or if WhatsApp is not properly configured
    if (MOCK_TWILIO || !isWhatsAppConfigured) {
      console.log(`[MOCK] Sending WhatsApp message to ${to}:`);
      console.log(`Message: ${message}`);
      return { success: true, mock: true };
    }

    // For WhatsApp, both 'from' and 'to' need the whatsapp: prefix
    let fromNumber = process.env.TWILIO_PHONE_NUMBER;
    
    // Clean the from number if it has whatsapp: prefix
    if (fromNumber.includes('whatsapp:')) {
      fromNumber = fromNumber.replace('whatsapp:', '');
    }
    
    // Add whatsapp: prefix to from number for WhatsApp
    const whatsappFrom = `whatsapp:${fromNumber}`;
    let normalizedTo = normalizePakistaniNumber(to);

    if (!normalizedTo) {
      console.error(`Invalid phone number format: ${to}`);
      return { success: false, error: 'Invalid phone number format' };
    }
    
    // Add whatsapp prefix
    const whatsappTo = `whatsapp:${normalizedTo}`;
    
    console.log(`Attempting to send WhatsApp message from ${whatsappFrom} to ${to}`);
    
    const response = await twilioClient.messages.create({
      body: message,
      from: whatsappFrom,
      to: whatsappTo
    });
    

    console.log(`WhatsApp message sent successfully to ${to}:`, response.sid);
    return { success: true, sid: response.sid };
  } catch (error) {
    console.error(`Failed to send WhatsApp message to ${to}:`, error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      moreInfo: error.moreInfo
    });
    
    // If it's a WhatsApp configuration error, fall back to mock mode
    if (error.code === 21212 || error.code === 21910) {
      console.log('Falling back to mock mode due to WhatsApp configuration error');
      console.log(`[MOCK] Sending WhatsApp message to ${to}:`);
      console.log(`Message: ${message}`);
      return { success: true, mock: true, fallback: true };
    }
    
    return { success: false, error: error.message };
  }
}
function normalizePakistaniNumber(number) {
  // Remove non-digit characters
  number = number.replace(/\D/g, '');

  // If it starts with '03', it's a local number — convert to international
  if (/^03\d{9}$/.test(number)) {
    return `+92${number.slice(1)}`;
  }

  // If it starts with '92', prepend '+'
  if (/^92\d{10}$/.test(number)) {
    return `+${number}`;
  }

  // If already starts with +92 and is valid
  if (/^\+92\d{10}$/.test(`+${number}`)) {
    return `+${number}`;
  }

  return null; // Invalid
}


module.exports = {
  sendNotification
}; 