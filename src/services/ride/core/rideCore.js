const Ride = require('../../../models/Ride');
const User = require('../../../models/User');
const Driver = require('../../../models/driver');
const { checkCalendarConflicts, createCalendarEvent } = require('../../calendar');
const { calculateDistance } = require('../../maps');
const { sendNotification } = require('../../notification');
const vectorDBService = require('../../vector-db');
const { clearConversationHistory } = require('../../conversation');
const { validateDriverPickupDistance, getDriverLastLocation, updateDriverLocation } = require('../utils/locationUtils');
const { generateAlternativeTimes, sendAutomatedNotifications } = require('../utils/notificationUtils');
const moment = require('moment');

async function bookRideInternal(rideData) {
  try {
    const { driverPhone, riderPhone, from, to, time, estimatedDuration } = rideData;
    
    console.log(`🚗 Starting ride booking validation for driver ${driverPhone}`);
    
    const pickupValidation = await validateDriverPickupDistance(driverPhone, from, time);
    
    if (!pickupValidation.valid) {
      console.log(`❌ Driver pickup validation failed: ${pickupValidation.reason}`);
      
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
      
      const rejectionMessage = `❌ *Ride Request Rejected*\n\n📍 *Pickup:* ${from}\n🎯 *Destination:* ${to}\n⏰ *Time:* ${moment(time).format('MMM DD, YYYY h:mm A')}\n\n*Reason:* ${pickupValidation.reason}\n\nPlease try a different driver or contact support.`;
      await sendNotification(riderPhone, rejectionMessage);
      
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
    
    const { distance } = await calculateDistance(from, to);
    
    const conflictResult = await checkCalendarConflicts(
      driverPhone, 
      riderPhone, 
      moment(time).toDate(), 
      estimatedDuration
    );
    
    let status = "auto_accepted";
    let conflictResolution = null;
    
    if (conflictResult.hasConflict && conflictResult.rejectionReason) {
      status = "auto_rejected";
      
      if (conflictResult.rejectionReason === 'driver_conflict') {
        conflictResolution = {
          type: 'driver_conflict',
          message: 'The requested driver is not available at this time.',
          alternativeDrivers: [],
          suggestion: 'Please provide a different driver\'s phone number.'
        };
      } else if (conflictResult.rejectionReason === 'rider_conflict') {
        conflictResolution = {
          type: 'rider_conflict',
          message: 'You have a conflicting appointment at this time.',
          suggestion: 'Please provide a different time for your ride.'
        };
      }
    }
    
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
      }
      
      try {
        await updateDriverLocation(driverPhone, to);
        console.log(`📍 Updated driver ${driverPhone} location to destination: ${to}`);
      } catch (locationError) {
        console.error(`❌ Failed to update driver location:`, locationError.message);
      }
      
      try {
        await vectorDBService.recordRide(riderPhone, driverPhone, from, to, true);
        console.log(`✅ Recorded driver preference for ${riderPhone} with driver ${driverPhone}`);
      } catch (preferenceError) {
        console.error(`❌ Failed to record driver preference:`, preferenceError.message);
      }
    }
    
    await User.findOneAndUpdate(
      { phone: riderPhone },
      { 
        phone: riderPhone,
        lastRideAt: status === "auto_accepted" ? new Date() : undefined,
        $inc: { totalRides: status === "auto_accepted" ? 1 : 0 }
      },
      { upsert: true }
    );
    
    await sendAutomatedNotifications(ride, conflictResult, conflictResolution);
    
    const wasAccepted = status === "auto_accepted";
    return {
      success: wasAccepted,
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
  getRideStatus
}; 