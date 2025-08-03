const { bookRideInternal, getRideStatus } = require('./core/rideCore');
const { findNearestAvailableDrivers } = require('./utils/driverUtils');
const { validateDriverPickupDistance, getDriverLastLocation, updateDriverLocation } = require('./utils/locationUtils');
const { generateAlternativeTimes, sendAutomatedNotifications } = require('./utils/notificationUtils');

module.exports = {
  // Core functionality
  bookRide: bookRideInternal,
  getRideStatus,
  
  // Driver-related functions
  findNearestAvailableDrivers,
  
  // Location-related functions
  validateDriverPickupDistance,
  getDriverLastLocation,
  updateDriverLocation,
  
  // Notification-related functions
  generateAlternativeTimes,
  sendAutomatedNotifications
}; 