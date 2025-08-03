const express = require('express');
const router = express.Router();
const vectorDBService = require('../services/vectorDBService');
const Conversation = require('../models/Conversation');

// GET /vectordb/stats - Get vector database statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await vectorDBService.getConversationStats();
    res.json({
      success: true,
      stats,
      isInitialized: vectorDBService.isInitialized
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /vectordb/conversations/search - Search similar conversations
router.get('/conversations/search', async (req, res) => {
  try {
    
    const { query, phone, limit = 5 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      });
    }
      
    const results = await vectorDBService.findSimilarConversations(query, null, parseInt(limit));
    
    res.json({
      success: true,
      results,
      query,
      count: results.length
    });
  } catch (error) {
    console.log('❌ Route error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /vectordb/conversations/delete - Delete conversations for a phone number
router.post('/conversations/delete', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }
    
    await vectorDBService.deleteConversations(phone);
    res.json({
      success: true,
      message: `Conversations deleted for ${phone}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /vectordb/conversations/ai-toggle - Toggle AI mode for a conversation
router.post('/conversations/ai-toggle', async (req, res) => {
  try {
    const { phone, enable } = req.body;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }
    
    const conversation = await Conversation.findOne({ phone, isActive: true });
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    if (enable) {
      await conversation.enableAI();
    } else {
      await conversation.disableAI();
    }
    
    res.json({
      success: true,
      message: `AI mode ${enable ? 'enabled' : 'disabled'} for ${phone}`,
      aiEnabled: conversation.aiEnabled
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /vectordb/conversations/ai-status - Get AI mode status for all conversations
router.get('/conversations/ai-status', async (req, res) => {
  try {
    const conversations = await Conversation.find({ isActive: true });
    const aiEnabled = conversations.filter(c => c.aiEnabled).length;
    const total = conversations.length;
    
    res.json({
      success: true,
      stats: {
        total,
        aiEnabled,
        traditional: total - aiEnabled
      },
      conversations: conversations.map(c => ({
        phone: c.phone,
        aiEnabled: c.aiEnabled,
        step: c.step,
        lastMessageAt: c.lastMessageAt
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /vectordb/test-response - Test AI response generation
router.post('/test-response', async (req, res) => {
  try {
    const { phone, message, history = [] } = req.body;
    
    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone and message are required'
      });
    }
    
    const response = await vectorDBService.generateIntelligentResponse(phone, message, history);
    res.json({
      success: true,
      response,
      phone,
      message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 