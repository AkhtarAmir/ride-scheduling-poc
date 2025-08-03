const mongoose = require("mongoose");

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
    },
    riderPhone: {
      type: String,
      required: true,
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
      enum: ["driver_conflict", "rider_conflict", "driver_location", "system_error"],
      default: undefined
    },

    estimatedDuration: {
      type: Number,
      default: 60,
      min: 5,
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
    conflictResolution: {
      type: {
        type: String,
        enum: ['driver_conflict', 'rider_conflict'],
        default: undefined
      },
      message: String,
      alternativeDrivers: [{
        driverPhone: String,
        rideCount: Number,
        rating: Number,
        reason: String
      }],
      suggestedTimes: [{
        time: String,
        display: String,
        offset: Number
      }],
      suggestion: String
    },
    processedAt: {
      type: Date,
      default: Date.now
    },
    distance: {
      type: Number,
      default: null
    }
  },
  { 
    timestamps: true
  }
);

// Indexes
RideSchema.index({ driverPhone: 1, requestedTime: 1 });
RideSchema.index({ riderPhone: 1, requestedTime: 1 });
RideSchema.index({ status: 1 });
RideSchema.index({ rideId: 1 });

module.exports = mongoose.model("Ride", RideSchema);