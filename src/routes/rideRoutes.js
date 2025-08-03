const express = require('express');
const router = express.Router();
const {
  requestRide,
  getRideStatusById,
  whatsappWebhook,
  //getActiveConversations,
  resetConversation,
  healthCheck,
  testCalendarService
} = require('../controllers/rideController');

// Import vector database routes
const vectorDBRoutes = require('./vectorDBRoutes');

// Ride booking endpoints
router.post('/ride/request', requestRide);
router.get('/ride/status/:id', getRideStatusById);
router.post('/webhook/whatsapp', whatsappWebhook);

// Calendar testing endpoint
router.post('/calendar/test', testCalendarService);

// Conversation management
// router.get('/conversations/active', getActiveConversations);
router.post('/conversations/reset', resetConversation);

// Vector Database routes
router.use('/vectordb', vectorDBRoutes);

// Health check
router.get('/health', healthCheck);

module.exports = router; 