
const axios = require("axios");
require("dotenv").config();
const mongoose = require("mongoose");
const Ride = require("../../../models/Ride");

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "AIzaSyDWetIXYi2QN6RYZvgcggrNlyvv5X6AM2I";

async function validateLocationWithGoogle(location, isFromWhatsApp = false) {
  if (!location || location.length < 3) {
    return { isValid: false, reason: "Location too short" };
  }

  // Skip Google validation if location comes from WhatsApp
  if (isFromWhatsApp) {
    console.log(`⏭️ Skipping Google validation for WhatsApp location: "${location}"`);
    return {
      isValid: true,
      formattedAddress: location,
      coordinates: null,
      placeId: null,
      types: [],
      source: 'whatsapp'
    };
  }

  try {
    console.log(`🔍 Validating location with Google: "${location}"`);
    
    const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
      params: {
        address: location,
        key: GOOGLE_API_KEY,
        region: 'PK', // Bias to Pakistan
        language: 'en'
      }
    });

    const results = response.data.results;

    if (results.length === 0) {
      return { 
        isValid: false, 
        reason: `Location "${location}" not found on Google Maps` 
      };
    }

    const primaryResult = results[0];
    
    const tooBroadTypes = [
      "locality",               
      "political",          
      "country",            
      "administrative_area_level_1", 
      "administrative_area_level_2", 
      "sublocality",        
      "sublocality_level_1" 
    ];
    
    const isTooBroad = tooBroadTypes.some(type => primaryResult.types.includes(type));
    
    if (isTooBroad) {
      return { 
        isValid: false, 
        reason: `"${location}" is too broad. Please provide a more specific location.`,
        suggestion: "Include area, landmark, street details, or business name"
      };
    }

    console.log(`✅ Location validated: ${location} → ${primaryResult.formatted_address}`);
    
    return {
      isValid: true,
      formattedAddress: primaryResult.formatted_address,
      coordinates: {
        lat: primaryResult.geometry.location.lat,
        lng: primaryResult.geometry.location.lng
      },
      placeId: primaryResult.place_id,
      types: primaryResult.types
    };

  } catch (error) {
    console.error(`❌ Google validation error for "${location}":`, error.message);
    return { 
      isValid: false, 
      reason: "Could not validate location due to API error",
      error: error.message
    };
  }
}

class BookingExtractor {
  constructor(vectorOperations) {
    this.vectorOperations = vectorOperations;
  }

  async extractBookingData(phone, conversationHistory) {
    try {
      const historyText = conversationHistory
        .slice(-20)
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      
      const now = new Date();
      const currentDate = now.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
      
      const extractionPrompt = this.buildExtractionPrompt(currentDate, currentTime, historyText);

      const openai = this.vectorOperations.getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: extractionPrompt }],
        max_tokens: 400,
        temperature: 0.1
      });

      try {
        let jsonStr = response.choices[0].message.content.trim();
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        
        const result = JSON.parse(jsonStr);
        
        console.log(`✅ AI extracted booking data:`, result);
        console.log(`📝 User response type: ${result.responseType}`);
        console.log(`🔍 Needs clarification: ${result.needsClarification}`);
        console.log(`💬 Last response: "${result.lastResponse}"`);
        
        // Handle ride detail requests
        if (result.responseType === 'ride_details_request') {
          const rideDetails = await this.fetchRideDetails(phone, result.isFutureRide);
          if (rideDetails) {
            return {
              from: rideDetails.from,
              to: rideDetails.to,
              dateTime: rideDetails.requestedTime.toISOString().slice(0, 16).replace('T', ' '),
              driverPhone: rideDetails.driverPhone,
              bookingStatus: rideDetails.status,
              responseType: 'ride_details',
              needsClarification: false,
              clarificationMessage: null,
              inputQuality: 'valid',
              acceptedAsLocation: null,
              isPostBookingInteraction: true,
              isFutureRide: result.isFutureRide,
              rideDetails: {
                status: rideDetails.status,
                distance: rideDetails.distance,
                estimatedDuration: rideDetails.estimatedDuration,
                rideId: rideDetails.rideId
              }
            };
          } else {
            const message = result.isFutureRide 
              ? "I couldn't find any upcoming rides. Would you like to book a new ride?"
              : "I couldn't find any past rides. Would you like to book a ride?";

            return {
              from: null,
              to: null,
              dateTime: null,
              driverPhone: null,
              bookingStatus: 'incomplete',
              responseType: 'ride_details',
              needsClarification: true,
              clarificationMessage: message,
              inputQuality: 'valid',
              acceptedAsLocation: null,
              isPostBookingInteraction: false,
              isFutureRide: result.isFutureRide
            };
          }
        }

        // Handle post-booking gratitude
        if (result.responseType === 'post_booking_gratitude' && result.bookingStatus === 'confirmed') {
          console.log(`🎉 Post-booking gratitude detected, clearing conversation for ${phone}`);
          const { clearConversationHistory } = require('../../conversation/conversationCore');
          await clearConversationHistory(phone);
          
          const normalizedData = this.normalizeBookingData({
            from: null,
            to: null,
            dateTime: null,
            driverPhone: null,
            bookingStatus: 'incomplete',
            responseType: 'post_booking_gratitude',
            needsClarification: false,
            clarificationMessage: null,
            inputQuality: 'valid',
            acceptedAsLocation: null,
            isPostBookingInteraction: true
          });
          return normalizedData;
        }
        
        if ((result.responseType === 'location_name' || result.responseType === 'other') && 
            result.bookingStatus !== 'confirmed') {
          result.driverPhone = null;
        }
        
        const normalizedData = this.normalizeBookingData(result);
        return normalizedData;
      } catch (parseError) {
        console.error("Failed to parse booking extraction:", parseError);
        return this.getEmptyBookingData();
      }

    } catch (error) {
      console.error("❌ Failed to extract booking data:", error.message);
      return this.getEmptyBookingData();
    }
  }

  buildExtractionPrompt(currentDate, currentTime, historyText) {
    return `Analyze this conversation and extract ride booking information. Also validate if the user's input needs clarification. Return ONLY valid JSON.
CURRENT TIME: ${currentDate} at ${currentTime}
CRITICAL CONTEXT PRESERVATION RULES:
**IMPORTANT: When extracting data, PRESERVE existing booking information that was previously mentioned in the conversation unless the user is explicitly updating that specific field.**
For example:
- If conversation shows previous pickup location and user only mentions new destination "tech park", preserve pickup
- If conversation shows previous time "2pm today" and user only mentions new pickup location, preserve "2pm today" as time
- Only set fields to null if they were never mentioned in the conversation history

**POST-BOOKING RESPONSE HANDLING:**
When a ride has been successfully booked (bookingStatus: "confirmed"), and user responds with:
- Thank you messages: "thank you", "thanks", "ty", "thx", "appreciate it", "great", "perfect", "awesome"
- Positive acknowledgments: "ok", "okay", "good", "nice", "cool", "sounds good"
- Gratitude expressions: "much appreciated", "thanks a lot", "thank you so much"
Set responseType: "post_booking_gratitude" and needsClarification: false

CRITICAL DRIVER EXTRACTION RULES:
1. **ONLY extract driverPhone if user EXPLICITLY confirmed with clear YES words**
2. **NEVER extract driverPhone from location names, place names, or ambiguous responses**
3. **Clear YES confirmations:** "yes", "okay", "ok", "sure", "proceed", "confirm", "go ahead"
4. **NOT confirmations:** Any location name, place name, area name, or unclear response

VALIDATION RULES:
1. If input is a clear confirmation (yes, okay, sure, etc.) → NO clarification needed
2. If input is a greeting (hi, hello, hey) → NO clarification needed
3. If input is vague or unclear for booking purposes → NEEDS clarification
4. If input is too short or nonsensical → NEEDS clarification
5. If input contains abusive language or gibberish → NEEDS clarification
6. **LOCATION SPECIFICITY REQUIREMENTS:**
   - Only accept the locations that are in the same city as the user's current location
   - Locations must be MORE SPECIFIC than just city names
   - REJECT broad city-only locations
   - REQUIRE specific areas within cities: neighborhoods, landmarks, markets, malls, hospitals, etc.
   - If the location is about eateries/shops/businesses/etc
        - Must include city
        - Must include town/area/branch
        - Must include landmark/neighborhood/etc
   - If user provides only city name → NEEDS clarification with message whether you are asking pickup or destination: "Please provide a more specific location within [city name], such as an area, landmark, or neighborhood."
7. If input is a valid specific location, time, or phone number → NO clarification needed

**CRITICAL DATE/TIME VALIDATION RULES:**
8. **ONLY accept future dates and times** - for explicitly past dates, reject. For same-day past times, interpret as next day
9. **Current time is: ${currentDate} at ${currentTime}**
10. **For same-day bookings**: Compare the specified time with current time - if it's later today, ACCEPT it. If earlier today, **INTERPRET AS TOMORROW**
11. **If user provides explicitly past date/time** (like "yesterday", "last week") → NEEDS clarification with message: "I can only book rides for future dates. Please provide a time that's later than today."
12. **If user provides ambiguous time** like "yesterday", "last week", "earlier" → NEEDS clarification
13. **Accept reasonable future times** within 3 months from today
14. **If user provides date/time more than 3 months away** → NEEDS clarification with message: "I can book rides up to 3 months in advance. Please choose a date within the next 3 months."

**SAME-DAY TIME VALIDATION LOGIC:**
- Current date: ${currentDate}
- Current time: ${currentTime}
- If user says a time for TODAY that is AFTER current time → VALID (needsClarification: false)
- If user says a time for TODAY that is BEFORE current time → **INTERPRET AS TOMORROW** (needsClarification: false)
- Examples for ${currentDate}:
  * If current time is 1:00 PM and user says "3pm today" → VALID ✅
  * If current time is 1:00 PM and user says "11am today" → **INTERPRET AS TOMORROW 11am** ✅
  * If current time is 1:00 PM and user says "28 July 9pm" → VALID ✅ (same date, future time)
  * If current time is 1:00 PM and user says "28 July 9am" → **INTERPRET AS 29 July 9am** ✅

VAGUE INPUTS THAT NEED CLARIFICATION:
- "i don't know", "dunno", "no idea", "not sure"
- "anytime", "whenever", "doesn't matter", "dont care"
- "xxxx", "xxx", "idk", "whatever", "up to you"
- "work", "home", "my home", "my work", "office" (without context)
- "here", "there", "this place", "that place"
- "somewhere", "anywhere", "nowhere", "nothing"
- **BROAD CITY-ONLY LOCATIONS:** "lahore", "lahore pakistan", "karachi", "islamabad", "rawalpindi"
- Very short responses (less than 3 characters)
- Repetitive characters or obvious gibberish

EXAMPLE SCENARIOS:
- Assistant suggests driver "03019581634"
- User says "yes" → Extract: driverPhone: "03019581634", needsClarification: false
- User says "iqbal town" → Extract: driverPhone: null, needsClarification: false (valid location)
- User says "lahore pakistan" → Extract: driverPhone: null, needsClarification: true, clarificationMessage: "Please provide a more specific location within lahore pakistan, such as an area, landmark, or neighborhood."
- User says "emporium mall lahore" → Extract: driverPhone: null, needsClarification: false (valid specific location)
- User says "dunno" → Extract: driverPhone: null, needsClarification: true
- User says "03001234567" → Extract: driverPhone: "03001234567", needsClarification: false
- User says "auto assign" → Extract: driverPhone: null, responseType: "auto_assign_request", needsClarification: false
- User says "automatic" → Extract: driverPhone: null, responseType: "auto_assign_request", needsClarification: false
- **IMPORTANT**: User says "auto assign" with existing booking data → Extract: from: "iqbal town", to: "johar town", dateTime: "2025-07-29 15:00", driverPhone: null, responseType: "auto_assign_request", needsClarification: false
- **COMPLETE BOOKING EXAMPLE**: User says "I want to be picked up from Plot 598, Nargis Block, iqbal town, Lahore to Khayaban-e-Firdousi, Block R3 Block R 2 Phase 2 Johar Town, Lahore, Pakistan on 1st august 9am with this driver 03090944891" → Extract: from: "Plot 598, Nargis Block, iqbal town, Lahore", to: "Khayaban-e-Firdousi, Block R3 Block R 2 Phase 2 Johar Town, Lahore, Pakistan", dateTime: "2025-08-01 09:00", driverPhone: "03090944891", bookingStatus: "confirmed", responseType: "location_name", needsClarification: false
- **POST-BOOKING GRATITUDE EXAMPLE**: Previous booking confirmed, user says "thank you" → Extract: preserve all booking data, responseType: "post_booking_gratitude", needsClarification: false

**DATE/TIME VALIDATION EXAMPLES:**
- User says "tomorrow 3pm" → Extract: needsClarification: false (future time ✅)
- User says "yesterday 5pm" → Extract: needsClarification: true, clarificationMessage: "I can only book rides for future dates..."
- User says "July 15, 2024 2pm" → Extract: needsClarification: true (past date ❌ - 2024 is in the past)
- User says "December 2026" → Extract: needsClarification: true, clarificationMessage: "I can book rides up to 3 months in advance..."
- User says "next week Tuesday 10am" → Extract: needsClarification: false (reasonable future time ✅)
- User says "today 3pm" (when current time is 1pm) → Extract: needsClarification: false (same day future time ✅)
- User says "29 july 9pm" (when current time is 28 July 2025 1pm) → Extract: needsClarification: false (same day future time ✅)
- User says "29 july 9am" (when current time is 29 July 2025 1pm) → **INTERPRET AS 30 July 9am** (needsClarification: false ✅)

**CRITICAL: Same-day time validation:**
- If user specifies today's date with a future time → ACCEPT (needsClarification: false)
- If user specifies today's date with a past time → **ASSUME NEXT DAY** (needsClarification: false)
- **USER-FRIENDLY TIME INTERPRETATION:** When users say a time that's already passed today, assume they mean tomorrow
- If user just says a time without date (e.g., "3pm") → assume today if future, tomorrow if past
- If user specifies a date without year, assume current year if future, next year if past
- **Examples for same-day past times:**
  * Current time: July 29, 2025 10:00 AM, user says "29 July, 2am" → Interpret as "30 July, 2am" ✅
  * Current time: July 29, 2025 10:00 AM, user says "2am" → Interpret as "30 July, 2am" ✅
  * Current time: July 29, 2025 10:00 AM, user says "2pm today" → Keep as "29 July, 2pm" ✅

CONVERSATION ANALYSIS:
${historyText}

**CRITICAL: REJECTION RESPONSES MUST PRESERVE ALL BOOKING DATA**
If user's response is a rejection (no, nahi, reject, different driver, etc.), you MUST:
- Preserve pickup location from conversation history
- Preserve destination from conversation history
- Preserve time from conversation history
- Do NOT clear any other fields just because user rejected a driver

ANALYZE STEP BY STEP:
1. What pickup location is mentioned in the ENTIRE conversation history? (preserve if not being updated)
2. What destination is mentioned in the ENTIRE conversation history? (preserve if not being updated)
3. What time was mentioned in the ENTIRE conversation history? (preserve if not being updated)
4. Did assistant suggest a driver? If yes, what was user's response?
5. Is user's response a clear YES confirmation or something else?
6. Does the user's input need clarification?
7. Is the user updating a specific field or providing new information?
8. **Is this a post-booking gratitude response?** (ride already confirmed and user saying thank you)

CONTEXT PRESERVATION LOGIC:
- Extract the COMPLETE booking information from the entire conversation history
- If user is updating destination only, preserve existing pickup and time
- If user is updating pickup only, preserve existing destination and time
- If user is updating time only, preserve existing pickup and destination
- **If user is rejecting a driver (no, nahi, reject), preserve ALL booking data except set driverPhone to null**
- **If user is responding to driver preference questions (auto assign, driver phone), preserve ALL booking data**
- **If user is expressing gratitude after confirmed booking, preserve ALL booking data**
- Only set fields to null if they were NEVER mentioned in the conversation

DRIVER EXTRACTION LOGIC:
- If assistant suggested driver AND user responded with clear YES → extract that driver
- If assistant suggested driver AND user responded with anything else → extract null
- If user provided new phone number directly → extract that new number
- **If user requested auto assignment (auto assign, automatic) → extract null (system will handle auto-assignment)**
- Otherwise → extract null

**BOOKING STATUS LOGIC:**
- Set bookingStatus to "confirmed" when ALL of these conditions are met:
  * User provides pickup location (from)
  * User provides destination (to) 
  * User provides date/time
  * User provides driver phone number OR auto-assignment is confirmed
  * All in the same message or conversation context
- Set bookingStatus to "awaiting_confirmation" when:
  * All booking data is complete but waiting for user confirmation
  * Driver has been suggested and waiting for yes/no response
- Set bookingStatus to "incomplete" when:
  * Any required booking information is missing
  * User is still in the process of providing booking details

**RIDE BOOKING COMPLETION DETECTION:**
A ride is considered FULLY BOOKED when:
1. bookingStatus is "confirmed" 
2. All required fields are present: from, to, dateTime, driverPhone (or auto-assignment confirmed)
3. User has confirmed the booking details

**POST-BOOKING INTERACTION HANDLING:**
After a ride is fully booked and confirmed:
- If user says thank you/thanks/gratitude → responseType: "post_booking_gratitude"
- If user asks questions about the booked ride → responseType: "post_booking_inquiry"
- If user wants to modify the booking → treat as new booking request
- If user wants to cancel → responseType: "cancellation_request"

**COMPLETE BOOKING DETECTION:**
- If bookingStatus is "confirmed" and user says thank you, or any other positive words, maintain bookingStatus: "confirmed"
- If user's message contains pickup location + destination + time + driver phone in one go, set bookingStatus: "confirmed"
- Example: "I need a ride from A to B at 3pm with driver 03001234567" → bookingStatus: "confirmed"

**LOCATION ACCEPTANCE VALIDATION:**
- If user input is accepted as a valid pickup location → set acceptedAsLocation: "pickup"
- If user input is accepted as a valid destination location → set acceptedAsLocation: "destination"  
- If user input is not a location or not accepted as valid → set acceptedAsLocation: null
- Examples:
  * User says "iqbal town" and it's accepted as pickup → acceptedAsLocation: "pickup"
  * User says "emporium mall" and it's accepted as destination → acceptedAsLocation: "destination"
  * User says "yes" (confirmation) → acceptedAsLocation: null
  * User says "lahore" (too broad, needs clarification) → acceptedAsLocation: null

**RESPONSE TYPE CLASSIFICATION:**
- Use "time" when user provides time/date information (e.g., "3pm", "tomorrow", "next week Tuesday", "July 30 at 2pm")
- Use "location_name" when user provides location information
- Use "confirmation" when user clearly confirms with yes/okay/sure
- Use "rejection" when user rejects or says no
- Use "phone_number" when user provides a phone number
- Use "auto_assign_request" when user requests automatic driver assignment (e.g., "auto assign", "automatic", "auto-assign")
- Use "greeting" for greetings like hi/hello
- Use "vague" for unclear responses that need clarification
- Use "invalid" for inappropriate or nonsensical input
- **Use "post_booking_gratitude" when user expresses thanks/gratitude after confirmed booking**
- **Use "post_booking_inquiry" when user asks questions about already confirmed booking**
- **Use "cancellation_request" when user wants to cancel confirmed booking**
- Use "ride_details_request" when user asks about their ride details, and set isFutureRide:
  * Future ride examples (isFutureRide: true):
    - "When is my next ride?"
    - "Show me my upcoming ride"
    - "What's my future ride?"
    - "Do I have any rides booked?"
    - "What time is my ride?"
  * Past ride examples (isFutureRide: false):
    - "What was my last ride?"
    - "Show me my previous ride"
    - "Details of my past ride"
    - "My recent ride"

Return JSON with dateTime in EXACT format "YYYY-MM-DD HH:mm":
{
  "from": "specific pickup location from conversation history or null if never mentioned",
  "to": "specific destination from conversation history or null if never mentioned",
  "dateTime": "YYYY-MM-DD HH:mm format from conversation history or null if never mentioned",
  "driverPhone": "phone number ONLY if clearly confirmed, otherwise null",
  "bookingStatus": "incomplete|awaiting_confirmation|confirmed",
  "lastResponse": "what user just said",
  "responseType": "location_name|confirmation|rejection|phone_number|greeting|vague|invalid|time|auto_assign_request|post_booking_gratitude|post_booking_inquiry|cancellation_request|ride_details_request",
  "needsClarification": true/false,
  "clarificationMessage": "helpful message asking for clarification (only if needsClarification is true)",
  "inputQuality": "valid|vague|invalid",
  "acceptedAsLocation": "pickup|destination|null",
  "isPostBookingInteraction": true/false,
  "isFutureRide": true/false
}`;
  }

  normalizeBookingData(result) {
    return {
      from: typeof result.from === 'string' ? result.from : null,
      to: typeof result.to === 'string' ? result.to : null,
      dateTime: typeof result.dateTime === 'string' ? result.dateTime : null,
      driverPhone: typeof result.driverPhone === 'string' ? result.driverPhone : null,
      bookingStatus: result.bookingStatus || 'incomplete',
      responseType: result.responseType || 'other',
      needsClarification: result.needsClarification || false,
      clarificationMessage: result.clarificationMessage || null,
      inputQuality: result.inputQuality || 'valid',
      acceptedAsLocation: result.acceptedAsLocation || null,
      isPostBookingInteraction: result.isPostBookingInteraction || false
    };
  }

  getEmptyBookingData() {
    return { 
      from: null, 
      to: null, 
      dateTime: null, 
      driverPhone: null, 
      bookingStatus: 'incomplete',
      needsClarification: false,
      clarificationMessage: null,
      inputQuality: 'valid',
      acceptedAsLocation: null
    };
  }

  shouldValidateLocationWithGoogle(message, bookingData, isFromWhatsApp = false) {
    const cleanMessage = message.toLowerCase().trim();
    console.log(`🐛 DEBUG: shouldValidateLocationWithGoogle:`, cleanMessage);
    
    // Skip validation if location comes from WhatsApp
    if (isFromWhatsApp) {
      console.log(`⏭️ Skipping location validation for WhatsApp message`);
      return { shouldValidate: false, reason: 'whatsapp_source' };
    }

    if (cleanMessage.includes(' to ') || cleanMessage.includes(' from ')) {
      const fromMatch = cleanMessage.match(/from\s+(.+?)(?:\s+to\s+|$)/i);
      const toMatch = cleanMessage.match(/to\s+(.+?)$/i);
      
      if (fromMatch && toMatch) {
        const fromLocation = fromMatch[1].trim();
        const toLocation = toMatch[1].trim();
        
        if (!bookingData.from && fromLocation) {
          return { 
            shouldValidate: true, 
            locationType: 'pickup',
            locationToValidate: fromLocation
          };
        }
        
        if (!bookingData.to && toLocation) {
          return { 
            shouldValidate: true, 
            locationType: 'destination',
            locationToValidate: toLocation
          };
        }
        
        if (bookingData.from && bookingData.to) {
          return { 
            shouldValidate: true, 
            locationType: 'destination',
            locationToValidate: bookingData.to
          };
        }
        
        return { shouldValidate: false };
      }

    }
    
    if (!bookingData.from || !bookingData.to) {
      const locationType = !bookingData.from ? 'pickup' : 'destination';
      return { 
        shouldValidate: true, 
        locationType: locationType,
        locationToValidate: message
      };
    }
    
    return { shouldValidate: false };
  }

  async validateLocationDirectly(location, isFromWhatsApp = false) {
    return await validateLocationWithGoogle(location, isFromWhatsApp);
  }

  isAskingForRideDetails(text) {
    const rideDetailPatterns = [
      /last ride/i,
      /previous ride/i,
      /ride details/i,
      /ride status/i,
      /my ride/i,
      /upcoming ride/i,
      /booked ride/i,
      /ride info/i,
      /show me my ride/i,
      /what.*my ride/i,
      /where.*my ride/i,
      /when.*my ride/i
    ];
    return rideDetailPatterns.some(pattern => pattern.test(text));
  }

  async fetchRideDetails(phone, isFutureRide = true) {
    try {
      const query = {
        riderPhone: phone,
        requestedTime: isFutureRide ? { $gte: new Date() } : { $lt: new Date() },
        status: isFutureRide ? ["auto_accepted"] : ["auto_accepted", "completed"]
      };

      const ride = await Ride.findOne(query)
        .sort({ requestedTime: isFutureRide ? 1 : -1 });

      return ride;
    } catch (error) {
      console.error("Error fetching ride details:", error);
      return null;
    }
  }
}

module.exports = BookingExtractor;

