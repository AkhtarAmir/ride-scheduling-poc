const express = require('express');
const router = express.Router();
const vectorDBService = require('../services/vectorDBService');

// GET /driver-preferences/suggestions/:phone - Get driver suggestions for a user
router.get('/suggestions/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { from, to, minRides = 3 } = req.query;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }
    
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Destination (to) is required'
      });
    }
    
    const suggestions = await vectorDBService.findPreferredDrivers(phone, to, parseInt(minRides));
    
    res.json({
      success: true,
      suggestions,
      count: suggestions.length
    });
  } catch (error) {
    console.error('Error getting driver suggestions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /driver-preferences/record-ride - Manually record a ride (for testing)
router.post('/record-ride', async (req, res) => {
  try {
    const { phone, driverPhone, from, to, success = true } = req.body;
    
    if (!phone || !driverPhone || !from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Phone, driver phone, from, and to are required'
      });
    }
    
    await vectorDBService.recordRide(phone, driverPhone, from, to, success);
    
    res.json({
      success: true,
      message: 'Ride recorded successfully in vector database'
    });
  } catch (error) {
    console.error('Error recording ride:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /driver-preferences/test-suggestion/:phone - Test driver suggestion formatting
router.get('/test-suggestion/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { to = 'airport' } = req.query;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }
    
    const suggestions = await vectorDBService.findPreferredDrivers(phone, to, 3);
    const formattedMessage = vectorDBService.formatDriverSuggestion(suggestions, to);
    
    res.json({
      success: true,
      suggestions,
      formattedMessage,
      hasSuggestions: suggestions.length > 0
    });
  } catch (error) {
    console.error('Error testing suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /driver-preferences/has-preferences/:phone - Check if user has preferences
router.get('/has-preferences/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const { to } = req.query;
    
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }
    
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Destination (to) is required'
      });
    }
    
    const hasPreferences = await vectorDBService.hasPreferredDrivers(phone, to, 3);
    
    res.json({
      success: true,
      hasPreferences,
      destination: to
    });
  } catch (error) {
    console.error('Error checking preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 