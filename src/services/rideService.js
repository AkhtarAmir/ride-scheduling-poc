const Ride = require('../models/Ride');
const User = require('../models/User');
const Driver = require('../models/driver');
const { checkCalendarConflicts, createCalendarEvent } = require('./calendarService');
const { calculateDistance } = require('./mapsService');
const { sendNotification } = require('./notificationService');
const vectorDBService = require('./vectorDBService');
const moment = require('moment');

async function findNearestAvailableDrivers(pickupLocation, requestedTime, maxResults = 5) {
  try {
    console.log(`🔍 Finding nearest drivers for pickup: ${pickupLocation}`);
    
    // Get all drivers (removed isActive filter)
    const allDrivers = await Driver.find({}).sort({ rating: -1, totalRides: -1 });
    
    console.log(`🔍 Found ${allDrivers.length} total drivers in database`);
    
    if (allDrivers.length === 0) {
      console.log('⚠️ No drivers found in database');
      return [];
    }
    
    const driverDistances = [];
    
    // Calculate distance for each driver
    for (const driver of allDrivers) {
      try {
        // Get driver's current location
        const driverLocation = await getDriverLastLocation(driver.phone);
        
        if (!driverLocation) {
          console.log(`⚠️ No location found for driver ${driver.phone}, skipping`);
          continue;
        }
        
        // Calculate distance from driver to pickup location
        const distanceResult = await calculateDistance(driverLocation.address, pickupLocation);
    
        
        // Check if driver is within
        const MAX_DISTANCE_KM = process.env.MAX_DRIVER_DISTANCE_KM || 20;   // Temporarily increased from 10 to 20
        const MAX_DURATION_MIN = process.env.MAX_DRIVER_DURATION_MIN || 30;  // Changed from 60 to 30
        
        console.log(`🔍 Checking driver ${driver.phone} at ${driverLocation.address} - distance: ${distanceResult.distance}km, duration: ${distanceResult.duration}min`);
        
        if (distanceResult.distance <= MAX_DISTANCE_KM && distanceResult.duration <= MAX_DURATION_MIN) {
          // Check calendar availability if requested
          let isAvailable = true;
          if (requestedTime && driver.calendarIntegration?.enabled) {
            try {
              const conflicts = await checkCalendarConflicts(
                driver.phone, 
                null, // rider phone not needed for driver check
                new Date(requestedTime), 
                60 // assume 1 hour duration
              );
              // Check the main hasConflict property, not hasDriverConflict
              isAvailable = !conflicts.hasConflict;
              
              if (conflicts.hasConflict) {
                console.log(`⏰ Driver ${driver.phone} has conflict at ${requestedTime}: ${conflicts.rejectionReason || 'Schedule conflict'}`);
              }
            } catch (error) {
              console.error(`❌ Calendar check failed for driver ${driver.phone}: ${error.message}`);
              // Be conservative: assume NOT available if calendar check fails to prevent double booking
              isAvailable = false;
              console.log(`🚫 Driver ${driver.phone} marked as unavailable due to calendar check failure`);
            }
          } else if (requestedTime) {
            // If calendar integration is disabled but we have a requested time, 
            // we should still check against any existing bookings in the database
            try {
              const existingBookings = await require('../models/Ride').find({
                driverPhone: driver.phone,
                status: { $in: ['auto_accepted', 'confirmed', 'in_progress'] },
                requestedTime: {
                  $gte: new Date(new Date(requestedTime).getTime() - 30 * 60 * 1000), // 30 min before
                  $lte: new Date(new Date(requestedTime).getTime() + 90 * 60 * 1000)  // 90 min after
                }
              });
              
              if (existingBookings.length > 0) {
                isAvailable = false;
                console.log(`🚫 Driver ${driver.phone} has ${existingBookings.length} existing booking(s) around ${requestedTime}`);
              }
            } catch (dbError) {
              console.error(`❌ Database check failed for driver ${driver.phone}:`, dbError.message);
              // Be conservative: assume NOT available if database check fails
              isAvailable = false;
            }
          }
          
          if (isAvailable) {
            driverDistances.push({
              driverPhone: driver.phone,
              name: driver.name,
              rating: driver.rating,
              totalRides: driver.totalRides,
              vehicleDetails: driver.vehicleDetails,
              distance: distanceResult.distance,
              duration: distanceResult.duration,
              currentLocation: driverLocation.address,
              // Calculate a score based on distance, rating, and experience
              score: calculateDriverScore(distanceResult.distance, driver.rating, driver.totalRides)
            });
          } else {
            console.log(`⏰ Driver ${driver.phone} is not available at ${requestedTime}`);
          }
        } else {
          console.log(`📏 Driver ${driver.phone} is too far: ${distanceResult.distance}km (max: ${MAX_DISTANCE_KM}km)`);
        }
      } catch (error) {
        console.error(`❌ Error processing driver ${driver.phone}:`, error.message);
        continue;
      }
    }
    
    // Sort by score (best drivers first) and return top results
    const sortedDrivers = driverDistances
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
    
    console.log(`✅ Found ${sortedDrivers.length} nearest drivers:`, 
      sortedDrivers.map(d => `${d.driverPhone} (${d.distance}km, rating: ${d.rating})`));
    
    return sortedDrivers;
    
  } catch (error) {
    console.error('❌ Error finding nearest drivers:', error.message);
    return [];
  }
}

function calculateDriverScore(distance, rating, totalRides) {
  // Normalize values
  const distanceScore = Math.max(0, (15 - distance) / 15); // Closer = better (max 15km)
  const ratingScore = rating / 5; // Rating out of 5
  const experienceScore = Math.min(totalRides / 100, 1); // Experience (capped at 100 rides = max score)
  
  // Weighted combination: distance (40%), rating (40%), experience (20%)
  return (distanceScore * 0.4) + (ratingScore * 0.4) + (experienceScore * 0.2);
}

async function getDriverLastLocation(driverPhone) {
  try {
    let driver = await Driver.findOne({ phone: driverPhone });
    
    if (driver && driver.currentLocation && driver.currentLocation.address) {
      console.log(`📍 Driver ${driverPhone} last location: ${driver.currentLocation.address}`);
      return {
        address: driver.currentLocation.address,
        coordinates: driver.currentLocation.coordinates,
        lastUpdated: driver.currentLocation.lastUpdated
      };
    }
    
    const lastRide = await Ride.findOne({ 
      driverPhone: driverPhone, 
      status: 'auto_accepted' 
    }).sort({ createdAt: -1 });
    
    if (lastRide) {
      console.log(`📍 Driver ${driverPhone} last ride destination: ${lastRide.to}`);
      return {
        address: lastRide.to,
        coordinates: null,
        lastUpdated: lastRide.createdAt
      };
    }
    
    console.log(`⚠️ No location history found for driver ${driverPhone}`);
    return null;
  } catch (error) {
    console.error(`❌ Error getting driver location for ${driverPhone}:`, error.message);
    return null;
  }
}


async function updateDriverLocation(driverPhone, newLocation) {
  try {
    const driver = await Driver.findOneAndUpdate(
      { phone: driverPhone },
      {
        phone: driverPhone,
        currentLocation: {
          address: newLocation,
          lastUpdated: new Date()
        }
      },
      { upsert: true, new: true }
    );
    
    console.log(`📍 Updated driver ${driverPhone} location to: ${newLocation}`);
    return driver;
  } catch (error) {
    console.error(`❌ Error updating driver location:`, error.message);
    return null;
  }
}

async function validateDriverPickupDistance(driverPhone, pickupLocation) {
  try {
    console.log(`🔍 Validating driver pickup distance for ${driverPhone}`);
    
    const lastLocation = await getDriverLastLocation(driverPhone);
    
    if (!lastLocation) {
      console.log(`✅ No previous location for driver ${driverPhone}, allowing pickup`);
      return { valid: true, reason: 'First ride for driver' };
    }
    
    let fromLocation = lastLocation.address;
    let toLocation = pickupLocation;
    
    console.log(`📍 Calculating distance from: "${fromLocation}" to: "${toLocation}"`);
    
    const { distance, duration } = await calculateDistance(fromLocation, toLocation);
    
    if (distance === null || duration === null) {
      console.log(`⚠️ Could not calculate distance - allowing ride with warning`);
      
      return { 
        valid: true, 
        reason: 'Distance calculation unavailable - ride allowed',
        distance: null,
        duration: null,
        warning: 'Could not verify driver distance'
      };
    }
    
    console.log(`📏 Distance from driver's last location (${fromLocation}) to pickup (${toLocation}): ${distance}km, ${duration} minutes`);
    
    const MAX_DISTANCE_KM = process.env.MAX_DRIVER_DISTANCE_KM || 20;   
    const MAX_DURATION_MIN = process.env.MAX_DRIVER_DURATION_MIN || 60;  
    
    if (distance > MAX_DISTANCE_KM) {
      console.log(`❌ Distance exceeds limit: ${distance}km > ${MAX_DISTANCE_KM}km`);
      return { 
        valid: false, 
        reason: `Driver is too far from pickup location (${distance.toFixed(1)}km away, max ${MAX_DISTANCE_KM}km)`,
        distance: distance,
        duration: duration
      };
    }
    
    if (duration > MAX_DURATION_MIN) {
      console.log(`❌ Duration exceeds limit: ${duration} minutes > ${MAX_DURATION_MIN} minutes`);
      return { 
        valid: false, 
        reason: `Driver is too far from pickup location (${duration.toFixed(1)} minutes away, max ${MAX_DURATION_MIN} minutes)`,
        distance: distance,
        duration: duration
      };
    }
    
    console.log(`✅ Driver pickup distance validation passed: ${distance.toFixed(1)}km, ${duration.toFixed(1)} minutes`);
    return { 
      valid: true, 
      reason: 'Driver is within acceptable distance',
      distance: distance,
      duration: duration
    };
    
  } catch (error) {
    console.error(`❌ Error validating driver pickup distance:`, error.message);
    return { 
      valid: true, 
      reason: 'Distance validation error - ride allowed',
      warning: 'Could not validate driver distance due to system error'
    };
  }
}


async function bookRideInternal(rideData) {
  try {
    const { driverPhone, riderPhone, from, to, time, estimatedDuration } = rideData;
    
    console.log(`🚗 Starting ride booking validation for driver ${driverPhone}`);
    
    const pickupValidation = await validateDriverPickupDistance(driverPhone, from);
    
    if (!pickupValidation.valid) {
      console.log(`❌ Driver pickup validation failed: ${pickupValidation.reason}`);
      
      // Create a proper ride record for tracking
      const ride = new Ride({
        driverPhone,
        riderPhone,
        from: from.trim(),
        to: to.trim(),
        requestedTime: moment(time).toDate(),
        status: "auto_rejected",
        rejectionReason: "driver_location",
        estimatedDuration,
        distance: null,
        conflictDetails: [],
        processedAt: new Date()
      });
      
      await ride.save();
      
      // Send notification to rider
      const rejectionMessage = `❌ *Ride Request Rejected*\n\n📍 *Pickup:* ${from}\n🎯 *Destination:* ${to}\n⏰ *Time:* ${moment(time).format('MMM DD, YYYY h:mm A')}\n\n*Reason:* ${pickupValidation.reason}\n\nPlease try a different driver or contact support.`;
      await sendNotification(riderPhone, rejectionMessage);
      
      // Return proper rejection response
      return {
        success: false,  
        rideId: ride.rideId,
        status: "auto_rejected",
        autoDecision: "REJECTED",
        message: rejectionMessage,
        requestedTime: ride.requestedTime,
        estimatedDuration: ride.estimatedDuration,
        calendarEventId: null,
        hasConflicts: false,
        rejectionReason: "driver_location",
        locationValidation: {
          valid: false,
          reason: pickupValidation.reason,
          distance: pickupValidation.distance,
          duration: pickupValidation.duration
        },
        conflicts: [],
        conflictResolution: null
      };
    }
    
    console.log(`✅ Driver pickup validation passed`);
    
    // Step 2: Calculate ride distance
    const { distance } = await calculateDistance(from, to);
    
    // Step 3: Check calendar conflicts
    const conflictResult = await checkCalendarConflicts(
      driverPhone, 
      riderPhone, 
      moment(time).toDate(), 
      estimatedDuration
    );
    
    // Step 4: Determine status based on conflicts
    let status = "auto_accepted";
    let conflictResolution = null;
    
    if (conflictResult.hasConflict && conflictResult.rejectionReason) {
      status = "auto_rejected";
      
      // Handle conflicts based on type
      if (conflictResult.rejectionReason === 'driver_conflict') {
        // For driver conflicts, ask for different driver
        conflictResolution = {
          type: 'driver_conflict',
          message: 'The requested driver is not available at this time.',
          alternativeDrivers: [],
          suggestion: 'Please provide a different driver\'s phone number.'
        };
      } else if (conflictResult.rejectionReason === 'rider_conflict') {
        // For rider conflicts, ask for different time
        conflictResolution = {
          type: 'rider_conflict',
          message: 'You have a conflicting appointment at this time.',
          suggestion: 'Please provide a different time for your ride.'
        };
      }
    }
    
    // Step 5: Create ride record
    const ride = new Ride({
      driverPhone,
      riderPhone,
      from: from.trim(),
      to: to.trim(),
      requestedTime: moment(time).toDate(),
      status,
      estimatedDuration,
      distance,
      conflictDetails: conflictResult.conflicts,
      conflictResolution: conflictResolution,
      processedAt: new Date()
    });
    
    if (conflictResult.hasConflict && conflictResult.rejectionReason) {
      ride.rejectionReason = conflictResult.rejectionReason;
    }
    
    await ride.save();
    
    // Step 6: Create calendar event if accepted
    let googleEventId = null;
    if (status === "auto_accepted") {
      try {
        googleEventId = await createCalendarEvent(ride);
        if (googleEventId) {
          ride.googleEventId = googleEventId;
          await ride.save();
          console.log(`✅ Calendar event created and linked to ride ${ride.rideId}`);
        } else {
          console.warn(`⚠️ Calendar event creation skipped for ride ${ride.rideId} (calendar not available)`);
        }
      } catch (calendarError) {
        console.error(`❌ Calendar creation failed for ride ${ride.rideId}:`, calendarError.message);
        // Don't fail the ride booking if calendar creation fails
      }
      
      // Step 7: Update driver location to destination after successful ride
      try {
        await updateDriverLocation(driverPhone, to);
        console.log(`📍 Updated driver ${driverPhone} location to destination: ${to}`);
      } catch (locationError) {
        console.error(`❌ Failed to update driver location:`, locationError.message);
        // Don't fail the ride booking if location update fails
      }
      
      // Step 8: Record driver preference for successful rides
      try {
        await vectorDBService.recordRide(riderPhone, driverPhone, from, to, true);
        console.log(`✅ Recorded driver preference for ${riderPhone} with driver ${driverPhone}`);
      } catch (preferenceError) {
        console.error(`❌ Failed to record driver preference:`, preferenceError.message);
        // Don't fail the ride booking if preference recording fails
      }
    }
    
    // Step 9: Update user records
    await User.findOneAndUpdate(
      { phone: riderPhone },
      { 
        phone: riderPhone,
        lastRideAt: status === "auto_accepted" ? new Date() : undefined,
        $inc: { totalRides: status === "auto_accepted" ? 1 : 0 }
      },
      { upsert: true }
    );
    
    // Step 10: Send automated notifications
    await sendAutomatedNotifications(ride, conflictResult, conflictResolution);
    
    // Step 11: Return final result
    const wasAccepted = status === "auto_accepted";
    return {
      success: wasAccepted,  // ✅ FIXED: success only true when ride is actually accepted
      rideId: ride.rideId,
      status: ride.status,
      autoDecision: status === "auto_accepted" ? "ACCEPTED" : "REJECTED",
      message: status === "auto_accepted" ? 
        "Ride automatically accepted and booked!" : 
        "Ride automatically rejected due to conflicts",
      requestedTime: ride.requestedTime,
      estimatedDuration: ride.estimatedDuration,
      calendarEventId: googleEventId,
      hasConflicts: conflictResult.hasConflict,
      rejectionReason: conflictResult.rejectionReason,
      conflictSummary: conflictResult.summary,
      conflicts: conflictResult.conflicts,
      conflictResolution: conflictResolution,
      locationValidation: pickupValidation.warning ? {
        warning: pickupValidation.warning
      } : undefined
    };
    
  } catch (error) {
    console.error("Internal booking error:", error);
    return {
      success: false,
      message: "System error during booking",
      error: error.message
    };
  }
}

function generateAlternativeTimes(originalTime) {
  const moment = require('moment');
  const original = moment(originalTime);
  const alternatives = [];
  
  // Generate times around the original time (±1 hour, ±2 hours, ±3 hours)
  const offsets = [-180, -120, -60, 60, 120, 180]; // in minutes
  
  offsets.forEach(offset => {
    const alternative = original.clone().add(offset, 'minutes');
    // Only include times that are in the future and reasonable hours (6 AM to 10 PM)
    const hour = alternative.hour();
    if (alternative.isAfter(moment()) && hour >= 6 && hour <= 22) {
      alternatives.push({
        time: alternative.format('YYYY-MM-DD HH:mm'),
        display: alternative.format('MMM DD, YYYY [at] h:mm A'),
        offset: offset
      });
    }
  });
  
  return alternatives.slice(0, 4); // Return top 4 alternatives
}

async function sendAutomatedNotifications(ride, conflictResult, conflictResolution) {
  try {
    const status = ride.status;
    const driverPhone = ride.driverPhone;
    const riderPhone = ride.riderPhone;
    
    if (status === "auto_accepted") {
      // Notify driver
      const driverMessage = `🚗 *New Ride Confirmed!*\n\n📍 *Pickup:* ${ride.from}\n🎯 *Destination:* ${ride.to}\n⏰ *Time:* ${moment(ride.requestedTime).format('MMM DD, YYYY h:mm A')}\n⏱️ *Duration:* ${ride.estimatedDuration} minutes\n📱 *Rider:* ${ride.riderPhone}\n\nRide ID: ${ride.rideId}`;
      await sendNotification(driverPhone, driverMessage);
      
      
    } else if (status === "auto_rejected") {
      // **FIXED: Enhanced rejection message with proper conflict resolution**
      let rejectionMessage = `❌ *Ride Request Rejected*\n\n📍 *Pickup:* ${ride.from}\n🎯 *Destination:* ${ride.to}\n⏰ *Time:* ${moment(ride.requestedTime).format('MMM DD, YYYY h:mm A')}\n\n`;
      
      // Handle different rejection reasons
      const rejectionReason = ride.rejectionReason || 'System error';
      
      if (rejectionReason === 'driver_conflict') {
        rejectionMessage += `*Reason:* Your driver has a conflicting appointment at this time.\n\n`;
        rejectionMessage += `*🔄 Resolution Options:*\n`;
        rejectionMessage += `1. Choose a different driver\n`;
        rejectionMessage += `2. Select a different time\n\n`;
        rejectionMessage += `Please reply with:\n`;
        rejectionMessage += `• A different driver's phone number, OR\n`;
        rejectionMessage += `• "different time" for alternative times`;
        
      } else if (rejectionReason === 'rider_conflict') {
        rejectionMessage += `*Reason:* You have a conflicting appointment at this time.\n\n`;
        rejectionMessage += `*🔄 Suggested Alternative Times:*\n`;
        rejectionMessage += `1. ${moment(ride.requestedTime).add(1, 'hour').format('MMM DD, YYYY [at] h:mm A')}\n`;
        rejectionMessage += `2. ${moment(ride.requestedTime).add(2, 'hours').format('MMM DD, YYYY [at] h:mm A')}\n`;
        rejectionMessage += `3. ${moment(ride.requestedTime).subtract(1, 'hour').format('MMM DD, YYYY [at] h:mm A')}\n\n`;
        rejectionMessage += `Reply with your preferred time or suggest a different time.`;
        
      } else if (rejectionReason === 'driver_location') {
        rejectionMessage += `*Reason:* Driver is too far from your pickup location (max 10km allowed).\n\n`;
        rejectionMessage += `*🔄 Resolution:*\n`;
        rejectionMessage += `Please try a different driver who is closer to your location.\n\n`;
        rejectionMessage += `Reply with a different driver's phone number.`;
        
      } else {
        rejectionMessage += `*Reason:* ${rejectionReason.replace('_', ' ')}\n\n`;
        rejectionMessage += `Please try again with different details.`;
      }
      
      rejectionMessage += `\n\nType 'restart' to book a new ride.`;
      
      await sendNotification(riderPhone, rejectionMessage);
    }
    
  } catch (error) {
    console.error("Failed to send automated notifications:", error);
    // Don't throw the error - just log it so the booking process can continue
  }
}


async function getRideStatus(rideId) {
  try {
    const ride = await Ride.findOne({ rideId });
    if (!ride) {
      return { success: false, message: "Ride not found" };
    }
    
    return {
      success: true,
      ride: {
        rideId: ride.rideId,
        status: ride.status,
        from: ride.from,
        to: ride.to,
        requestedTime: ride.requestedTime,
        estimatedDuration: ride.estimatedDuration,
        driverPhone: ride.driverPhone,
        riderPhone: ride.riderPhone,
        distance: ride.distance,
        googleEventId: ride.googleEventId,
        rejectionReason: ride.rejectionReason,
        conflictDetails: ride.conflictDetails
      }
    };
  } catch (error) {
    console.error("Error getting ride status:", error);
    return { success: false, message: "Error retrieving ride status" };
  }
}

module.exports = {
  bookRideInternal,
  sendAutomatedNotifications,
  getRideStatus,
  findNearestAvailableDrivers  // **NEW: Find nearest available drivers**
}; 