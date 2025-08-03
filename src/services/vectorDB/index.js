const VectorOperations = require('./core/vectorOperations');
const BookingExtractor = require('./booking/bookingExtractor');
const DriverPreferences = require('./drivers/driverPreferences');
const ConversationManager = require('./conversation/conversationManager');
const SystemPromptBuilder = require('./prompts/systemPromptBuilder');
const config = require('../../config/vectorDB');

class VectorDBService {
  constructor() {
    // Initialize all modules
    this.vectorOps = new VectorOperations();
    this.bookingExtractor = new BookingExtractor(this.vectorOps);
    this.driverPrefs = new DriverPreferences(this.vectorOps);
    this.conversationManager = new ConversationManager(this.vectorOps);
    this.promptBuilder = new SystemPromptBuilder();
    
    this.isInitialized = false;
  }

  async initialize() {
    try {
      await this.vectorOps.initialize();
      this.isInitialized = true;
      console.log("✅ Modular Vector Database Service initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Modular Vector Database Service:", error.message);
      throw error;
    }
  }

  // Core vector operations (delegated)
  async generateEmbedding(text) {
    return await this.vectorOps.generateEmbedding(text);
  }

  // Conversation management
  async storeConversation(phone, message, response, metadata = {}) {
    return await this.conversationManager.storeConversation(phone, message, response, metadata);
  }

  async findSimilarConversations(message, phone = null, limit = config.conversation?.maxResults || 3) {
    return await this.conversationManager.findSimilarConversations(message, phone, limit);
  }

  async deleteConversations(phone) {
    return await this.conversationManager.deleteConversations(phone);
  }

  async getConversationStats() {
    return await this.conversationManager.getStats();
  }

  // Booking data extraction
  async extractBookingData(phone, conversationHistory) {
    return await this.bookingExtractor.extractBookingData(phone, conversationHistory);
  }

  shouldValidateLocationWithGoogle(message, bookingData) {
    return this.bookingExtractor.shouldValidateLocationWithGoogle(message, bookingData);
  }

  // Driver preferences
  async storeDriverPreference(phone, driverPhone, from, to, rideCount = 1, rating = 5) {
    return await this.driverPrefs.storeDriverPreference(phone, driverPhone, from, to, rideCount, rating);
  }

  async findPreferredDrivers(phone, to, minRides = 2) {
    return await this.driverPrefs.findPreferredDrivers(phone, to, minRides);
  }

  async hasPreferredDrivers(phone, to, minRides = 3) {
    return await this.driverPrefs.hasPreferredDrivers(phone, to, minRides);
  }

  async recordRide(phone, driverPhone, from, to, success = true) {
    return await this.driverPrefs.recordRide(phone, driverPhone, from, to, success);
  }

  async cleanupDuplicateDriverPreferences(phone) {
    return await this.driverPrefs.cleanupDuplicateDriverPreferences(phone);
  }

  formatDriverSuggestion(drivers, to) {
    return this.driverPrefs.formatDriverSuggestion(drivers, to);
  }

  // User context
  async getUserBookingContext(phone) {
    return await this.conversationManager.getUserBookingContext(phone);
  }

  // Conversation utilities
  formatConversationHistory(conversationHistory) {
    return this.conversationManager.formatConversationHistory(conversationHistory);
  }

  detectBookingIntent(message, conversationHistory = []) {
    return this.conversationManager.detectBookingIntent(message, conversationHistory);
  }

  isValidUserMessage(message) {
    return this.conversationManager.isValidUserMessage(message);
  }

  isTextMessage(whatsappMessage) {
    return this.conversationManager.isTextMessage(whatsappMessage);
  }

  async trackBookingCompletion(phone, conversationHistory) {
    return await this.conversationManager.trackBookingCompletion(phone, conversationHistory);
  }

  // System prompt building
  buildSystemPrompt(bookingData, userContext, driverSuggestionContext, shouldSuggestDrivers) {
    return this.promptBuilder.buildSystemPrompt(bookingData, userContext, driverSuggestionContext, shouldSuggestDrivers);
  }

  getNextAction(bookingData, shouldSuggestDrivers) {
    return this.promptBuilder.getNextAction(bookingData, shouldSuggestDrivers);
  }

  // Main intelligent response generation (the complex logic from the original file)
  async generateIntelligentResponse(phone, message, conversationHistory = [], preExtractedBookingData = null) {
    try {
      if (!this.isInitialized) {
        throw new Error("Vector Database Service not initialized");
      }

      console.log(`🐛 DEBUG: generateIntelligentResponse called for ${phone} with message: "${message}"`);
      
      // Use pre-extracted data if provided, otherwise extract fresh data
      const bookingData = preExtractedBookingData || await this.extractBookingData(phone, conversationHistory);
      console.log(`🐛 DEBUG: ${preExtractedBookingData ? 'Using pre-extracted' : 'Freshly extracted'} booking data:`, bookingData);
      
      // Check if user is rejecting a driver suggestion
      const isRejectingDriver = (message.toLowerCase().trim() === 'no' || 
                                message.toLowerCase().trim() === 'nope' || 
                                message.toLowerCase().trim() === 'different driver' ||
                                message.toLowerCase().trim() === 'new driver' ||
                                message.toLowerCase().trim() === 'another driver');
      
      console.log(`🐛 DEBUG: Is rejecting driver? ${isRejectingDriver}`);
      
      // Handle driver rejection with auto-assignment
      if (isRejectingDriver && bookingData.from && bookingData.to && bookingData.dateTime && !bookingData.driverPhone) {
        return await this.handleDriverRejection(phone, message, conversationHistory, bookingData);
      }
      
      // Handle user response to driver preference question
      const isAwaitingDriverPreference = await this.checkIfAwaitingDriverPreference(phone, conversationHistory);
      if (isAwaitingDriverPreference) {
        console.log(`🤖 User is responding to driver preference question`);
        return await this.handleDriverPreferenceResponse(phone, message, conversationHistory, bookingData);
      }
      
      // Handle explicit auto-assignment requests
      if (bookingData.responseType === 'auto_assign_request' && bookingData.from && bookingData.to && bookingData.dateTime) {
        console.log(`🤖 User explicitly requested auto-assignment`);
        return await this.performAutoAssignment(phone, message, bookingData);
      }
      
      if (!isRejectingDriver) {
        // FIRST: If AI accepted something as a location, validate it with Google Maps
        if (bookingData.acceptedAsLocation) {
          console.log(`🗺️ AI accepted "${message}" as ${bookingData.acceptedAsLocation}, validating with Google Maps`);
          
          const locationValidationResult = await this.handleLocationValidation(phone, message, {
            shouldValidate: true,
            locationType: bookingData.acceptedAsLocation,
            locationToValidate: message
          }, bookingData);
          
          if (locationValidationResult) {
            console.log(`❌ Google Maps validation failed, returning error message`);
            return locationValidationResult;
          }
          console.log(`✅ Google Maps validation passed for ${bookingData.acceptedAsLocation} location`);
        }
        
        // SECOND: After location validation (if any), check if clarification is needed
        if (bookingData.needsClarification) {
          console.log(`🐛 DEBUG: AI says needs clarification, returning: ${bookingData.clarificationMessage}`);
          await this.storeConversation(phone, message, bookingData.clarificationMessage, { 
            conversationType: "clarification_request",
            bookingStatus: bookingData.bookingStatus,
            inputQuality: bookingData.inputQuality
          });
          return bookingData.clarificationMessage;
        }
        
        // THIRD: If user provided time information, check for conflicts immediately
        if (bookingData.responseType === 'time' && bookingData.dateTime) {
          console.log(`⏰ User provided time information, checking for conflicts immediately...`);
          
          const conflictCheckResult = await this.checkEarlyTimeConflicts(phone, bookingData);
          
          if (conflictCheckResult && conflictCheckResult.hasConflict) {
            console.log(`❌ Time conflict detected: ${conflictCheckResult.message}`);
            
            await this.storeConversation(phone, message, conflictCheckResult.message, { 
              conversationType: "time_conflict_detected",
              bookingStatus: "conflict",
              conflictType: conflictCheckResult.conflictType,
              conflictDetails: JSON.stringify(conflictCheckResult.conflicts)
            });
            
            return conflictCheckResult.message;
          }
          
          console.log(`✅ No time conflicts detected for provided time`);
        }
      }
      
      
      // Check for driver suggestions or auto-assignment
      console.log(`🐛 DEBUG: Checking driver suggestion conditions:`);
      console.log(`  - from: ${bookingData.from ? 'YES' : 'NO'}`);
      console.log(`  - to: ${bookingData.to ? 'YES' : 'NO'}`);
      console.log(`  - dateTime: ${bookingData.dateTime ? 'YES' : 'NO'}`);
      console.log(`  - driverPhone: ${bookingData.driverPhone ? 'YES' : 'NO'}`);
      
      if (bookingData.from && bookingData.to && bookingData.dateTime && !bookingData.driverPhone && !isRejectingDriver) {
        return await this.handleDriverSuggestionOrAutoAssignment(phone, message, conversationHistory, bookingData);
      }
      
      // Handle driver confirmation when user says yes
      const isConfirmingDriver = (message.toLowerCase().trim() === 'yes' || 
                                 message.toLowerCase().trim() === 'okay' || 
                                 message.toLowerCase().trim() === 'ok' ||
                                 message.toLowerCase().trim() === 'sure');
      
      console.log(`🐛 DEBUG: Is confirming driver? ${isConfirmingDriver}`);
      
      if (isConfirmingDriver && bookingData.from && bookingData.to && bookingData.dateTime && !bookingData.driverPhone) {
        return await this.handleDriverConfirmation(phone, message, conversationHistory, bookingData);
      }
      
      console.log(`🐛 DEBUG: Continuing with normal AI response generation`);
      
      // Generate normal AI response
      return await this.generateNormalAIResponse(phone, message, conversationHistory, bookingData);

    } catch (error) {
      console.error("❌ Failed to generate intelligent response:", error.message);
      return "I apologize for the confusion. Could you please tell me: pickup location, destination, and preferred time?";
    }
  }

  async handleDriverRejection(phone, message, conversationHistory, bookingData) {
    const recentMessages = conversationHistory.slice(-10);
    let wasDriverSuggestion = false;
    
    for (const msg of recentMessages) {
      if (msg.role === 'assistant' && msg.content && msg.content.includes('Driver Suggestion') && msg.content.includes('Would you like to use')) {
        wasDriverSuggestion = true;
        console.log(`🔍 Found driver suggestion in recent messages`);
        break;
      }
    }
    
    if (wasDriverSuggestion) {
      console.log(`🚫 User rejected driver suggestion, asking for preference...`);
      
      const preferenceMessage = `🚗 *Driver Options*\n\nI understand you'd prefer a different driver.\n\nWhat would you like to do?\n\n1️⃣ **Auto-assign** - I'll find the nearest available driver\n2️⃣ **Choose driver** - Provide a specific driver's phone number\n\nReply with:\n• "auto assign" for automatic assignment\n• A driver's phone number for manual selection`;
      
      await this.storeConversation(phone, message, preferenceMessage, { 
        conversationType: "driver_preference_request",
        bookingStatus: "awaiting_driver_preference",
        originalRejection: true
      });
      
      return preferenceMessage;
    }
    
    return null;
  }

  async handleLocationValidation(phone, message, needsLocationValidation, bookingData) {

    const locationToValidate = needsLocationValidation.locationToValidate || message;
    
    console.log(`🗺️ Validating location with Google Maps: "${locationToValidate}"`);
    
    // Use the new Google validation from BookingExtractor
    const googleValidation = await this.bookingExtractor.validateLocationDirectly(locationToValidate);
    
    if (!googleValidation.isValid) {
      const errorMessage = `❌ ${googleValidation.reason}\n\nPlease provide a valid ${needsLocationValidation.locationType} location:\n• Try being more specific with the area name\n• Include the city name (e.g., "Main Market, Lahore")\n• Use a nearby landmark\n• Double-check the spelling`;
      
      await this.storeConversation(phone, message, errorMessage, { 
        conversationType: "google_validation_failed",
        bookingStatus: bookingData.bookingStatus,
        failedLocation: locationToValidate,
        locationType: needsLocationValidation.locationType
      });
      
      return errorMessage;
    } else {
      console.log(`✅ Google Maps validation passed for: "${locationToValidate}"`);
      if (googleValidation.formattedAddress) {
        console.log(`📍 Formatted address: ${googleValidation.formattedAddress}`);
      }
    }
    
    return null; 
  }

  async checkEarlyTimeConflicts(phone, bookingData) {
    try {
      console.log(`⏰ Checking for calendar conflicts at ${bookingData.dateTime} for rider ${phone}`);
      
      const { checkCalendarConflicts } = require('../calendarService');
      const moment = require('moment');
      
      const conflictResult = await checkCalendarConflicts(
        null, // No driver phone yet
        phone, // Rider phone
        moment(bookingData.dateTime).toDate(),
        60 // Assume 1 hour duration
      );
      
      if (conflictResult.hasConflict) {
        console.log(`❌ Calendar conflict detected for rider ${phone}:`, conflictResult);
        
        // Format the conflict message based on the type
        let conflictMessage = "";
        
        if (conflictResult.rejectionReason === 'rider_conflict') {
          const conflictDetails = conflictResult.conflicts
            .filter(c => c.type === 'rider')
            .map(c => `"${c.title}" (${moment(c.start).format('MMM DD, h:mm A')} - ${moment(c.end).format('h:mm A')})`)
            .join(', ');
            
          conflictMessage = `⚠️ *Schedule Conflict Detected*\n\nYou have a conflicting appointment at ${bookingData.dateTime}:\n${conflictDetails}\n\nPlease choose a different time for your ride. When would you like to travel instead?`;
        } else {
          conflictMessage = `⚠️ *Schedule Conflict*\n\nThere's a scheduling conflict at ${bookingData.dateTime}.\n\nPlease provide a different time for your ride.`;
        }
        
        return {
          hasConflict: true,
          conflictType: conflictResult.rejectionReason,
          conflicts: conflictResult.conflicts,
          message: conflictMessage
        };
      }
      
      return { hasConflict: false };
      
    } catch (error) {
      console.error(`❌ Error checking early time conflicts:`, error.message);
      // If conflict check fails, don't block the booking - continue normally
      return { hasConflict: false };
    }
  }

  async checkIfAwaitingDriverPreference(phone, conversationHistory) {
    try {
      // Check the last few messages to see if we recently asked for driver preference
      const recentMessages = conversationHistory.slice(-5);
      
      for (const msg of recentMessages) {
        if (msg.role === 'assistant' && 
            msg.metadata && 
            msg.metadata.conversationType === 'driver_preference_request') {
          console.log(`🔍 Found recent driver preference request`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Error checking driver preference state:`, error.message);
      return false;
    }
  }

  async handleDriverPreferenceResponse(phone, message, conversationHistory, bookingData) {
    try {
      const cleanMessage = message.toLowerCase().trim();
      console.log(`🤖 Handling driver preference response: "${cleanMessage}"`);
      
      // Check if user wants auto-assignment
      if (cleanMessage.includes('auto assign') || 
          cleanMessage.includes('auto-assign') || 
          cleanMessage.includes('automatic') ||
          cleanMessage === 'auto' ||
          cleanMessage === '1') {
        
        console.log(`🤖 User chose auto-assignment`);
        return await this.performAutoAssignment(phone, message, bookingData);
      }
      
      // Check if user provided a phone number
      const phoneRegex = /(\+92|92|03)\d{9,10}|\d{11}/;
      if (phoneRegex.test(cleanMessage)) {
        console.log(`🤖 User provided driver phone number`);
        
        // Extract the phone number
        const driverPhone = cleanMessage.match(phoneRegex)[0];
        console.log(`📱 Extracted driver phone: ${driverPhone}`);
        
        // Book the ride with the provided driver
        const { bookRideInternal } = require('../rideService');
        const bookingResult = await bookRideInternal({
          driverPhone: driverPhone,
          riderPhone: phone,
          from: bookingData.from,
          to: bookingData.to,
          time: bookingData.dateTime,
          estimatedDuration: 30
        });
        
        if (bookingResult.success) {
          const successMessage = `✅ *Booking Confirmed!*\n\n📍 *Pickup:* ${bookingData.from}\n🎯 *Destination:* ${bookingData.to}\n⏰ *Time:* ${bookingData.dateTime}\n📱 *Driver:* ${driverPhone}\n\n🎉 *Ride ID:* ${bookingResult.rideId}\n✅ Your ride has been successfully booked!`;
          
          await this.storeConversation(phone, message, successMessage, { 
            conversationType: "manual_driver_booking_success",
            selectedDriver: driverPhone,
            rideId: bookingResult.rideId,
            bookingStatus: "confirmed"
          });
          
          return successMessage;
        } else {
          console.log(`❌ Manual driver booking failed: ${bookingResult.message}`);
          
          await this.storeConversation(phone, message, `Manual booking handled by ride service`, { 
            conversationType: "manual_booking_handled_by_ride_service",
            selectedDriver: driverPhone,
            bookingStatus: "rejected",
            failureReason: bookingResult.rejectionReason || bookingResult.message
          });
          
          return "__MESSAGE_ALREADY_HANDLED__";
        }
      }
      
      // If neither auto-assign nor phone number, ask for clarification
      const clarificationMessage = `🤔 Please choose one of the options:\n\n1️⃣ Type "auto assign" for automatic driver assignment\n2️⃣ Provide a driver's phone number (e.g., 03001234567)\n\nWhat would you like to do?`;
      
      await this.storeConversation(phone, message, clarificationMessage, { 
        conversationType: "driver_preference_clarification",
        bookingStatus: "awaiting_driver_preference"
      });
      
      return clarificationMessage;
      
    } catch (error) {
      console.error(`❌ Error handling driver preference response:`, error.message);
      return "I apologize for the confusion. Please either type 'auto assign' or provide a driver's phone number.";
    }
  }

  async performAutoAssignment(phone, message, bookingData) {
    try {
      console.log(`🚗 Performing auto-assignment for ${phone}`);
      
      const { findNearestAvailableDrivers } = require('../rideService');
      const nearestDrivers = await findNearestAvailableDrivers(bookingData.from, bookingData.dateTime, 3);
      
      if (nearestDrivers.length > 0) {
        const assignedDriver = nearestDrivers[0];
        console.log(`✅ Auto-assigned driver: ${assignedDriver.driverPhone} (${assignedDriver.distance}km away, rating: ${assignedDriver.rating})`);
        
        const { bookRideInternal } = require('../rideService');
        const bookingResult = await bookRideInternal({
          driverPhone: assignedDriver.driverPhone,
          riderPhone: phone,
          from: bookingData.from,
          to: bookingData.to,
          time: bookingData.dateTime,
          estimatedDuration: Math.round(assignedDriver.duration) || 30
        });
        
        if (bookingResult.success) {
          const successMessage = `🚗 *Driver Auto-Assigned & Ride Booked!*\n\n✅ *Booking Confirmed:*\n📍 *Pickup:* ${bookingData.from}\n🎯 *Destination:* ${bookingData.to}\n⏰ *Time:* ${bookingData.dateTime}\n📱 *Driver:* ${assignedDriver.driverPhone} (${assignedDriver.name})\n🚗 *Vehicle:* ${assignedDriver.vehicleDetails?.make || 'N/A'} ${assignedDriver.vehicleDetails?.model || ''}\n⭐ *Rating:* ${assignedDriver.rating}/5 stars\n📏 *Distance:* ${assignedDriver.distance}km away\n\n🎉 *Ride ID:* ${bookingResult.rideId}\n✅ Your ride has been successfully booked!`;
          
          await this.storeConversation(phone, message, successMessage, { 
            conversationType: "auto_assignment_after_preference_success",
            assignedDriver: assignedDriver.driverPhone,
            rideId: bookingResult.rideId,
            bookingStatus: "confirmed"
          });
          
          return successMessage;
        } else {
          console.log(`❌ Auto-assignment failed: ${bookingResult.message}`);
          
          await this.storeConversation(phone, message, `Auto-assignment handled by ride service`, { 
            conversationType: "auto_assignment_after_preference_handled_by_ride_service",
            assignedDriver: assignedDriver.driverPhone,
            bookingStatus: "rejected",
            failureReason: bookingResult.rejectionReason || bookingResult.message
          });
          
          return "__MESSAGE_ALREADY_HANDLED__";
        }
      } else {
        const noDriversMessage = `⚠️ *No Drivers Available*\n\nI couldn't find any available drivers for your location at ${bookingData.dateTime}.\n\nPlease either:\n• Try a different time\n• Provide a specific driver's phone number\n• Contact our support for assistance\n\nWhat would you like to do?`;
        
        await this.storeConversation(phone, message, noDriversMessage, { 
          conversationType: "no_drivers_available_after_auto_assign_preference",
          bookingStatus: "incomplete",
          failureReason: "no_available_drivers"
        });
        
        return noDriversMessage;
      }
      
    } catch (error) {
      console.error(`❌ Error performing auto-assignment:`, error.message);
      return "I apologize, but I couldn't auto-assign a driver at the moment. Please provide a specific driver's phone number.";
    }
  }

  async handleDriverSuggestionOrAutoAssignment(phone, message, conversationHistory, bookingData) {
    console.log(`🔍 Checking for preferred drivers for destination: ${bookingData.to}`);
    
    const preferredDrivers = await this.findPreferredDrivers(phone, bookingData.to, 2);
    console.log(`🐛 DEBUG: Found ${preferredDrivers.length} preferred drivers:`, preferredDrivers);
    
    if (preferredDrivers.length > 0) {
      console.log(`✅ Found ${preferredDrivers.length} preferred driver(s), suggesting automatically`);
      
      const topDriver = preferredDrivers[0];
      const suggestionMessage = `🚗 *Driver Suggestion*\n\nI see you're going to ${bookingData.to}.\n\nWould you like to use your preferred driver?\n📱 *${topDriver.driverPhone}*\n💡 You've used them ${topDriver.rideCount} times for similar trips\n⭐ Rating: ${topDriver.rating}/5 stars\n\n${preferredDrivers.length > 1 ? `*Other options:*\n${preferredDrivers.slice(1, 3).map((driver, index) => `${index + 2}. ${driver.driverPhone} (${driver.rideCount} rides)`).join('\n')}\n\n` : ''}Reply with "yes" to use this driver, "no" for a different driver, or provide a driver number directly.`;
      
      console.log(`🐛 DEBUG: Returning driver suggestion: ${suggestionMessage}`);
      
      const alternativeDriversString = preferredDrivers.slice(1, 3)
        .map(driver => `${driver.driverPhone}:${driver.rideCount}`)
        .join(',');

      await this.storeConversation(phone, message, suggestionMessage, { 
        conversationType: "driver_suggestion",
        suggestedDriver: topDriver.driverPhone,
        alternativeDrivers: alternativeDriversString,
        suggestedDriverRides: topDriver.rideCount.toString(),   
        totalAlternatives: preferredDrivers.length.toString(),
        bookingStatus: "awaiting_driver_confirmation"
      });
      
      return suggestionMessage;
    } else {
      console.log(`ℹ️ No preferred drivers found for ${phone} going to ${bookingData.to}`);
      
      console.log(`🔍 Auto-assigning nearest available driver for pickup: ${bookingData.from}`);
      
      const { findNearestAvailableDrivers } = require('../rideService');
      const nearestDrivers = await findNearestAvailableDrivers(bookingData.from, bookingData.dateTime, 3);
      
      if (nearestDrivers.length > 0) {
        const assignedDriver = nearestDrivers[0];
        console.log(`✅ Auto-assigned driver: ${assignedDriver.driverPhone} (${assignedDriver.distance}km away, rating: ${assignedDriver.rating})`);
        
        // Actually book the ride
        const { bookRideInternal } = require('../rideService');
        const bookingResult = await bookRideInternal({
          driverPhone: assignedDriver.driverPhone,
          riderPhone: phone,
          from: bookingData.from,
          to: bookingData.to,
          time: bookingData.dateTime,
          estimatedDuration: Math.round(assignedDriver.duration) || 30
        });
        
        if (bookingResult.success) {
          const successMessage = `🚗 *Driver Assigned & Ride Booked!*\n\n✅ *Booking Confirmed:*\n📍 *Pickup:* ${bookingData.from}\n🎯 *Destination:* ${bookingData.to}\n⏰ *Time:* ${bookingData.dateTime}\n📱 *Driver:* ${assignedDriver.driverPhone} (${assignedDriver.name})\n🚗 *Vehicle:* ${assignedDriver.vehicleDetails?.make || 'N/A'} ${assignedDriver.vehicleDetails?.model || ''}\n⭐ *Rating:* ${assignedDriver.rating}/5 stars\n📏 *Distance:* ${assignedDriver.distance}km away\n\n🎉 *Ride ID:* ${bookingResult.rideId}\n✅ Your ride has been successfully booked and added to the calendar!`;
          
          await this.storeConversation(phone, message, successMessage, { 
            conversationType: "auto_driver_assignment_success",
            assignedDriver: assignedDriver.driverPhone,
            rideId: bookingResult.rideId,
            driverDistance: assignedDriver.distance.toString(),
            driverRating: assignedDriver.rating.toString(),
            bookingStatus: "confirmed"
          });
          
          return successMessage;
        } else {
          // Handle booking failure
          console.log(`❌ Auto-assignment failed: ${bookingResult.message}`);
          
          // The rideService already sent the rejection message to the user
          // We don't need to send another message - just store the conversation
          await this.storeConversation(phone, message, `Auto-assignment handled by ride service`, { 
            conversationType: "auto_assignment_handled_by_ride_service",
            assignedDriver: assignedDriver.driverPhone,
            bookingStatus: "rejected",
            failureReason: bookingResult.rejectionReason || bookingResult.message
          });
          
          // Return special response indicating message was already handled
          return "__MESSAGE_ALREADY_HANDLED__";
        }
      } else {
        console.log(`⚠️ No available drivers found for pickup: ${bookingData.from}`);
        
        const noDriversMessage = `⚠️ *No Drivers Available*\n\nI couldn't find any available drivers for your location at ${bookingData.dateTime}.\n\nPlease either:\n• Try a different time\n• Provide a specific driver's phone number\n• Contact our support for assistance\n\nWhat would you like to do?`;
        
        await this.storeConversation(phone, message, noDriversMessage, { 
          conversationType: "no_drivers_available",
          bookingStatus: "incomplete",
          failureReason: "no_available_drivers"
        });
        
        return noDriversMessage;
      }
    }
  }

  async handleDriverConfirmation(phone, message, conversationHistory, bookingData) {
    console.log(`🐛 DEBUG: User is confirming driver, checking for recent suggestions`);
    
    const recentMessages = conversationHistory.slice(-3);
    let suggestedDriver = null;
    
    for (const msg of recentMessages) {
      if (msg.metadata && msg.metadata.conversationType === 'driver_suggestion') {
        suggestedDriver = msg.metadata.suggestedDriver;
        console.log(`🐛 DEBUG: Found suggested driver in history: ${suggestedDriver}`);
        break;
      }
    }
    
    if (suggestedDriver) {
      console.log(`✅ User confirmed suggested driver: ${suggestedDriver}`);
      
      // Actually book the ride
      const { bookRideInternal } = require('../rideService');
      const bookingResult = await bookRideInternal({
        driverPhone: suggestedDriver,
        riderPhone: phone,
        from: bookingData.from,
        to: bookingData.to,
        time: bookingData.dateTime,
        estimatedDuration: Math.round(30) // Default duration
      });
      
      if (bookingResult.success) {
        const successMessage = `✅ *Booking Confirmed!*\n\n📍 *Pickup:* ${bookingData.from}\n🎯 *Destination:* ${bookingData.to}\n⏰ *Time:* ${bookingData.dateTime}\n📱 *Driver:* ${suggestedDriver}\n\n🎉 *Ride ID:* ${bookingResult.rideId}\n✅ Your ride has been successfully booked and added to the calendar!`;
        
        await this.storeConversation(phone, message, successMessage, { 
          conversationType: "booking_confirmation_success",
          confirmedDriver: suggestedDriver,
          rideId: bookingResult.rideId,
          bookingStatus: "confirmed"
        });
        
        return successMessage;
      } else {
        // Handle booking failure
        console.log(`❌ Booking failed: ${bookingResult.message}`);
        
        // The rideService already sent the rejection message to the user
        // We don't need to send another message - just store the conversation
        await this.storeConversation(phone, message, `Booking handled by ride service`, { 
          conversationType: "booking_confirmation_handled_by_ride_service",
          confirmedDriver: suggestedDriver,
          bookingStatus: "rejected",
          failureReason: bookingResult.rejectionReason || bookingResult.message
        });
        
        // Return special response indicating message was already handled
        return "__MESSAGE_ALREADY_HANDLED__";
      }
    }
    
    return null; // Continue with normal flow
  }

  async generateNormalAIResponse(phone, message, conversationHistory, bookingData) {
    const userContext = await this.getUserBookingContext(phone);
    
    // **CONTEXT RESTORATION: Get stored context to prevent context loss**
    let storedContextPrompt = "";
    try {
      const Conversation = require("../../models/Conversation");
      const conversation = await Conversation.findOne({ phone });
      if (conversation && conversation.lastValidContext) {
        const ctx = conversation.lastValidContext;
        storedContextPrompt = `\n\n**PRESERVED CONTEXT (Use this information to maintain continuity):**
Last valid booking data extracted: ${JSON.stringify(ctx.bookingData, null, 2)}
Context timestamp: ${ctx.timestamp}
Context source: ${ctx.source}

Use this context to maintain conversation continuity and avoid asking for information that was already provided.`;
        console.log(`🧠 Including stored context for ${phone}`);
      }
    } catch (contextError) {
      console.error("Failed to retrieve stored context:", contextError);
    }
    
    const systemPrompt = this.buildSystemPrompt(bookingData, userContext, "", false) + storedContextPrompt;

    const formattedHistory = conversationHistory.slice(-6).map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
    
    console.log(`🤖 DEBUG: Formatted conversation history for OpenAI:`, formattedHistory);
    
    const messages = [
      { role: "system", content: systemPrompt },
      ...formattedHistory,
      { role: "user", content: message }
    ];
    
    console.log(`🤖 DEBUG: Sending to OpenAI:`, {
      model: config.openai.model || "gpt-4o",
      messagesCount: messages.length,
      lastSystemPrompt: systemPrompt.substring(0, 200) + "...",
      lastUserMessage: message
    });

    const openai = this.vectorOps.getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: config.openai.model || "gpt-4o",
      messages: messages,
      max_tokens: 350,
      temperature: 0.6,
    });

    const aiResponse = response.choices[0].message.content;
    console.log(`🐛 DEBUG: OpenAI response: ${aiResponse}`);

    // Store conversation and track preferences
    await this.storeConversation(phone, message, aiResponse, { 
      conversationType: "ai_generated",
      bookingStatus: bookingData.bookingStatus
    });

    // Track booking completion and update preferences
    if (bookingData.bookingStatus === 'complete' || aiResponse.toLowerCase().includes('booking summary')) {
      await this.trackBookingCompletion(phone, conversationHistory);
    }

    return aiResponse;
  }
}

// Create singleton instance
const vectorDBService = new VectorDBService();

module.exports = vectorDBService; 