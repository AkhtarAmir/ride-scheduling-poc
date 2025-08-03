const { calculateDistance, validateLocationExists, reverseGeocode } = require('./core/mapsCore');
const { validateLocationComponents, canCalculateDistance } = require('./utils/validationUtils');

module.exports = {
  // Core functionality
  calculateDistance,
  validateLocationExists,
  reverseGeocode,
  
  // Validation utilities
  validateLocationComponents,
  canCalculateDistance
}; 