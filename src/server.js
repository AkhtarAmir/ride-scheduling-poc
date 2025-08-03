const app = require('./app');
const { MOCK_TWILIO } = require('./config/twilio');

const port = process.env.PORT || 3000;

// Start server
app.listen(port, () => {
  console.log(`\n🤖 FULLY AUTOMATED RIDE BOOKING SYSTEM`);
  console.log(`Server running on port ${port}`);
  console.log(`Twilio: ${MOCK_TWILIO ? 'MOCK MODE' : 'LIVE MODE'}`);
  console.log(`Calendar: ${process.env.GOOGLE_CLIENT_EMAIL ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Database: ${process.env.MONGODB_URI ? 'CONNECTED' : 'NOT CONFIGURED'}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`POST /ride/request     - Submit ride (auto-processed)`);
  console.log(`GET  /ride/status/:id  - Check ride status`);
  console.log(`POST /webhook/whatsapp - WhatsApp webhook endpoint`);
  console.log(`POST /calendar/test    - Test calendar service`);
  console.log(`GET  /conversations/active - View active conversations`);
  console.log(`GET  /health           - System health & stats`);
});

module.exports = app; 