const { twilioClient, MOCK_TWILIO, isWhatsAppConfigured } = require('../../../config/twilio');
const { normalizePakistaniNumber } = require('../utils/phoneUtils');

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
    
    // Clean the 'to' number if it already has whatsapp: prefix
    let cleanTo = to;
    if (to.includes('whatsapp:')) {
      cleanTo = to.replace('whatsapp:', '');
    }
    
    let normalizedTo = normalizePakistaniNumber(cleanTo);

    if (!normalizedTo) {
      console.error(`Invalid phone number format: ${to} (cleaned: ${cleanTo})`);
      return { success: false, error: 'Invalid phone number format' };
    }
    
    // Add whatsapp prefix
    const whatsappTo = `whatsapp:${normalizedTo}`;
    
    console.log(`Attempting to send WhatsApp message from ${whatsappFrom} to ${whatsappTo} (original: ${to})`);
    
    // Check if using sandbox number
    if (fromNumber.includes('14155238886')) {
      console.warn(`⚠️  Using Twilio WhatsApp SANDBOX number. Recipients must opt-in first!`);
      console.warn(`⚠️  Driver must send "join parent-frozen" to +1 415 523 8886 to receive messages`);
    }
    
    try {
      const response = await twilioClient.messages.create({
        body: message,
        from: whatsappFrom,
        to: whatsappTo
      });
      
      console.log(`WhatsApp message sent successfully to ${whatsappTo}:`, response.sid);
      return { success: true, sid: response.sid, method: 'whatsapp' };
      
    } catch (whatsappError) {
      console.error(`❌ WhatsApp message failed:`, whatsappError.message);
      
      // Try SMS as fallback if WhatsApp fails
      console.log(`🔄 Attempting SMS fallback to ${normalizedTo}`);
      
      try {
        const smsResponse = await twilioClient.messages.create({
          body: `[SMS Fallback] ${message}`,
          from: fromNumber,
          to: normalizedTo
        });
        
        console.log(`📱 SMS sent successfully to ${normalizedTo}:`, smsResponse.sid);
        return { success: true, sid: smsResponse.sid, method: 'sms', fallback: true };
        
      } catch (smsError) {
        console.error(`❌ SMS fallback also failed:`, smsError.message);
        throw whatsappError; // Throw original WhatsApp error
      }
    }
    
  } catch (error) {
    console.error(`Failed to send WhatsApp message to ${to}:`, error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      moreInfo: error.moreInfo
    });
    
    // Enhanced error handling for sandbox issues
    if (error.code === 63016) {
      console.error('🚫 WhatsApp Sandbox Error: Recipient has not opted in to receive messages');
      console.error('💡 Solution: Have the driver send "join parent-frozen" to +1 415 523 8886');
    }
    
    // If it's a WhatsApp configuration error, fall back to mock mode
    if (error.code === 21212 || error.code === 21910 || error.code === 63016) {
      console.log('Falling back to mock mode due to WhatsApp configuration error');
      console.log(`[MOCK] Sending WhatsApp message to ${to}:`);
      console.log(`Message: ${message}`);
      return { success: true, mock: true, fallback: true };
    }
    
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendNotification
}; 