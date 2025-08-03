const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\+[1-9]\d{1,14}$/.test(v);
      },
      message: 'Invalid phone number format'
    }
  },
  step: {
    type: String,
    enum: ['waiting_for_from', 'waiting_for_to', 'waiting_for_time', 'waiting_for_duration', 'waiting_for_driver', 'waiting_for_alternative_driver', 'waiting_for_alternative_time', 'completed', 'ai_managed'],
    default: 'waiting_for_from'
  },
  rideData: {
    from: { type: String, default: null },
    to: { type: String, default: null },
    time: { type: String, default: null },
    estimatedDuration: { type: Number, default: null },
    driverPhone: { type: String, default: null },
    distance: { type: Number, default: null }
  },
  // Enhanced conversation history
  conversationHistory: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  }],
  // AI-specific fields
  aiEnabled: {
    type: Boolean,
    default: false
  },
  // Store last valid JSON context to prevent context loss
  lastValidContext: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Vector database reference
  vectorId: {
    type: String,
    default: null
  }
}, { timestamps: true });

ConversationSchema.index({ lastMessageAt: 1 }, { expireAfterSeconds: 1800 });

// Method to add message to conversation history
ConversationSchema.methods.addMessage = function(role, content, metadata = {}) {
  this.conversationHistory.push({
    role,
    content,
    timestamp: new Date(),
    metadata
  });
  
  // Keep only last 20 messages to prevent bloat
  if (this.conversationHistory.length > 20) {
    this.conversationHistory = this.conversationHistory.slice(-20);
  }
  
  this.lastMessageAt = new Date();
  return this.save();
};

// Method to get recent conversation history
ConversationSchema.methods.getRecentHistory = function(limit = 10) {
  return this.conversationHistory.slice(-limit);
};

// Method to enable AI mode
ConversationSchema.methods.enableAI = function() {
  this.aiEnabled = true;
  this.step = 'ai_managed';
  return this.save();
};

// Method to disable AI mode
ConversationSchema.methods.disableAI = function() {
  this.aiEnabled = false;
  this.step = 'waiting_for_from';
  return this.save();
};

// Method to get stored context
ConversationSchema.methods.getStoredContext = function() {
  return this.lastValidContext;
};

// Method to update stored context
ConversationSchema.methods.updateStoredContext = function(contextData) {
  this.lastValidContext = {
    ...contextData,
    timestamp: new Date()
  };
  return this.save();
};

// Method to extract ride data from conversation history
ConversationSchema.methods.extractRideData = function() {
  const rideData = {
    from: this.rideData.from,
    to: this.rideData.to,
    time: this.rideData.time,
    estimatedDuration: this.rideData.estimatedDuration,
    driverPhone: this.rideData.driverPhone,
    distance: this.rideData.distance
  };

  // If we already have complete ride data, return it
  if (rideData.from && rideData.to && rideData.time && rideData.driverPhone) {
    return rideData;
  }

  // Try to extract missing data from conversation history
  const history = this.conversationHistory.map(msg => msg.content).join(' ');
  
  // Extract pickup location
  if (!rideData.from) {
    const fromMatch = history.match(/from\s+([^,\n]+)/i) || 
                     history.match(/pickup[:\s]+([^,\n]+)/i) ||
                     history.match(/pick\s+me\s+up\s+from\s+([^,\n]+)/i);
    if (fromMatch) {
      rideData.from = fromMatch[1].trim();
    }
  }

  // Extract destination
  if (!rideData.to) {
    const toMatch = history.match(/to\s+([^,\n]+)/i) || 
                   history.match(/destination[:\s]+([^,\n]+)/i) ||
                   history.match(/go\s+to\s+([^,\n]+)/i);
    if (toMatch) {
      rideData.to = toMatch[1].trim();
    }
  }

  // Extract time
  if (!rideData.time) {
    const timeMatch = history.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i) ||
                     history.match(/(\d{1,2}\s*(?:AM|PM|am|pm))/i) ||
                     history.match(/(in\s+\d+\s+(?:hour|minute)s?)/i) ||
                     history.match(/(today|tomorrow)\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
    if (timeMatch) {
      rideData.time = timeMatch[0].trim();
    }
  }

  // Extract driver phone
  if (!rideData.driverPhone) {
    const phoneMatch = history.match(/(\+\d{1,3}\s*\d{3,4}\s*\d{3,4}\s*\d{3,4})/);
    if (phoneMatch) {
      rideData.driverPhone = phoneMatch[1].replace(/\s+/g, '');
    }
  }

  return rideData;
};

module.exports = mongoose.model('Conversation', ConversationSchema); 