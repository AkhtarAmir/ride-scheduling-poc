const mongoose = require("mongoose");

const DriverSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 100
    },
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
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: 'Invalid email format'
      }
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    vehicleDetails: {
      make: String,
      model: String,
      year: Number,
      plateNumber: String,
      color: String
    },
    isActive: {
      type: Boolean,
      default: true
    },
    workingHours: {
      start: {
        type: String,
        default: "08:00"
      },
      end: {
        type: String,
        default: "20:00"
      }
    },
    workingDays: [{
      type: String,
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    }],
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 5.0
    },
    totalRides: {
      type: Number,
      default: 0,
      min: 0
    },
    calendarIntegration: {
      enabled: {
        type: Boolean,
        default: true
      },
      calendarId: String,
      lastSync: Date
    },
    currentLocation: {
      address: {
        type: String,
        default: null
      },
      coordinates: {
        lat: Number,
        lng: Number
      },
      lastUpdated: {
        type: Date,
        default: null
      }
    },
    serviceArea: {
      maxDistance: {
        type: Number,
        default: 10 // 10 km default
      },
      maxDuration: {
        type: Number,
        default: 20 // 20 minutes default
      }
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
DriverSchema.index({ phone: 1 });
DriverSchema.index({ isActive: 1 });
DriverSchema.index({ rating: -1 });

// Virtual for full name with vehicle
DriverSchema.virtual('displayName').get(function() {
  const vehicle = this.vehicleDetails?.make && this.vehicleDetails?.model 
    ? ` (${this.vehicleDetails.make} ${this.vehicleDetails.model})`
    : '';
  return this.name + vehicle;
});

// Pre-save middleware
DriverSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.name = this.name.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }
  next();
});

module.exports = mongoose.model("Driver", DriverSchema);