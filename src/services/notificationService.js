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
    
    // Clean the 'to' number if it accidentally has whatsapp: prefix
    let cleanToNumber = to;
    if (cleanToNumber.includes('whatsapp:')) {
      cleanToNumber = cleanToNumber.replace('whatsapp:', '');
    }
    
    let normalizedTo = normalizePhoneNumber(cleanToNumber);

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
function normalizePhoneNumber(number) {
  // Remove non-digit characters except '+' at the beginning
  const cleanNumber = number.replace(/[^\d+]/g, '');
  
  // Extract just digits for processing
  const digitsOnly = cleanNumber.replace(/\D/g, '');

  // Handle Pakistani numbers
  // If it starts with '03', it's a local Pakistani number — convert to international
  if (/^03\d{9}$/.test(digitsOnly)) {
    return `+92${digitsOnly.slice(1)}`;
  }

  // If it starts with '92', prepend '+'
  if (/^92\d{10}$/.test(digitsOnly)) {
    return `+${digitsOnly}`;
  }

  // If already starts with +92 and is valid Pakistani number
  if (/^\+92\d{10}$/.test(cleanNumber)) {
    return cleanNumber;
  }

  // Handle American numbers
  // If it's a 10-digit number, assume it's a US local number
  if (/^\d{10}$/.test(digitsOnly)) {
    return `+1${digitsOnly}`;
  }

  // If it starts with '1' and has 11 digits total, it's a US number
  if (/^1\d{10}$/.test(digitsOnly)) {
    return `+${digitsOnly}`;
  }

  // If already starts with +1 and is valid US number
  if (/^\+1\d{10}$/.test(cleanNumber)) {
    return cleanNumber;
  }

  // Handle other international formats that are already properly formatted
  if (/^\+[1-9]\d{1,14}$/.test(cleanNumber)) {
    return cleanNumber;
  }

  return null; // Invalid format
}


module.exports = {
  sendNotification,
  normalizePhoneNumber
}; 