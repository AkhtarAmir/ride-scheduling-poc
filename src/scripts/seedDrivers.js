require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Driver = require('../models/driver');

// Sample drivers for testing
const sampleDrivers = [
  {
    name: "Amara Sohail",
    phone: "+923047235356",
    email: "amara.sohail@example.com",
    licenseNumber: "LIC111233",
    vehicleDetails: {
      make: "Suzuki",
      model: "Alto",
      year: 2022,
      plateNumber: "JKL-001",
      color: "Grey"
    },
    isActive: true,
    workingHours: {
      start: "08:00",
      end: "18:00"
    },
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    rating: 4.5,
    totalRides: 90,
    currentLocation: {
      address: "Gulberg II, Lahore",
      coordinates: {
        lat: 31.5060,
        lng: 74.3180
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 8,
      maxDuration: 20
    }
  },
  {
    name: "Zain Ali",
    phone: "+923041112233",
    email: "zain.ali@example.com",
    licenseNumber: "LIC112233",
    vehicleDetails: {
      make: "Suzuki",
      model: "Alto",
      year: 2022,
      plateNumber: "JKL-001",
      color: "Grey"
    },
    isActive: true,
    workingHours: {
      start: "08:00",
      end: "18:00"
    },
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    rating: 4.5,
    totalRides: 90,
    currentLocation: {
      address: "Gulberg II, Lahore",
      coordinates: {
        lat: 31.5300,
        lng: 74.3560
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 8,
      maxDuration: 20
    }
  },
  {
    name: "Sara Naveed",
    phone: "+923042224455",
    email: "sara.naveed@example.com",
    licenseNumber: "LIC224455",
    vehicleDetails: {
      make: "Toyota",
      model: "Yaris",
      year: 2021,
      plateNumber: "MNO-002",
      color: "White"
    },
    isActive: true,
    workingHours: {
      start: "09:00",
      end: "19:00"
    },
    workingDays: ["tuesday", "wednesday", "thursday", "saturday"],
    rating: 4.8,
    totalRides: 140,
    currentLocation: {
      address: "Johar Town Phase 1, Lahore",
      coordinates: {
        lat: 31.4705,
        lng: 74.2750
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 7,
      maxDuration: 18
    }
  },
  {
    name: "Usman Tariq",
    phone: "+923043336677",
    email: "usman.tariq@example.com",
    licenseNumber: "LIC336677",
    vehicleDetails: {
      make: "Honda",
      model: "Civic",
      year: 2018,
      plateNumber: "PST-303",
      color: "Black"
    },
    isActive: true,
    workingHours: {
      start: "06:00",
      end: "20:00"
    },
    workingDays: ["monday", "wednesday", "friday", "sunday"],
    rating: 4.6,
    totalRides: 180,
    currentLocation: {
      address: "Iqbal Town, Lahore",
      coordinates: {
        lat: 31.5060,
        lng: 74.3180
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 9,
      maxDuration: 25
    }
  },
  {
    name: "Laiba Ahmed",
    phone: "+923045556677",
    email: "laiba.ahmed@example.com",
    licenseNumber: "LIC556677",
    vehicleDetails: {
      make: "Nissan",
      model: "Dayz",
      year: 2020,
      plateNumber: "XYZ-909",
      color: "Blue"
    },
    isActive: true,
    workingHours: {
      start: "07:30",
      end: "21:00"
    },
    workingDays: ["monday", "tuesday", "thursday", "friday", "saturday"],
    rating: 4.7,
    totalRides: 105,
    currentLocation: {
      address: "DHA Phase 5, Lahore",
      coordinates: {
        lat: 31.4620,
        lng: 74.4060
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 6,
      maxDuration: 15
    }
  },
  {
    name: "Ali Raza",
    phone: "+923046667788",
    email: "ali.raza@example.com",
    licenseNumber: "LIC667788",
    vehicleDetails: {
      make: "Changan",
      model: "Alsvin",
      year: 2023,
      plateNumber: "LHR-4567",
      color: "Silver"
    },
    isActive: true,
    workingHours: {
      start: "05:00",
      end: "17:00"
    },
    workingDays: ["sunday", "monday", "tuesday", "wednesday"],
    rating: 4.9,
    totalRides: 160,
    currentLocation: {
      address: "Gulberg III, Lahore",
      coordinates: {
        lat: 31.5240,
        lng: 74.3565
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 10,
      maxDuration: 22
    }
  },  
  {
    name: "Ahmed Hassan",
    phone: "+923001234567",
    email: "ahmed.hassan@example.com",
    licenseNumber: "LIC001234",
    vehicleDetails: {
      make: "Toyota",
      model: "Corolla",
      year: 2020,
      plateNumber: "ABC-123",
      color: "White"
    },
    isActive: true,
    workingHours: {
      start: "07:00",
      end: "22:00"
    },
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
    rating: 4.8,
    totalRides: 150,
    currentLocation: {
      address: "DHA Phase 2, Lahore",
      coordinates: {
        lat: 31.4504,
        lng: 74.4027
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 15,
      maxDuration: 25
    }
  },
  {
    name: "Muhammad Hanan",
    phone: "+9230098763543",
    email: "hanan.muhammad@example.com",
    licenseNumber: "LIC00562378",
    vehicleDetails: {
      make: "Honda",
      model: "City",
      year: 2021,
      plateNumber: "XYZ-4562",
      color: "Silver"
    },
    isActive: true,
    workingHours: {
      start: "06:00",
      end: "20:00"
    },
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    rating: 4.9,
    totalRides: 200,
    currentLocation: {
      address: "Gulberg III, Lahore",
      coordinates: {
        lat: 31.5204,
        lng: 74.3587
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 8,
      maxDuration: 30
    }
  },
  {
    name: "Fatima Khan",
    phone: "+923016413233",
    email: "fatima.khan@example.com",
    licenseNumber: "LIC009876",
    vehicleDetails: {
      make: "Suzuki",
      model: "Swift",
      year: 2019,
      plateNumber: "PQR-789",
      color: "Red"
    },
    isActive: true,
    workingHours: {
      start: "08:00",
      end: "21:00"
    },
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    rating: 4.7,
    totalRides: 120,
    currentLocation: {
      address: "Johar Town, Lahore",
      coordinates: {
        lat: 31.4697,
        lng: 74.2728
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 12,
      maxDuration: 20
    }
  },
  {
    name: "Hassan Sheikh",
    phone: "+923025555444",
    email: "hassan.sheikh@example.com",
    licenseNumber: "LIC555444",
    vehicleDetails: {
      make: "Hyundai",
      model: "Elantra",
      year: 2022,
      plateNumber: "DEF-321",
      color: "Black"
    },
    isActive: true,
    workingHours: {
      start: "05:00",
      end: "23:00"
    },
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    rating: 5.0,
    totalRides: 300,
    currentLocation: {
      address: "Model Town, Lahore",
      coordinates: {
        lat: 31.4824,
        lng: 74.3371
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 25,
      maxDuration: 35
    }
  },
  {
    name: "Aisha Malik",
    phone: "+923018765432",
    email: "aisha.malik@example.com",
    licenseNumber: "LIC876543",
    vehicleDetails: {
      make: "KIA",
      model: "Picanto",
      year: 2020,
      plateNumber: "GHI-654",
      color: "Blue"
    },
    isActive: true,
    workingHours: {
      start: "09:00",
      end: "19:00"
    },
    workingDays: ["tuesday", "wednesday", "thursday", "friday", "saturday"],
    rating: 4.6,
    totalRides: 85,
    currentLocation: {
      address: "Iqbal Town, Lahore",
      coordinates: {
        lat: 31.5055,
        lng: 74.3176
      },
      lastUpdated: new Date()
    },
    serviceArea: {
      maxDistance: 10,
      maxDuration: 18
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