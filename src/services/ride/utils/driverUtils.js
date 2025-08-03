const Driver = require('../../../models/driver');
const { calculateDistance } = require('../../maps');
const { getDriverLastLocation } = require('./locationUtils');

function calculateDriverScore(distance, rating, totalRides) {
  // Normalize values
  const distanceScore = Math.max(0, (15 - distance) / 15); // Closer = better (max 15km)
  const ratingScore = rating / 5; // Rating out of 5
  const experienceScore = Math.min(totalRides / 100, 1); // Experience (capped at 100 rides = max score)
  
  // Weighted combination: distance (40%), rating (40%), experience (20%)
  return (distanceScore * 0.4) + (ratingScore * 0.4) + (experienceScore * 0.2);
}

async function findNearestAvailableDrivers(pickupLocation, requestedTime, maxResults = 5) {
  try {
    console.log(`🔍 Finding nearest drivers for pickup: ${pickupLocation}`);
    
    const allDrivers = await Driver.find({}).sort({ rating: -1, totalRides: -1 });
    
    console.log(`🔍 Found ${allDrivers.length} total drivers in database`);
    
    if (allDrivers.length === 0) {
      console.log('⚠️ No drivers found in database');
      return [];
    }
    
    const driverDistances = [];
    
    for (const driver of allDrivers) {
      try {
        const driverLocation = await getDriverLastLocation(driver.phone);
        
        if (!driverLocation) {
          console.log(`⚠️ No location found for driver ${driver.phone}, skipping`);
          continue;
        }
        
        const distanceResult = await calculateDistance(driverLocation.address, pickupLocation);
        
        const MAX_DISTANCE_KM = process.env.MAX_DRIVER_DISTANCE_KM || 20;
        const MAX_DURATION_MIN = process.env.MAX_DRIVER_DURATION_MIN || 30;
        
        console.log(`🔍 Checking driver ${driver.phone} at ${driverLocation.address} - distance: ${distanceResult.distance}km, duration: ${distanceResult.duration}min`);
        
        if (distanceResult.distance <= MAX_DISTANCE_KM && distanceResult.duration <= MAX_DURATION_MIN) {
          let isAvailable = true;
          if (requestedTime && driver.calendarIntegration?.enabled) {
            try {
              const conflicts = await checkCalendarConflicts(
                driver.phone, 
                null,
                new Date(requestedTime), 
                60
              );
              isAvailable = !conflicts.hasConflict;
              
              if (conflicts.hasConflict) {
                console.log(`⏰ Driver ${driver.phone} has conflict at ${requestedTime}: ${conflicts.rejectionReason || 'Schedule conflict'}`);
              }
            } catch (error) {
              console.error(`❌ Calendar check failed for driver ${driver.phone}: ${error.message}`);
              isAvailable = false;
              console.log(`🚫 Driver ${driver.phone} marked as unavailable due to calendar check failure`);
            }
          } else if (requestedTime) {
            try {
              const existingBookings = await require('../../../models/Ride').find({
                driverPhone: driver.phone,
                status: { $in: ['auto_accepted', 'confirmed', 'in_progress'] },
                requestedTime: {
                  $gte: new Date(new Date(requestedTime).getTime() - 30 * 60 * 1000),
                  $lte: new Date(new Date(requestedTime).getTime() + 90 * 60 * 1000)
                }
              });
              
              if (existingBookings.length > 0) {
                isAvailable = false;
                console.log(`🚫 Driver ${driver.phone} has ${existingBookings.length} existing booking(s) around ${requestedTime}`);
              }
            } catch (dbError) {
              console.error(`❌ Database check failed for driver ${driver.phone}:`, dbError.message);
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

module.exports = {
  calculateDriverScore,
  findNearestAvailableDrivers
}; 