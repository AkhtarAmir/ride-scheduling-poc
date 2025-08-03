const { updateConversationStep } = require('./conversationCore');

// Command patterns
const RESTART_COMMANDS = ['restart', 'start over', 'new ride', 'new', 'ride'];
const AI_ENABLE_COMMANDS = ['enable ai', 'ai on', 'smart mode'];
const AI_DISABLE_COMMANDS = ['disable ai', 'ai off', 'step mode', 'traditional'];
const HELP_COMMANDS = ['help', '?'];

async function handleCommands(conversation, message) {
  const cleanMessage = message.toLowerCase().trim();
  
  // Handle restart command
  if (RESTART_COMMANDS.includes(cleanMessage)) {
    return await handleRestartCommand(conversation);
  }
  
  // Handle AI mode commands
  if (AI_ENABLE_COMMANDS.includes(cleanMessage)) {
    return await handleAIEnableCommand(conversation);
  }
  
  if (AI_DISABLE_COMMANDS.includes(cleanMessage)) {
    return await handleAIDisableCommand(conversation);
  }
  
  // Handle help command
  if (HELP_COMMANDS.includes(cleanMessage)) {
    return await handleHelpCommand(conversation);
  }
  
  return null; // No command matched
}

async function handleRestartCommand(conversation) {
  conversation.step = 'waiting_for_from';
  conversation.rideData = {};
  conversation.aiEnabled = false;
  conversation.conversationHistory = [];
  await conversation.save();
  
  const response = "🚗 *New Ride Booking Started*\n\nWhere would you like to be picked up from?\n\nPlease provide a pickup location (e.g., 'Home', 'Airport', '123 Main St')";
  await conversation.addMessage('assistant', response);
  return response;
}

async function handleAIEnableCommand(conversation) {
  await conversation.enableAI();
  const response = "🤖 *AI Mode Enabled!*\n\nI'm now using intelligent conversation management. I can understand context better and provide more natural responses.\n\nYou can type 'disable ai' to return to step-by-step mode.";
  await conversation.addMessage('assistant', response);
  return response;
}

async function handleAIDisableCommand(conversation) {
  await conversation.disableAI();
  const response = "📋 *Step Mode Enabled!*\n\nI'm now using the traditional step-by-step booking process.\n\nType 'enable ai' to switch back to intelligent mode.";
  await conversation.addMessage('assistant', response);
  return response;
}

async function handleHelpCommand(conversation) {
  const response = `*Available Commands:*
• restart - Start a new ride booking
• ride - Start a new ride booking
• help - Show this help message
• status - Check your current booking status
• enable ai - Switch to intelligent AI mode
• disable ai - Switch to step-by-step mode

*Current Step:* ${conversation.step.replace(/_/g, ' ').toUpperCase()}`;
  await conversation.addMessage('assistant', response);
  return response;
}

module.exports = {
  handleCommands,
  RESTART_COMMANDS,
  AI_ENABLE_COMMANDS,
  AI_DISABLE_COMMANDS,
  HELP_COMMANDS
}; 