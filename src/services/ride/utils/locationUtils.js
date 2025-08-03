const Driver = require('../../../models/driver');
const Ride = require('../../../models/Ride');
const { calculateDistance } = require('../../maps');
const moment = require('moment');

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

async function validateDriverPickupDistance(driverPhone, pickupLocation, requestedTime) {
  try {
    console.log(`🔍 Validating driver pickup distance for ${driverPhone}`);
    
    if (requestedTime) {
      const now = new Date();
      const rideTime = new Date(requestedTime);
      const hoursUntilRide = (rideTime - now) / (1000 * 60 * 60);
      const FUTURE_BOOKING_THRESHOLD_HOURS = 4;
      
      if (hoursUntilRide > FUTURE_BOOKING_THRESHOLD_HOURS) {
        console.log(`🔍 Future booking detected (${Math.round(hoursUntilRide)} hours from now), checking for existing rides on same date`);
        
        const startOfDay = new Date(rideTime);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(rideTime);
        endOfDay.setHours(23, 59, 59, 999);
        
        const existingRides = await Ride.find({
          driverPhone: driverPhone,
          status: { $in: ['auto_accepted', 'confirmed', 'in_progress'] },
          requestedTime: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }).sort({ requestedTime: 1 });
        
        if (existingRides.length > 0) {
          console.log(`📅 Found ${existingRides.length} existing ride(s) for driver ${driverPhone} on ${rideTime.toDateString()}`);
          
          for (const existingRide of existingRides) {
            try {
              const distanceFromDestination = await calculateDistance(existingRide.to, pickupLocation);
              
              if (distanceFromDestination.duration !== null) {
                const MINIMUM_TRAVEL_TIME_HOURS = 2;
                const SAME_AREA_THRESHOLD_MINUTES = 30;
                const travelTimeHours = distanceFromDestination.duration / 60;
                const travelTimeMinutes = distanceFromDestination.duration;
                
                if (travelTimeMinutes > SAME_AREA_THRESHOLD_MINUTES && travelTimeHours <= MINIMUM_TRAVEL_TIME_HOURS) {
                  return {
                    valid: false,
                    reason: `Driver has another ride too close on the same date. Travel time between rides would be ${travelTimeHours.toFixed(1)} hours (minimum ${MINIMUM_TRAVEL_TIME_HOURS} hours required, or rides must be in same area within ${SAME_AREA_THRESHOLD_MINUTES} minutes)`,
                    distance: distanceFromDestination.distance,
                    duration: distanceFromDestination.duration,
                    conflictingRide: {
                      rideId: existingRide.rideId,
                      time: existingRide.requestedTime,
                      destination: existingRide.to
                    }
                  };
                }
              }
              
              const distanceFromPickup = await calculateDistance(existingRide.from, pickupLocation);
              
              if (distanceFromPickup.duration !== null) {
                const MINIMUM_TRAVEL_TIME_HOURS = 2;
                const SAME_AREA_THRESHOLD_MINUTES = 30;
                const travelTimeHours = distanceFromPickup.duration / 60;
                const travelTimeMinutes = distanceFromPickup.duration;
                
                if (travelTimeMinutes > SAME_AREA_THRESHOLD_MINUTES && travelTimeHours <= MINIMUM_TRAVEL_TIME_HOURS) {
                  return {
                    valid: false,
                    reason: `Driver has another ride too close on the same date. Travel time between ride locations would be ${travelTimeHours.toFixed(1)} hours (minimum ${MINIMUM_TRAVEL_TIME_HOURS} hours required, or rides must be in same area within ${SAME_AREA_THRESHOLD_MINUTES} minutes)`,
                    distance: distanceFromPickup.distance,
                    duration: distanceFromPickup.duration,
                    conflictingRide: {
                      rideId: existingRide.rideId,
                      time: existingRide.requestedTime,
                      pickup: existingRide.from
                    }
                  };
                }
              }
            } catch (distanceError) {
              console.error(`❌ Error calculating distance to existing ride:`, distanceError.message);
            }
          }
        }
        
        return { 
          valid: true, 
          reason: `Future booking (${Math.round(hoursUntilRide)} hours in advance) - no conflicting rides on same date`,
          distance: null,
          duration: null,
          futureBooking: true,
          hoursUntilRide: hoursUntilRide,
          existingRidesChecked: existingRides.length
        };
      }
    }
    
    const lastLocation = await getDriverLastLocation(driverPhone);
    
    if (!lastLocation) {
      return { valid: true, reason: 'First ride for driver' };
    }
    
    if (lastLocation.lastUpdated) {
      const now = new Date();
      const locationAge = (now - new Date(lastLocation.lastUpdated)) / (1000 * 60);
      const TWO_HOURS_IN_MINUTES = 120;
      
      if (locationAge > TWO_HOURS_IN_MINUTES) {
        return { 
          valid: true, 
          reason: `Location data is stale (${Math.round(locationAge/60)} hours old) - ride allowed`,
          distance: null,
          duration: null,
          locationAge: locationAge
        };
      }
    }
    
    const { distance, duration } = await calculateDistance(lastLocation.address, pickupLocation);
    
    if (distance === null || duration === null) {
      return { 
        valid: true, 
        reason: 'Distance calculation unavailable - ride allowed',
        distance: null,
        duration: null,
        warning: 'Could not verify driver distance'
      };
    }
    
    const MAX_DISTANCE_KM = process.env.MAX_DRIVER_DISTANCE_KM || 10;
    const MAX_DURATION_MIN = process.env.MAX_DRIVER_DURATION_MIN || 30;
    
    if (distance > MAX_DISTANCE_KM) {
      return { 
        valid: false, 
        reason: `Driver is too far from pickup location (${distance.toFixed(1)}km away, max ${MAX_DISTANCE_KM}km)`,
        distance: distance,
        duration: duration
      };
    }
    
    if (duration > MAX_DURATION_MIN) {
      return { 
        valid: false, 
        reason: `Driver is too far from pickup location (${duration.toFixed(1)} minutes away, max ${MAX_DURATION_MIN} minutes)`,
        distance: distance,
        duration: duration
      };
    }
    
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

module.exports = {
  getDriverLastLocation,
  updateDriverLocation,
  validateDriverPickupDistance
}; 