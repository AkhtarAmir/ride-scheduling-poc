const config = require("../../../config/vectorDB");

class ConversationManager {
  constructor(vectorOperations) {
    this.vectorOperations = vectorOperations;
  }

  async storeConversation(phone, message, response, metadata = {}) {
    try {
      if (!this.vectorOperations.isReady()) {
        throw new Error("Vector operations not initialized");
      }

      const conversationText = `User: ${message}\nAssistant: ${response}`;
      const embedding = await this.vectorOperations.generateEmbedding(conversationText);

      const vectorId = `${phone}_${Date.now()}`;
      const conversationMetadata = {
        phone,
        message,
        response,
        ...metadata,
      };

      await this.vectorOperations.storeVector(vectorId, embedding, conversationMetadata);
      console.log(`✅ Stored conversation for ${phone}`);
      return vectorId;
    } catch (error) {
      console.error("❌ Failed to store conversation:", error.message);
      throw error;
    }
  }

  async findSimilarConversations(message, phone = null, limit = config.conversation?.maxResults || 3) {
    try {
      if (!this.vectorOperations.isReady()) {
        throw new Error("Vector operations not initialized");
      }

      const embedding = await this.vectorOperations.generateEmbedding(message);

      const filter = phone ? { phone: { $eq: phone } } : undefined;
      const results = await this.vectorOperations.queryVectors(embedding, { limit, filter });

      const threshold = config.conversation?.similarityThreshold || 0.7;

      const filteredResults = results
        .filter(match => match.score >= threshold)
        .map(match => ({
          id: match.id,
          score: match.score,
          metadata: match.metadata,
        }));

      return filteredResults;
    } catch (error) {
      console.error("❌ Failed to find similar conversations:", error.message);
      return [];
    }
  }

  async deleteConversations(phone) {
    try {
      if (!this.vectorOperations.isReady()) {
        throw new Error("Vector operations not initialized");
      }
      
      await this.vectorOperations.deleteVectors({ phone: { $eq: phone } });
      console.log(`✅ Deleted conversations for ${phone}`);
    } catch (error) {
      console.error("❌ Failed to delete conversations:", error.message);
      throw error;
    }
  }

  // Get user's booking history and context
  async getUserBookingContext(phone) {
    try {
      if (!this.vectorOperations.isReady()) {
        return null;
      }

      // Get recent conversations
      const recentConversations = await this.findSimilarConversations("", phone, 5);
      
      // Get user's preferred drivers (this would integrate with DriverPreferences)
      const embedding = await this.vectorOperations.generateEmbedding(`User ${phone} driver preferences`);
      const allPreferredDrivers = await this.vectorOperations.queryVectors(embedding, {
        limit: 10,
        filter: { 
          type: { $eq: 'driver_preference' },
          phone: { $eq: phone }
        }
      });

      const preferredDrivers = allPreferredDrivers
        .filter(match => match.score >= 0.3)
        .map(match => ({
          driverPhone: match.metadata.driverPhone,
          from: match.metadata.from,
          to: match.metadata.to,
          rideCount: match.metadata.rideCount,
          rating: match.metadata.rating,
          lastUsed: match.metadata.timestamp
        }))
        .sort((a, b) => b.rideCount - a.rideCount);

      // Get recent destinations
      const recentDestinations = recentConversations
        .filter(conv => conv.metadata.response && conv.metadata.response.includes('Destination:'))
        .map(conv => {
          const destMatch = conv.metadata.response.match(/Destination:\s*([^\n]+)/);
          return destMatch ? destMatch[1].trim() : null;
        })
        .filter(Boolean)
        .slice(0, 3);

      return {
        recentConversations: recentConversations.length,
        preferredDrivers: preferredDrivers.slice(0, 5), // Top 5 preferred drivers
        recentDestinations: [...new Set(recentDestinations)], // Remove duplicates
        totalRides: preferredDrivers.reduce((sum, driver) => sum + driver.rideCount, 0)
      };
    } catch (error) {
      console.error("❌ Failed to get user booking context:", error.message);
      return null;
    }
  }

  // Simple helper to format conversation history
  formatConversationHistory(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return "";
    }

    const maxHistory = 6; // Keep last 6 messages for context
    const recentHistory = conversationHistory.slice(-maxHistory);
    
    return recentHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  }

  // Detect if user wants to book a ride
  detectBookingIntent(message, conversationHistory = []) {
    const bookingKeywords = [
      'book', 'booking', 'ride', 'taxi', 'cab', 'car', 'driver',
      'pickup', 'pick me up', 'need a ride', 'want to go',
      'transport', 'travel', 'drive', 'lift'
    ];
    
    const messageLower = message.toLowerCase();
    const hasBookingKeyword = bookingKeywords.some(keyword => 
      messageLower.includes(keyword)
    );
    
    // Check if this is a new booking conversation
    const recentMessages = conversationHistory.slice(-3);
    const hasRecentBooking = recentMessages.some(msg => 
      bookingKeywords.some(keyword => msg.content.toLowerCase().includes(keyword))
    );
    
    return hasBookingKeyword || hasRecentBooking;
  }

  // Validate user message quality
  isValidUserMessage(message) {
    const clean = message.trim().toLowerCase();
  
    // Too short
    if (clean.length < 3) return false;
  
    // Only emojis or non-alphanumeric symbols
    if (!/[a-z0-9]/i.test(clean)) return false;
  
    // Repetitive chars (e.g., "aaaaa", ".....", "zzzz")
    if (/^(.)\1{2,}$/.test(clean)) return false;
  
    // Gibberish patterns or low signal content
    const gibberishPatterns = ['asdf', 'qwer', 'zxcz', 'xytz', 'test', '1234', '0000', 'abc', 'xyz'];
    if (gibberishPatterns.some(g => clean.includes(g))) return false;
  
    // Contains too many repeated symbols or emojis
    const symbolCount = (clean.match(/[^a-zA-Z0-9\s]/g) || []).length;
    if (symbolCount / clean.length > 0.5) return false;
  
    // Looks like nonsense words
    if (clean.split(/\s+/).length === 1 && !/[aeiou]/.test(clean)) return false;
  
    return true;
  }

  // Check if message is a text message
  isTextMessage(whatsappMessage) {
    // Check if it's a text message type
    if (whatsappMessage.type && whatsappMessage.type !== 'text') {
      console.log(`🚫 Non-text message type: ${whatsappMessage.type}`);
      return false;
    }
    
    // Check if message has text content
    const messageText = whatsappMessage.text?.body || whatsappMessage.body || '';
    if (!messageText || typeof messageText !== 'string') {
      console.log(`🚫 No text content found`);
      return false;
    }
    
    return true;
  }

  // Track booking completion and update preferences
  async trackBookingCompletion(phone, conversationHistory) {
    try {
      if (!this.vectorOperations.isReady()) {
        return null;
      }

      // Check if this conversation contains a completed booking
      const completionKeywords = [
        'confirmed', 'booked', 'confirmed booking', 'ride confirmed',
        'booking confirmed', 'proceed', 'go ahead', 'yes book it',
        'okay book', 'book the ride', 'confirm booking'
      ];
      
      const recentMessages = conversationHistory.slice(-2).map(msg => msg.content.toLowerCase());
      const hasCompletion = recentMessages.some(msg => 
        completionKeywords.some(keyword => msg.includes(keyword))
      );
      
      if (!hasCompletion) {
        return null;
      }

      // Extract final booking data would be handled by BookingExtractor
      // For now, return basic completion tracking
      console.log(`✅ Tracked potential booking completion for ${phone}`);
      return { tracked: true };
      
    } catch (error) {
      console.error("❌ Failed to track booking completion:", error.message);
      return null;
    }
  }

  async getStats() {
    try {
      return await this.vectorOperations.getStats();
    } catch (error) {
      console.error("❌ Failed to get conversation stats:", error.message);
      return null;
    }
  }
}

module.exports = ConversationManager; 