const mongoose = require("mongoose");

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
UserSchema.index({ phone: 1 });
UserSchema.index({ userType: 1 });
UserSchema.index({ isActive: 1 });

module.exports = mongoose.model("User", UserSchema); 