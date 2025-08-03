const { sendNotification } = require('./core/notificationCore');
const { normalizePakistaniNumber } = require('./utils/phoneUtils');

module.exports = {
  // Core functionality
  sendNotification,
  
  // Phone utilities
  normalizePakistaniNumber
}; 