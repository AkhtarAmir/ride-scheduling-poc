const {
    aiHandler,
    bookingHandler,
    commandHandler,
    traditionalHandler,
    conversationCore,
    responseFormatter
} = require('./conversation');

class ConversationService {
    constructor() {
        this.core = conversationCore;
        this.formatter = responseFormatter;
    }

    async processMessage(userId, message, type = 'ai') {
        const conversation = await this.core.getOrCreateConversation(userId);
        
        let response;
        switch(type) {
            case 'ai':
                response = await aiHandler.processAIMessage(conversation, message);
                break;
            case 'traditional':
                response = await traditionalHandler.processTraditionalMessage(conversation, message);
                break;
            case 'command':
                response = await commandHandler.handleCommands(conversation, message);
                break;
            case 'booking':
                response = await bookingHandler.processBooking(conversation, message);
                break;
            default:
                throw new Error('Invalid conversation type');
        }

        await this.core.updateConversationStep(conversation.id, response);
        return this.formatter.formatResponse(response);
    }
}

module.exports = new ConversationService(); 