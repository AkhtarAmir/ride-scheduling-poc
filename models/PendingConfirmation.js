const mongoose = require("mongoose");

const PendingConfirmationSchema = new mongoose.Schema(
  {
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      unique: true,
    },
    driverPhone: {
      type: String,
      required: true,
    },
    confirmationType: {
      type: String,
      enum: ["initial", "conflict_override"],
      default: "initial"
    },
    conflictingEvents: [{
      title: String,
      start: Date,
      end: Date,
      eventId: String
    }],
    messagesSent: {
      type: Number,
      default: 1,
      max: 3
    },
    expiresAt: {
      type: Date,
      default: Date.now,
      expires: 1800 // 30 minutes
    },
    lastMessageAt: {
      type: Date,
      default: Date.now
    }
  },
  { 
    timestamps: true 
  }
);

// Indexes
PendingConfirmationSchema.index({ rideId: 1 });
PendingConfirmationSchema.index({ driverPhone: 1 });
PendingConfirmationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Auto-cleanup expired confirmations
PendingConfirmationSchema.pre('save', function(next) {
  if (this.isNew) {
    this.expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
  }
  next();
});

module.exports = mongoose.model("PendingConfirmation", PendingConfirmationSchema);