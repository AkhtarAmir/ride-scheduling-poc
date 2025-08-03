const conversationCore = require('./conversationCore');
const commandHandler = require('./commandHandler');
const responseFormatter = require('./responseFormatter');
const bookingHandler = require('./bookingHandler');
const aiHandler = require('./aiHandler');
const traditionalHandler = require('./traditionalHandler');

// Export all the main functions
module.exports = {
  getOrCreateConversation: conversationCore.getOrCreateConversation,
  updateConversationStep: conversationCore.updateConversationStep,
  processConversationMessage: conversationCore.processConversationMessage,
  
  handleCommands: commandHandler.handleCommands,
  
  bookRide: bookingHandler.bookRide,
  bookWithAlternativeDriver: bookingHandler.bookWithAlternativeDriver,
  bookWithAlternativeTime: bookingHandler.bookWithAlternativeTime,
  
  processAIMessage: aiHandler.processAIMessage,
  processTraditionalMessage: traditionalHandler.processTraditionalMessage,
  
  ...responseFormatter
}; 