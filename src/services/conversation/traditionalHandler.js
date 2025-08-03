const { parseTimeInput } = require('../../utils/timeUtils');
const { calculateDistance } = require('../mapsService');
const { updateConversationStep } = require('./conversationCore');
const { bookRide, bookWithAlternativeDriver, bookWithAlternativeTime } = require('./bookingHandler');
const { 
  formatPickupLocationPrompt,
  formatDestinationPrompt,
  formatTimePrompt,
  formatDriverPrompt,
  formatTimeError,
  formatInvalidLocationError,
  formatInvalidPhoneError,
  formatInvalidTimeError,
  formatCompletedMessage,
  formatGenericError
} = require('./responseFormatter');

// Define invalid inputs that should be rejected as locations
const INVALID_INPUTS = ['ride', 'book', 'booking', 'start', 'begin', 'new', 'work', 'home', 'office', 'airport', 'mall', 'restaurant', 'hotel', 'hospital', 'station', 'stop', 'place', 'location', 'address', 'building', 'center', 'park', 'shop', 'store', 'market', 'plaza'];

async function processTraditionalMessage(conversation, message) {
  try {
    const cleanMessage = message.toLowerCase().trim();
    
    // Handle commands first (before step processing)
    if (isRestartCommand(cleanMessage)) {
      await updateConversationStep(conversation.phone, 'waiting_for_from', {});
      const response = formatPickupLocationPrompt();
      await conversation.addMessage('assistant', response);
      return response;
    }
    
    // Handle help commands
    if (isHelpCommand(cleanMessage)) {
      const response = getHelpMessage(conversation.step);
      await conversation.addMessage('assistant', response);
      return response;
    }
    
    let response;
    
    switch (conversation.step) {
      case 'waiting_for_from':
        response = await handleWaitingForFrom(conversation, message, cleanMessage);
        break;
        
      case 'waiting_for_to':
        response = await handleWaitingForTo(conversation, message, cleanMessage);
        break;
        
      case 'waiting_for_time':
        response = await handleWaitingForTime(conversation, message);
        break;
        
      case 'waiting_for_driver':
        response = await handleWaitingForDriver(conversation, message);
        break;
        
      case 'waiting_for_alternative_driver':
        response = await handleWaitingForAlternativeDriver(conversation, message);
        break;
        
      case 'waiting_for_alternative_time':
        response = await handleWaitingForAlternativeTime(conversation, message);
        break;
        
      case 'completed':
        response = formatCompletedMessage();
        break;
        
      default:
        await updateConversationStep(conversation.phone, 'waiting_for_from', {});
        response = formatPickupLocationPrompt();
    }
    
    await conversation.addMessage('assistant', response);
    return response;
    
  } catch (error) {
    console.error('Error processing traditional message:', error);
    const response = formatGenericError();
    await conversation.addMessage('assistant', response);
    return response;
  }
}

function isRestartCommand(message) {
  return ['restart', 'start over', 'new ride', 'ride'].includes(message);
}

function isHelpCommand(message) {
  return ['help', '?'].includes(message);
}

function getHelpMessage(currentStep) {
  return `*Available Commands:*
• restart - Start a new ride booking
• ride - Start a new ride booking
• help - Show this help message
• status - Check your current booking status
• enable ai - Switch to intelligent AI mode
• disable ai - Switch to step-by-step mode

*Current Step:* ${currentStep.replace(/_/g, ' ').toUpperCase()}`;
}

async function handleWaitingForFrom(conversation, message, cleanMessage) {
  // Better validation for pickup location
  if (cleanMessage.length < 3) {
    return "Please provide a pickup location (e.g., 'Home', 'Airport', '123 Main St')";
  }
  
  // Check for common invalid inputs
  if (INVALID_INPUTS.includes(cleanMessage)) {
    return formatInvalidLocationError('pickup');
  }
  
  await updateConversationStep(conversation.phone, 'waiting_for_to', { from: message });
  return formatDestinationPrompt(message);
}

async function handleWaitingForTo(conversation, message, cleanMessage) {
  if (cleanMessage.length < 3) {
    return "Please provide a destination (e.g., 'Work', 'Mall', '456 Oak Ave')";
  }
  
  // Check for common invalid inputs
  if (INVALID_INPUTS.includes(cleanMessage)) {
    return formatInvalidLocationError('destination');
  }
  
  await updateConversationStep(conversation.phone, 'waiting_for_time', { 
    from: conversation.rideData.from,
    to: message 
  });
  return formatTimePrompt(conversation.rideData.from, message);
}

async function handleWaitingForTime(conversation, message) {
  try {
    const parsedTime = parseTimeInput(message);
    // Calculate duration automatically
    const { duration } = await calculateDistance(conversation.rideData.from, conversation.rideData.to);
    await updateConversationStep(conversation.phone, 'waiting_for_driver', {
      from: conversation.rideData.from,
      to: conversation.rideData.to,
      time: parsedTime,
      estimatedDuration: duration
    });
    return formatDriverPrompt(conversation.rideData.from, conversation.rideData.to, parsedTime, duration);
  } catch (error) {
    return formatTimeError(error.message, conversation.rideData.from, conversation.rideData.to);
  }
}

async function handleWaitingForDriver(conversation, message) {
  // Validate phone number format
  const phoneMatch = message.match(/^\+?[1-9]\d{1,14}$/);
  if (!phoneMatch) {
    return formatInvalidPhoneError();
  }
  
  const driverPhone = message.startsWith('+') ? message : `+${message}`;
  
  // Update conversation step first
  await updateConversationStep(conversation.phone, 'completed', {
    from: conversation.rideData.from,
    to: conversation.rideData.to,
    time: conversation.rideData.time,
    estimatedDuration: conversation.rideData.estimatedDuration,
    driverPhone: driverPhone
  });
  
  // Now actually book the ride
  try {
    const rideData = {
      driverPhone: driverPhone,
      from: conversation.rideData.from,
      to: conversation.rideData.to,
      time: conversation.rideData.time,
      estimatedDuration: conversation.rideData.estimatedDuration
    };
    
    return await bookRide(conversation, rideData);
  } catch (bookingError) {
    console.error('Ride booking error:', bookingError);
    return formatGenericError();
  }
}

async function handleWaitingForAlternativeDriver(conversation, message) {
  // Handle user's response to driver conflict
  const altPhoneMatch = message.match(/^\+?[1-9]\d{1,14}$/);
  if (!altPhoneMatch) {
    return formatInvalidPhoneError();
  }
  
  const alternativeDriverPhone = message.startsWith('+') ? message : `+${message}`;
  
  // Try booking with the alternative driver
  try {
    return await bookWithAlternativeDriver(conversation, alternativeDriverPhone);
  } catch (bookingError) {
    console.error('Alternative driver booking error:', bookingError);
    return "Sorry, there was an error booking with the alternative driver. Please try again.";
  }
}

async function handleWaitingForAlternativeTime(conversation, message) {
  // Handle user's response to time conflict
  try {
    const parsedTime = parseTimeInput(message);
    
    // Try booking with the alternative time
    return await bookWithAlternativeTime(conversation, parsedTime);
  } catch (timeError) {
    return formatInvalidTimeError();
  }
}

module.exports = {
  processTraditionalMessage
}; 