const { bookRideInternal, getRideStatus } = require('../services/rideService');
const { processConversationMessage } = require('../services/conversationService');
const { sendNotification } = require('../services/notificationService');
const { checkCalendarConflicts, createCalendarEvent } = require('../services/calendarService');
const Conversation = require('../models/Conversation');
const Ride = require('../models/Ride');
const User = require('../models/User');
const mongoose = require('mongoose');
const moment = require('moment');

async function requestRide(req, res) {
  try {
    const { driverPhone, riderPhone, from, to, requestedTime, estimatedDuration = 60 } = req.body;
    
    // Validate required fields
    if (!driverPhone || !riderPhone || !from || !to || !requestedTime) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: driverPhone, riderPhone, from, to, requestedTime"
      });
    }
    
    // Validate phone number format
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(driverPhone) || !phoneRegex.test(riderPhone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format. Must be in international format (e.g., +1234567890)"
      });
    }
    const requestedDateTime = new Date(requestedTime);
    const now = new Date();
    
    if (isNaN(requestedDateTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date/time format. Please use ISO format (e.g., 2025-07-26T14:00:00)"
      });
    }
    if (requestedDateTime <= now) {
      return res.status(400).json({
        success: false,
        message: "Cannot book rides for past dates or times. Please select a future time."
      });
    }
    
    const result = await bookRideInternal({
      driverPhone,
      riderPhone,
      from,
      to,
      time: requestedTime,
      estimatedDuration
    });
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
    
  } catch (error) {
    console.error('Ride request error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function getRideStatusById(req, res) {
  try {
    const { id } = req.params;
    const result = await getRideStatus(id);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
    
  } catch (error) {
    console.error('Get ride status error:', error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

async function whatsappWebhook(req, res) {
  try {
    console.log('WhatsApp webhook received:', JSON.stringify(req.body, null, 2));
    
    // Twilio WhatsApp webhook structure
    const message = req.body.Body;
    const from = req.body.From; // Format: whatsapp:+1234567890
    const to = req.body.To;
    const numMedia = parseInt(req.body.NumMedia) || 0;
    
    // **NEW: Location sharing detection**
    const latitude = req.body.Latitude;
    const longitude = req.body.Longitude;
    const address = req.body.Address;
    const label = req.body.Label;
    
    if (!from) {
      return res.status(400).send('Invalid webhook data - missing from field');
    }
    
    // Extract phone number (remove "whatsapp:" prefix)
    const phoneNumber = from.replace('whatsapp:', '');
    
    // **NEW: Handle location sharing**
    if (latitude && longitude) {
      console.log(`📍 Location shared by ${phoneNumber}: ${latitude}, ${longitude}`);
      
      const { reverseGeocode } = require('../services/mapsService');
      const geocodeResult = await reverseGeocode(parseFloat(latitude), parseFloat(longitude));
      
      let locationMessage;
      if (geocodeResult.success) {
        locationMessage = geocodeResult.address;
        console.log(`✅ Location converted to address: ${locationMessage}`);
      } else {
        // Fallback: use provided address or coordinates
        locationMessage = address || `${latitude}, ${longitude}`;
        console.log(`⚠️ Using fallback location: ${locationMessage}`);
      }
      
      // Add custom label if provided
      if (label) {
        locationMessage = `${label} - ${locationMessage}`;
      }
      
      // Process the location message as a normal text message
      console.log(`Processing location as text message: "${locationMessage}"`);
      const responseMessage = await processConversationMessage(phoneNumber, locationMessage, true);
      
      // Send response back via WhatsApp only if there's a message to send
      if (responseMessage) {
        await sendNotification(from, responseMessage);
      } else {
        console.log(`No response message to send (likely handled by another service)`);
      }
      
      // Respond to Twilio webhook
      return res.status(200).send('OK');
    }
    
    // Check for non-text content (excluding location which we handle above)
    if (numMedia > 0 || !message || message.trim().length === 0) {
      console.log(`🚫 Non-text content received from ${phoneNumber}. Media count: ${numMedia}`);
      
      const textOnlyMessage = "I can only help with text messages and locations. Please provide your ride booking details as text (pickup location, destination, and preferred time) or share your location.";
      
      // Send response back via WhatsApp
      await sendNotification(from, textOnlyMessage);
      
      // Respond to Twilio webhook
      return res.status(200).send('OK');
    }
    
    console.log(`📱 Processing WhatsApp message from ${phoneNumber}: "${message}"`);
    
    // Process the conversation
    const responseMessage = await processConversationMessage(phoneNumber, message, true);
    
    // Send response back via WhatsApp only if there's a message to send
    if (responseMessage) {
      await sendNotification(from, responseMessage);
    } else {
      console.log(`No response message to send (likely handled by another service)`);
    }
    
    // Respond to Twilio webhook
    res.status(200).send('OK');
    
  } catch (error) {
    console.log('error here');
    console.error('WhatsApp webhook error:', error);
    res.status(500).send('Internal server error');
  }
}

async function resetConversation(req, res) {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number required' });
    }
    
    await Conversation.findOneAndUpdate(
      { phone: phone },
      { isActive: false }
    );
    
    res.json({ success: true, message: 'Conversation reset' });
  } catch (error) {
    console.error('Error resetting conversation:', error);
    res.status(500).json({ success: false, error: 'Failed to reset conversation' });
  }
}

// GET /health - Health check
async function healthCheck(req, res) {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    
    const stats = {
      totalRides: await Ride.countDocuments(),
      autoAccepted: await Ride.countDocuments({ status: "auto_accepted" }),
      autoRejected: await Ride.countDocuments({ status: "auto_rejected" }),
      completedRides: await Ride.countDocuments({ status: "completed" }),
      activeConversations: await Conversation.countDocuments({ isActive: true }),
      totalUsers: await User.countDocuments()
    };

    // Get vector database stats
    const vectorDBService = require('../services/vectorDBService');
    let vectorDBStats = null;
    if (vectorDBService.isInitialized) {
      try {
        vectorDBStats = await vectorDBService.getConversationStats();
      } catch (error) {
        vectorDBStats = { error: error.message };
      }
    }
    
    res.json({
      status: "ok",
      mode: "FULLY_AUTOMATED + WHATSAPP + VECTOR_DB",
      database: dbStatus,
      twilio: "mock",
      vectorDB: vectorDBService.isInitialized ? "connected" : "not_configured",
      stats,
      vectorDBStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: "error",
      error: "Health check failed",
      timestamp: new Date().toISOString()
    });
  }
}

// POST /calendar/test - Test calendar service
async function testCalendarService(req, res) {
  try {
    const { 
      driverPhone = '+1234567890', 
      riderPhone = '+0987654321', 
      from = 'Test Location A', 
      to = 'Test Location B',
      requestedTime = moment().add(1, 'hour').toISOString(),
      duration = 60,
      testType = 'both' // 'conflicts', 'create', or 'both'
    } = req.body;

    console.log('🧪 Calendar Service Test Request:', {
      driverPhone,
      riderPhone,
      from,
      to,
      requestedTime,
      duration,
      testType
    });

    const results = {
      timestamp: new Date().toISOString(),
      testType,
      conflictTest: null,
      createTest: null,
      summary: {}
    };

    // Test 1: Conflict Check
    if (testType === 'conflicts' || testType === 'both') {
      console.log('🔍 Testing conflict check...');
      try {
        const conflictResult = await checkCalendarConflicts(
          driverPhone,
          riderPhone,
          new Date(requestedTime),
          duration
        );
        
        results.conflictTest = {
          success: true,
          result: conflictResult
        };
        
        console.log('✅ Conflict check completed');
      } catch (error) {
        results.conflictTest = {
          success: false,
          error: error.message,
          details: error
        };
        console.error('❌ Conflict check failed:', error);
      }
    }

    // Test 2: Event Creation
    if (testType === 'create' || testType === 'both') {
      console.log('📅 Testing event creation...');
      try {
        const dummyRide = {
          rideId: `test-${Date.now()}`,
          driverPhone,
          riderPhone,
          from,
          to,
          requestedTime: new Date(requestedTime),
          estimatedDuration: duration
        };

        const eventId = await createCalendarEvent(dummyRide);
        
        results.createTest = {
          success: true,
          eventId,
          rideData: dummyRide
        };
        
        console.log('✅ Event creation completed');
      } catch (error) {
        results.createTest = {
          success: false,
          error: error.message,
          details: error
        };
        console.error('❌ Event creation failed:', error);
      }
    }

    // Generate summary
    const conflictSuccess = results.conflictTest?.success;
    const createSuccess = results.createTest?.success;
    
    if (testType === 'both') {
      results.summary = {
        overall: conflictSuccess && createSuccess ? 'PASS' : 'FAIL',
        conflictCheck: conflictSuccess ? 'PASS' : 'FAIL',
        eventCreation: createSuccess ? 'PASS' : 'FAIL'
      };
    } else if (testType === 'conflicts') {
      results.summary = {
        overall: conflictSuccess ? 'PASS' : 'FAIL',
        conflictCheck: conflictSuccess ? 'PASS' : 'FAIL'
      };
    } else if (testType === 'create') {
      results.summary = {
        overall: createSuccess ? 'PASS' : 'FAIL',
        eventCreation: createSuccess ? 'PASS' : 'FAIL'
      };
    }

    console.log('🎉 Calendar service test completed');
    console.log('Summary:', results.summary);

    res.json({
      success: true,
      message: 'Calendar service test completed',
      results
    });

  } catch (error) {
    console.error('❌ Calendar service test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Calendar service test failed',
      error: error.message,
      details: error
    });
  }
}

module.exports = {
  requestRide,
  getRideStatusById,
  whatsappWebhook,
 // getActiveConversations,
  resetConversation,
  healthCheck,
  testCalendarService
}; 