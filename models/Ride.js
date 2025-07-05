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
      validate: {
        validator: function(v) {
          return /^\+[1-9]\d{1,14}$/.test(v);
        },
        message: 'Invalid phone number format'
      }
    },
    userPhone: {
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
    scheduledTime: {
      type: Date,
      required: true,
      validate: {
        validator: function(v) {
          return v > new Date();
        },
        message: 'Scheduled time must be in the future'
      }
    },
    status: {
      type: String,
      enum: ["pending", "driver_confirmed", "scheduled", "rejected", "completed", "cancelled"],
      default: "pending"
    },
    driverName: {
      type: String,
      trim: true,
      maxLength: 100
    },
    estimatedDuration: {
      type: Number,
      default: 60,
      min: 15,
      max: 480
    },
    notes: {
      type: String,
      maxLength: 500
    },
    googleEventId: {
      type: String,
      default: null
    },
    conflictOverride: {
      type: Boolean,
      default: false
    },
    price: {
      type: Number,
      min: 0
    },
    distance: {
      type: Number,
      min: 0
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
RideSchema.index({ driverPhone: 1, status: 1 });
RideSchema.index({ scheduledTime: 1 });
RideSchema.index({ rideId: 1 });
RideSchema.index({ createdAt: -1 });

// Virtual for ride duration
RideSchema.virtual('endTime').get(function() {
  return new Date(this.scheduledTime.getTime() + (this.estimatedDuration * 60000));
});

// Pre-save middleware
RideSchema.pre('save', function(next) {
  if (this.isModified('from')) {
    this.from = this.from.charAt(0).toUpperCase() + this.from.slice(1);
  }
  if (this.isModified('to')) {
    this.to = this.to.charAt(0).toUpperCase() + this.to.slice(1);
  }
  next();
});

module.exports = mongoose.model("Ride", RideSchema);