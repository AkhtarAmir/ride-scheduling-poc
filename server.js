const express = require("express");
const bodyParser = require("body-parser");
const { google } = require("googleapis");
const twilio = require("twilio");
const moment = require("moment");
const mongoose = require("mongoose");
require("dotenv").config();
const morgan = require("morgan");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(morgan("dev"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Mock mode for development (change to false for production)
const MOCK_TWILIO = false;

// Twilio configuration
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Google Calendar configuration
const auth = new google.auth.GoogleAuth({
  keyFile: './creds.json', // Put your JSON file here
  scopes: ["https://www.googleapis.com/auth/calendar"],
});

const calendar = google.calendar({
  version: "v3",
  auth: auth,
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", (err) => console.error("MongoDB connection error:", err));
db.once("open", () => console.log("Connected to MongoDB"));

const RideSchema = new mongoose.Schema(
  {
    rideId: {
      type: String,
      required: true,
      unique: true,
      default: () => `ride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    driverPhone: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^\+[1-9]\d{1,14}$/.test(v);
        },
        message: 'Invalid phone number format'
      }
    },
    riderPhone: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^\+[1-9]\d{1,14}$/.test(v);
        },
        message: 'Invalid phone number format'
      }
    },
    from: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200
    },
    to: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200
    },
    requestedTime: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ["auto_accepted", "auto_rejected", "completed", "cancelled"],
      required: true
    },
    rejectionReason: {
      type: String,
      enum: ["driver_conflict", "rider_conflict", "system_error"],
      default: undefined
    },
    estimatedDuration: {
      type: Number,
      default: 60,
      min: 15,
      max: 480
    },
    googleEventId: {
      type: String,
      default: null
    },
    conflictDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: []
    },
    processedAt: {
      type: Date,
      default: Date.now
    }
  },
  { 
    timestamps: true
  }
);

const UserSchema = new mongoose.Schema({
  phone: { 
    type: String, 
    required: true, 
    unique: true,
    validate: {
      validator: function(v) {
        return /^\+[1-9]\d{1,14}$/.test(v);
      },
      message: 'Invalid phone number format'
    }
  },
  name: { type: String, default: "" },
  userType: { type: String, enum: ["rider", "driver"], default: "rider" },
  totalRides: { type: Number, default: 0 },
  lastRideAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Indexes
RideSchema.index({ driverPhone: 1, requestedTime: 1 });
RideSchema.index({ riderPhone: 1, requestedTime: 1 });
RideSchema.index({ status: 1 });
RideSchema.index({ rideId: 1 });

if (mongoose.models.Ride) {
  delete mongoose.models.Ride;
}
if (mongoose.models.User) {
  delete mongoose.models.User;
}

const Ride = mongoose.model("Ride", RideSchema);
const User = mongoose.model("User", UserSchema);

async function sendNotification(to, message) {
  if (MOCK_TWILIO) {
    console.log(`MOCK MESSAGE TO ${to}:`);
    console.log(message);
    console.log("---");
  } else {
    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to,
      });
      console.log(`Message sent to ${to}`);
    } catch (error) {
      console.error(`Failed to send message to ${to}:`, error);
    }
  }
}

async function checkCalendarConflicts(driverPhone, riderPhone, requestedTime, duration = 60) {
  try {
    const startTime = moment(requestedTime);
    const endTime = moment(requestedTime).add(duration, "minutes");
    
    // Check 30 minutes before and after for conflicts
    const searchStart = startTime.clone().subtract(30, "minutes");
    const searchEnd = endTime.clone().add(30, "minutes");

    console.log(`Checking conflicts from ${searchStart.format()} to ${searchEnd.format()}`);

    // 1. Check Google Calendar for driver conflicts
    let calendarConflicts = [];
    try {
      // Use "primary" calendar or your specific calendar ID
      const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
      console.log(`Using calendar ID: ${calendarId}`);
      
      const response = await calendar.events.list({
        calendarId: calendarId,
        timeMin: searchStart.toISOString(),
        timeMax: searchEnd.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      calendarConflicts = response.data.items || [];
      console.log(`Google Calendar: ${calendarConflicts.length} events found`);
    } catch (error) {
      console.error("Calendar API error:", error.message);
      console.log("Continuing without calendar check...");
      // Don't fail the whole process - continue without calendar check
    }

    // 2. Check existing rides for BOTH driver and rider
    const existingRides = await Ride.find({
      $or: [
        { driverPhone: driverPhone },
        { riderPhone: riderPhone }
      ],
      status: { $in: ["auto_accepted", "completed"] },
      requestedTime: {
        $gte: searchStart.toDate(),
        $lte: searchEnd.toDate()
      }
    });

    console.log(`Existing rides: ${existingRides.length} found`);

    // 3. Determine conflict details
    const conflicts = [];
    
    // Calendar conflicts (driver)
    calendarConflicts.forEach(event => {
      conflicts.push({
        type: "driver_calendar",
        eventTitle: event.summary || "Busy",
        eventTime: event.start?.dateTime || event.start?.date,
        details: `Driver has: ${event.summary || "appointment"}`
      });
    });

    // Existing ride conflicts
    existingRides.forEach(ride => {
      if (ride.driverPhone === driverPhone) {
        conflicts.push({
          type: "driver_conflict",
          eventTitle: `Ride: ${ride.from} → ${ride.to}`,
          eventTime: ride.requestedTime,
          details: `Driver already has ride: ${ride.from} → ${ride.to}`
        });
      }
      if (ride.riderPhone === riderPhone) {
        conflicts.push({
          type: "rider_conflict", 
          eventTitle: `Ride: ${ride.from} → ${ride.to}`,
          eventTime: ride.requestedTime,
          details: `Rider already has ride: ${ride.from} → ${ride.to}`
        });
      }
    });

    const hasConflict = conflicts.length > 0;
    const rejectionReason = conflicts.some(c => c.type.includes('rider')) ? 'rider_conflict' :
                           conflicts.some(c => c.type.includes('driver')) ? 'driver_conflict' : null;

    console.log(`Conflict check result: ${hasConflict ? 'CONFLICTS FOUND' : 'NO CONFLICTS'}`);
    if (hasConflict) {
      console.log(`Conflicts:`, conflicts.map(c => c.details));
    }

    return {
      hasConflict,
      rejectionReason,
      conflicts,
      summary: hasConflict ? 
        `Found ${conflicts.length} conflict(s): ${conflicts.map(c => c.details).join(', ')}` :
        'No conflicts detected'
    };

  } catch (error) {
    console.error("Error checking conflicts:", error);
    return {
      hasConflict: true,
      rejectionReason: 'system_error',
      conflicts: [],
      summary: 'System error during conflict check'
    };
  }
}

async function createCalendarEvent(ride) {
  try {
    const startTime = moment(ride.requestedTime);
    const endTime = startTime.clone().add(ride.estimatedDuration, "minutes");

    const event = {
      summary: `RIDE: ${ride.from} → ${ride.to}`,
      description: `AUTO-BOOKED RIDE\n\nDriver: ${ride.driverPhone}\nRider: ${ride.riderPhone}\nRide ID: ${ride.rideId}\nDuration: ${ride.estimatedDuration} min\n\nThis ride was automatically scheduled by the system.`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: "Asia/Karachi",
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: "Asia/Karachi",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 10 },
          { method: 'popup', minutes: 5 }
        ]
      },
      colorId: '10' // Green for auto-accepted rides
    };

    // Use same calendar ID as in conflict check
    const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
    console.log(`Creating event in calendar: ${calendarId}`);

    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: event,
    });

    console.log(`Calendar event created: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error("Error creating calendar event:", error.message);
    throw error;
  }
}

// Send automated notifications
async function sendAutomatedNotifications(ride, conflictResult) {
  try {
    const formattedTime = moment(ride.requestedTime).format("MMMM Do YYYY, h:mm A");
    
    if (ride.status === "auto_accepted") {
      // SUCCESS MESSAGES
      const riderMessage = `RIDE AUTO-CONFIRMED!\n\nYour ride has been automatically booked:\n\n📍 From: ${ride.from}\n📍 To: ${ride.to}\nTime: ${formattedTime}\n🚗 Driver: ${ride.driverPhone}\nRide ID: ${ride.rideId}`;
      

      await sendNotification(`whatsapp:${ride.riderPhone}`, riderMessage);
      
    } else if (ride.status === "auto_rejected") {
      const riderMessage = `RIDE AUTO-REJECTED\n\nSorry, your ride request was automatically rejected:\n\n📍 From: ${ride.from}\n📍 To: ${ride.to}\nRequested: ${formattedTime}\n\nDriver is busy at the requested time. Please choose a different time slot.`;
      
      await sendNotification(`whatsapp:${ride.riderPhone}`, riderMessage);
    }

    console.log(`Automated notifications sent for ride ${ride.rideId} (${ride.status})`);
  } catch (error) {
    console.error("Error sending notifications:", error);
  }
}

// MAIN AUTOMATED BOOKING ENDPOINT
app.post("/ride/request", async (req, res) => {
  try {
    const { driverPhone, riderPhone, from, to, time, estimatedDuration, rideId } = req.body;

    // Basic validation
    if (!driverPhone || !riderPhone || !from || !to || !time) {
      return res.status(400).json({ 
        success: false,
        error: "Missing required fields: driverPhone, riderPhone, from, to, time" 
      });
    }

    // Phone validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(driverPhone) || !phoneRegex.test(riderPhone)) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid phone format. Use international format (+1234567890)" 
      });
    }

    // Future time validation
    if (moment(time).isBefore(moment())) {
      return res.status(400).json({ 
        success: false,
        error: "Ride time must be in the future" 
      });
    }

    const finalRideId = rideId || `ride_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const duration = estimatedDuration || 60;

    console.log(`\nSTEP 1: Checking conflicts...`);
    const conflictResult = await checkCalendarConflicts(driverPhone, riderPhone, time, duration);

    // STEP 2: Auto-decide based on conflicts
    console.log(`\n STEP 2: Auto-processing decision...`);
    let status, googleEventId = null;
    
    if (conflictResult.hasConflict) {
      status = "auto_rejected";
    } else {
      status = "auto_accepted"; 
    }

    // STEP 3: Create ride record
    console.log(`\nSTEP 3: Saving ride to database...`);
    const ride = new Ride({
      rideId: finalRideId,
      driverPhone,
      riderPhone,
      from: from.trim(),
      to: to.trim(),
      requestedTime: moment(time).toDate(),
      status,
      estimatedDuration: duration,
      conflictDetails: conflictResult.conflicts,
      processedAt: new Date()
    });

    // Only set rejectionReason if there's actually a conflict
    if (conflictResult.hasConflict && conflictResult.rejectionReason) {
      ride.rejectionReason = conflictResult.rejectionReason;
    }

    await ride.save();
    console.log(`Ride saved with status: ${status}`);

    // STEP 4: Create calendar event if accepted
    if (status === "auto_accepted") {
      console.log(`\nSTEP 4: Creating calendar event...`);
      try {
        googleEventId = await createCalendarEvent(ride);
        ride.googleEventId = googleEventId;
        await ride.save();
        console.log(`Calendar event created successfully`);
      } catch (calendarError) {
        console.error("Calendar creation failed, but ride still accepted:", calendarError);
      }
    } else {
      console.log(`\nSTEP 4: Skipping calendar (ride rejected)`);
    }

    console.log(`\nSTEP 5: Updating user records...`);
    await User.findOneAndUpdate(
      { phone: riderPhone },
      { 
        phone: riderPhone,
        lastRideAt: status === "auto_accepted" ? new Date() : undefined,
        $inc: { totalRides: status === "auto_accepted" ? 1 : 0 }
      },
      { upsert: true }
    );
    console.log(`Rider record updated`);

    console.log(`\nSTEP 6: Sending notifications...`);
    await sendAutomatedNotifications(ride, conflictResult);

    console.log(`\nSTEP 7: Sending response...`);
    const response = {
      success: true,
      rideId: ride.rideId,
      status: ride.status,
      autoDecision: status === "auto_accepted" ? "ACCEPTED" : "REJECTED",
      requestedTime: ride.requestedTime,
      estimatedDuration: ride.estimatedDuration,
      processedAt: ride.processedAt,
      hasConflicts: conflictResult.hasConflict
    };

    if (status === "auto_accepted") {
      response.message = "Ride automatically accepted and booked!";
      response.calendarEventId = googleEventId;
      console.log(`SUCCESS: Ride ${finalRideId} AUTO-ACCEPTED!`);
      return res.status(200).json(response);
    } else {
      response.message = "Ride automatically rejected due to conflicts";
      response.rejectionReason = conflictResult.rejectionReason;
      response.conflictSummary = conflictResult.summary;
      response.conflicts = conflictResult.conflicts;
      console.log(`REJECTED: Ride ${finalRideId} AUTO-REJECTED!`);
      return res.status(409).json(response);
    }

  } catch (error) {
    console.error("SYSTEM ERROR during automated processing:", error);
    res.status(500).json({ 
      success: false,
      error: "System error during automated ride processing",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get("/ride/status/:rideId", async (req, res) => {
  try {
    const ride = await Ride.findOne({ rideId: req.params.rideId });
    
    if (!ride) {
      return res.status(404).json({ 
        success: false,
        error: "Ride not found" 
      });
    }

    res.json({ 
      success: true,
      ride: {
        rideId: ride.rideId,
        status: ride.status,
        autoDecision: ride.status.replace('auto_', '').toUpperCase(),
        from: ride.from,
        to: ride.to,
        requestedTime: ride.requestedTime,
        estimatedDuration: ride.estimatedDuration,
        driverPhone: ride.driverPhone,
        riderPhone: ride.riderPhone,
        rejectionReason: ride.rejectionReason,
        conflictDetails: ride.conflictDetails,
        googleEventId: ride.googleEventId,
        processedAt: ride.processedAt,
        createdAt: ride.createdAt
      }
    });
  } catch (error) {
    console.error("Error fetching ride:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to get ride status" 
    });
  }
});

app.get("/health", async (req, res) => {
  try {
    const dbStatus = db.readyState === 1 ? "connected" : "disconnected";
    
    let calendarStatus = "unknown";
    try {
      await calendar.calendars.get({ calendarId: "primary" });
      calendarStatus = "connected";
    } catch {
      calendarStatus = "error";
    }

    const stats = {
      totalRides: await Ride.countDocuments(),
      autoAccepted: await Ride.countDocuments({ status: "auto_accepted" }),
      autoRejected: await Ride.countDocuments({ status: "auto_rejected" }),
      completedRides: await Ride.countDocuments({ status: "completed" })
    };
    
    res.json({
      status: "ok",
      mode: "FULLY_AUTOMATED",
      database: dbStatus,
      calendar: calendarStatus,
      twilio: MOCK_TWILIO ? "mock" : "real",
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: "error",
      error: "Health check failed",
      timestamp: new Date().toISOString()
    });
  }
});

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
  console.log(`GET  /health           - System health & stats`);
});

module.exports = app;