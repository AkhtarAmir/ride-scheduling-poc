const Conversation = require('../../models/Conversation');

async function getOrCreateConversation(phone) {
  try {
    let conversation = await Conversation.findOne({ 
      phone: phone, 
      isActive: true 
    });
    
    if (!conversation) {
      conversation = new Conversation({
        phone: phone,
        step: 'ai_managed',  // **Start in AI mode by default**
        rideData: {},
        isActive: true,
        aiEnabled: true      // **Enable AI by default**
      });
      await conversation.save();
      console.log(`✅ Created new AI-enabled conversation for ${phone}`);
    }
    
    return conversation;
  } catch (error) {
    console.error('Error getting/creating conversation:', error);
    throw error;
  }
}

async function updateConversationStep(phone, step, data = {}) {
  try {
    const updateData = { 
      step: step,
      lastMessageAt: new Date()
    };
    
    if (Object.keys(data).length > 0) {
      updateData.rideData = { ...data };
    }
    
    await Conversation.findOneAndUpdate(
      { phone: phone, isActive: true },
      updateData
    );
  } catch (error) {
    console.error('Error updating conversation step:', error);
    throw error;
  }
}

async function clearConversationHistory(phone) {
  try {
    console.log(`🧹 Clearing conversation history and ALL booking data for ${phone}`);
    
    // Clear EVERYTHING - conversation history AND ride data
    await Conversation.findOneAndUpdate(
      { phone: phone, isActive: true },
      {
        conversationHistory: [],           // Clear conversation history
        rideData: {},                     // Clear ride data completely
        lastValidContext: null,           // Clear stored context that AI uses
        step: 'ai_managed',               // Reset step
        lastMessageAt: new Date(),
        // Keep aiEnabled and isActive as they were
      }
    );
    
    console.log(`✅ ALL conversation data cleared for ${phone} - fresh start`);
  } catch (error) {
    console.error('Error clearing conversation history:', error);
    throw error;
  }
}

async function processConversationMessage(phone, message, isFromWhatsApp = false) {
  try {
    const conversation = await getOrCreateConversation(phone);
    
    // **NEW: Check for restart commands before adding to history**
    const restartCommands = [
      'another ride', 'new ride', 'book another ride', 'next ride', 
      'start over', 'restart', 'new booking', 'fresh ride',
      
    ];
    
    const cleanMessage = message.toLowerCase().trim();
    const isRestartCommand = restartCommands.some(cmd => cleanMessage.includes(cmd));
    
    if (isRestartCommand) {
      console.log(`🔄 Restart command detected, clearing conversation history`);
      await clearConversationHistory(phone);
      
      // **FIX: Immediately return fresh start response instead of continuing with normal flow**
      const freshStartResponse = "🚗 *New Ride Booking*\n\nHi! I'll help you book a ride.\n\nWhere would you like to be picked up from?\n\n(Please provide a specific pickup location - address, landmark, or area name)";
      
      // Get the refreshed conversation and add the response
      const refreshedConversation = await getOrCreateConversation(phone);
      await refreshedConversation.addMessage('assistant', freshStartResponse);
      
      console.log(`✅ Fresh start response sent for ${phone}`);
      return freshStartResponse;
    } else {
      // Add user message to conversation history only if not a restart command
      await conversation.addMessage('user', message);
    }
    
    // **FIX: Enable AI mode by default for all new conversations**
    if (!conversation.aiEnabled && conversation.conversationHistory.length <= 2) {
      console.log(`🤖 Auto-enabling AI mode for new conversation: ${phone}`);
      await conversation.enableAI();
    }

    console.log(`🔍 Processing message for ${phone}, AI enabled: ${conversation.aiEnabled}, step: ${conversation.step}`);
    
    // Check for commands first
    const commandHandler = require('./commandHandler');
    const commandResponse = await commandHandler.handleCommands(conversation, message);
    
    if (commandResponse) {
      return commandResponse;
    }
    
    // **Always route to AI handler if AI is enabled**
    if (conversation.aiEnabled) {
      console.log(`🤖 Routing to AI handler for ${phone}`);
      const aiHandler = require('./aiHandler');
      // Use AI handler for intelligent responses
      if (conversation.step === 'awaiting_response') {
        return await aiHandler.processAIMessage(conversation, message, isFromWhatsApp);
      }
      return await aiHandler.processAIMessage(conversation, message, isFromWhatsApp);
    } else {
      console.log(`📋 Routing to traditional handler for ${phone}`);
      const traditionalHandler = require('./traditionalHandler');
      return await traditionalHandler.processTraditionalMessage(conversation, message);
    }
    
  } catch (error) {
    console.error('Error processing conversation message:', error);
    return "Sorry, I encountered an error. Please try again or type 'restart' to start over.";
  }
}


module.exports = {
  getOrCreateConversation,
  updateConversationStep,
  clearConversationHistory,
  processConversationMessage
}; 