const { google } = require('googleapis');
const { Client } = require('@googlemaps/google-maps-services-js');

// Google Calendar configuration
let auth;
let calendar;

try {
  // Try key file first (for testing)
  if (require('fs').existsSync('./heroic-grove-465018-h0-626c30a9a60a.json')) {
    console.log('🔑 Using service account key file');
    auth = new google.auth.GoogleAuth({
      keyFile: './heroic-grove-465018-h0-626c30a9a60a.json',
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    // Use environment variables
    console.log('🔑 Using environment variables');
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;
    
    // Remove surrounding quotes if present
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    
    // Replace escaped newlines
    privateKey = privateKey.replace(/\\n/g, '\n');
    
    auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  } else {
    console.warn('⚠️ Google Calendar credentials not found. Calendar integration will be disabled.');
    auth = null;
  }

  if (auth) {
    calendar = google.calendar({
      version: "v3",
      auth: auth,
    });
  }
} catch (error) {
  console.error('❌ Failed to initialize Google Calendar:', error.message);
  auth = null;
  calendar = null;
}

// Initialize Google Maps client
const googleMapsClient = new Client({});

module.exports = {
  calendar,
  googleMapsClient
}; 