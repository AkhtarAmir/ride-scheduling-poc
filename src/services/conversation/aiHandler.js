const vectorDBService = require('../vectorDBService');
const { calculateDistance } = require('../mapsService');
const { bookRide } = require('./bookingHandler');
const { updateConversationStep } = require('./conversationCore');
const { formatBookingError } = require('./responseFormatter');

async function processAIMessage(conversation, message) {
  try {
    const history = conversation.getRecentHistory(20); // Increased from 10 to 20 for full context
    const extractedData = await vectorDBService.extractBookingData(conversation.phone, history);
    const hasCompleteData = extractedData.from && extractedData.to && extractedData.dateTime;
    const justProvidedDriver = message.match(/^\+?[0-9]{10,15}$/);
    
    console.log(`🤖 AI Handler: Processing message "${message}" for ${conversation.phone}`);
    console.log(`🤖 AI Handler: Conversation history length: ${history.length}`);
    console.log(`🤖 AI Handler: Extracted data:`, extractedData);
    console.log(`🤖 AI Handler: hasCompleteData: ${extractedData.dateTime}, justProvidedDriver: ${justProvidedDriver}`);
    
    if (hasCompleteData && justProvidedDriver) {
      console.log(`🤖 AI Handler: User provided driver phone number`);
      const result = await handleDriverPhoneProvided(conversation, extractedData, message);
      
      // Check if the booking was already handled
      if (result === "__MESSAGE_ALREADY_HANDLED__") {
        console.log(`🤖 AI Handler: Driver phone booking already handled by ride service, not sending additional response`);
        return null; // Don't send any additional message
      }
      
      return result;
    }
    
    const isConfirmingBooking = detectBookingConfirmation(message, extractedData);
    
    console.log(`🤖 AI Handler: User is confirming driver? ${isConfirmingBooking}`);
    
    if (extractedData.from && extractedData.to && extractedData.dateTime && extractedData.driverPhone && isConfirmingBooking) {
      console.log(`🤖 AI Handler: All booking conditions met, proceeding with booking`);
      const result = await handleBookingConfirmation(conversation, extractedData);
      
      // Check if the booking was already handled
      if (result === "__MESSAGE_ALREADY_HANDLED__") {
        console.log(`🤖 AI Handler: Booking confirmation already handled by ride service, not sending additional response`);
        return null; // Don't send any additional message
      }
      
      return result;
    }
    
    console.log(`🤖 AI Handler: Calling generateIntelligentResponse`);
    
    // Generate intelligent response using vector database - PASS EXTRACTED DATA TO AVOID DUPLICATE CALLS
    const aiResponse = await vectorDBService.generateIntelligentResponse(
      conversation.phone,
      message,
      history,
      extractedData // Pass the already extracted data to avoid duplicate AI calls
    );
    
    // Check if message was already handled by another service
    if (aiResponse === "__MESSAGE_ALREADY_HANDLED__") {
      console.log(`🤖 AI Handler: Message already handled by ride service, not sending additional response`);
      // Still add to conversation history for context, but don't send to user
      await conversation.addMessage('assistant', '[System: Conflict message sent by ride service]', { source: 'system' });
      return null; // Don't send any additional message
    }
    
    console.log(`🤖 AI Handler: Got AI response: ${aiResponse.substring(0, 100)}...`);
    
    await conversation.addMessage('assistant', aiResponse, { source: 'ai' });
    return aiResponse;
    
  } catch (error) {
    console.error('Error processing AI message:', error);
    // Fallback to traditional processing if AI fails
    const traditionalHandler = require('./traditionalHandler');
    return await traditionalHandler.processTraditionalMessage(conversation, message);
  }
}

function detectBookingConfirmation(message, extractedData) {
  const cleanMessage = message.toLowerCase().trim();
  
  // **SIMPLIFIED: Only trust the AI's extraction and response type analysis**
  const isBookingConfirmed = extractedData.bookingStatus === 'confirmed';
  const isConfirmationType = extractedData.responseType === 'confirmation';
  const hasExtractedDriver = extractedData.driverPhone !== null;
  
  console.log(`🤖 Simplified Confirmation Detection:`, {
    message: cleanMessage,
    isBookingConfirmed,
    isConfirmationType,
    hasExtractedDriver,
    responseType: extractedData.responseType,
    finalDecision: isBookingConfirmed || (isConfirmationType && hasExtractedDriver)
  });
  
  return isBookingConfirmed || (isConfirmationType && hasExtractedDriver);
}

async function handleDriverPhoneProvided(conversation, extractedData, message) {
  try {
    console.log(`🤖 AI Handler: Processing driver phone: ${message}`);
    
    const moment = require('moment');
    const parsedTime = moment(extractedData.dateTime, [
      'DD MMMM YYYY [at] h:mm A',
      'MMMM DD, YYYY [at] h:mm A',
      'YYYY-MM-DD HH:mm'
    ]).format('YYYY-MM-DD HH:mm');
    
    const { duration } = await calculateDistance(extractedData.from, extractedData.to);
    
    // Add + prefix if not present
    const driverPhone = message.startsWith('+') ? message : `+${message}`;
    
    const rideData = {
      driverPhone: driverPhone,
      from: extractedData.from,
      to: extractedData.to,
      time: parsedTime,
      estimatedDuration: duration || 60
    };
    
    console.log(`🤖 AI Handler: Booking ride with data:`, rideData);
    
    const result = await bookRide(conversation, rideData);
    
    // Check if the ride service already handled the message
    if (result === "__MESSAGE_ALREADY_HANDLED__") {
      console.log(`📢 AI Handler: Ride service already sent message, not sending duplicate`);
      return "__MESSAGE_ALREADY_HANDLED__";
    }
    
    return result;
    
  } catch (bookingError) {
    console.error('AI mode ride booking error:', bookingError);
    const errorMessage = formatBookingError();
    await conversation.addMessage('assistant', errorMessage, { source: 'system' });
    return errorMessage;
  }
}

async function handleBookingConfirmation(conversation, extractedData) {
  try {
    console.log(`🤖 AI Handler: Processing booking confirmation`);
    console.log(`🤖 AI Handler: Extracted data for booking:`, extractedData);
    
    const moment = require('moment');
    const parsedTime = moment(extractedData.dateTime, [
      'DD MMMM YYYY [at] h:mm A',
      'MMMM DD, YYYY [at] h:mm A',
      'YYYY-MM-DD HH:mm'
    ]).format('YYYY-MM-DD HH:mm');
    
    const { duration } = await calculateDistance(extractedData.from, extractedData.to);
    
    // Add + prefix if not present in driver phone
    let driverPhone = extractedData.driverPhone;
    if (driverPhone && !driverPhone.startsWith('+')) {
      driverPhone = `+${driverPhone}`;
    }
    
    const rideData = {
      driverPhone: driverPhone,
      from: extractedData.from,
      to: extractedData.to,
      time: parsedTime,
      estimatedDuration: duration || 60
    };
    
    console.log(`🤖 AI Handler: Booking confirmed ride with data:`, rideData);
    
    const result = await bookRide(conversation, rideData);
    
    // Check if the ride service already handled the message
    if (result === "__MESSAGE_ALREADY_HANDLED__") {
      console.log(`📢 AI Handler: Ride service already sent message, not sending duplicate`);
      return "__MESSAGE_ALREADY_HANDLED__";
    }
    
    return result;
    
  } catch (bookingError) {
    console.error('AI mode ride booking error:', bookingError);
    const errorMessage = formatBookingError();
    await conversation.addMessage('assistant', errorMessage, { source: 'system' });
    return errorMessage;
  }
}

module.exports = {
  processAIMessage
};