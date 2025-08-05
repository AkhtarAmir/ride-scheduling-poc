require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Driver = require('../models/driver');
const sampleDrivers = [
  {
    name: "John Peterson",
    phone: "+12025550112",
    email: "john.peterson@example.com",
    licenseNumber: "CA12345678",
    vehicleDetails: {
      make: "Toyota",
      model: "Camry",
      year: 2020,
      plateNumber: "7ABC123",
      color: "White"
    },
    isActive: true,
    workingHours: {
      start: "07:00",
      end: "19:00"
    },
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    rating: 4.7,
    totalRides: 130,
    currentLocation: {
      address: "Mission District, San Francisco, CA",
      coordinates: {
        lat: 37.7599,
        lng: -122.4148
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 15,
      maxDuration: 30
    }
  },
  {
    name: "Emily Carter",
    phone: "+13105550321",
    email: "emily.carter@example.com",
    licenseNumber: "TX76543210",
    vehicleDetails: {
      make: "Honda",
      model: "CR-V",
      year: 2021,
      plateNumber: "TXR-4421",
      color: "Silver"
    },
    isActive: true,
    workingHours: {
      start: "06:00",
      end: "18:00"
    },
    workingDays: ["monday", "wednesday", "friday", "saturday"],
    rating: 4.9,
    totalRides: 170,
    currentLocation: {
      address: "Downtown Austin, TX",
      coordinates: {
        lat: 30.2672,
        lng: -97.7431
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 20,
      maxDuration: 35
    }
  },
  {
    name: "Carlos Ramirez",
    phone: "+13105550987",
    email: "carlos.ramirez@example.com",
    licenseNumber: "FL67890321",
    vehicleDetails: {
      make: "Ford",
      model: "Escape",
      year: 2019,
      plateNumber: "FL-9837",
      color: "Black"
    },
    isActive: true,
    workingHours: {
      start: "08:00",
      end: "22:00"
    },
    workingDays: ["tuesday", "thursday", "friday", "sunday"],
    rating: 4.5,
    totalRides: 110,
    currentLocation: {
      address: "Little Havana, Miami, FL",
      coordinates: {
        lat: 25.7650,
        lng: -80.2190
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 10,
      maxDuration: 25
    }
  },
  {
    name: "Ashley Moore",
    phone: "+13105550789",
    email: "ashley.moore@example.com",
    licenseNumber: "NY12349876",
    vehicleDetails: {
      make: "Nissan",
      model: "Altima",
      year: 2022,
      plateNumber: "NYC-2022",
      color: "Red"
    },
    isActive: true,
    workingHours: {
      start: "05:00",
      end: "17:00"
    },
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "saturday"],
    rating: 4.8,
    totalRides: 145,
    currentLocation: {
      address: "Brooklyn Heights, Brooklyn, NY",
      coordinates: {
        lat: 40.6959,
        lng: -73.9956
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 12,
      maxDuration: 27
    }
  },
  {
    name: "Derek Johnson",
    phone: "+12025550777",
    email: "derek.johnson@example.com",
    licenseNumber: "WA99887766",
    vehicleDetails: {
      make: "Chevrolet",
      model: "Bolt EV",
      year: 2023,
      plateNumber: "SEA-0912",
      color: "Blue"
    },
    isActive: true,
    workingHours: {
      start: "09:00",
      end: "20:00"
    },
    workingDays: ["wednesday", "thursday", "friday", "saturday", "sunday"],
    rating: 5.0,
    totalRides: 220,
    currentLocation: {
      address: "Capitol Hill, Seattle, WA",
      coordinates: {
        lat: 47.6225,
        lng: -122.3165
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 18,
      maxDuration: 32
    }
  }
];


async function seedDrivers() {
  try {
    // Connect to MongoDB using the database config
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    // Clear existing drivers (optional - uncomment if you want to reset)
    // await Driver.deleteMany({});
    // console.log('Cleared existing drivers');

    // Insert sample drivers
    for (const driverData of sampleDrivers) {
      const existingDriver = await Driver.findOne({ phone: driverData.phone });
      
      if (!existingDriver) {
        const driver = new Driver(driverData);
        await driver.save();
        console.log(`✅ Created driver: ${driver.name} (${driver.phone})`);
      } else {
        console.log(`ℹ️ Driver already exists: ${existingDriver.name} (${existingDriver.phone})`);
      }
    }

    console.log('🎉 Driver seeding completed!');
    
    // Display summary
    const totalDrivers = await Driver.countDocuments();
    const activeDrivers = await Driver.countDocuments({ isActive: true });
    
    console.log(`📊 Total drivers: ${totalDrivers}`);
    console.log(`✅ Active drivers: ${activeDrivers}`);
    
  } catch (error) {
    console.error('❌ Error seeding drivers:', error);
  }
}

// Run if called directly
if (require.main === module) {
  seedDrivers().then(() => {
    console.log('Seeding complete, closing connection...');
    mongoose.connection.close();
  });
}

module.exports = { seedDrivers, sampleDrivers }; 