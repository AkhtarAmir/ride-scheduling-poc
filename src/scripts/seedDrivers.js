require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Driver = require('../models/driver');

const sampleDrivers = [
  {
    name: "Sophia Turner",
    phone: "+14155550888",
    email: "sophia.turner@example.com",
    licenseNumber: "CA99887711",
    vehicleDetails: { make: "Tesla", model: "Model Y", year: 2023, plateNumber: "EV-4567", color: "White" },
    isActive: true,
    workingHours: { start: "07:30", end: "19:30" },
    workingDays: ["monday", "tuesday", "wednesday", "friday"],
    rating: 4.9,
    totalRides: 185,
    currentLocation: { address: "Downtown Los Angeles, CA", coordinates: { lat: 34.0522, lng: -118.2437 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 20, maxDuration: 35 }
  },
  {
    name: "Marcus Lee",
    phone: "+13107770345",
    email: "marcus.lee@example.com",
    licenseNumber: "IL22334455",
    vehicleDetails: { make: "Toyota", model: "Highlander", year: 2021, plateNumber: "CHI-5567", color: "Gray" },
    isActive: true,
    workingHours: { start: "06:00", end: "18:00" },
    workingDays: ["tuesday", "wednesday", "thursday", "saturday"],
    rating: 4.6,
    totalRides: 140,
    currentLocation: { address: "South Loop, Chicago, IL", coordinates: { lat: 41.8576, lng: -87.6241 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 15, maxDuration: 28 }
  },
  {
    name: "Hannah Kim",
    phone: "+17145550123",
    email: "hannah.kim@example.com",
    licenseNumber: "TX33445566",
    vehicleDetails: { make: "Hyundai", model: "Sonata", year: 2020, plateNumber: "TXK-7788", color: "Blue" },
    isActive: true,
    workingHours: { start: "08:00", end: "20:00" },
    workingDays: ["monday", "wednesday", "friday", "sunday"],
    rating: 4.7,
    totalRides: 155,
    currentLocation: { address: "Downtown Dallas, TX", coordinates: { lat: 32.7767, lng: -96.7970 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 18, maxDuration: 32 }
  },
  {
    name: "Noah Williams",
    phone: "+12065550999",
    email: "noah.williams@example.com",
    licenseNumber: "WA44556677",
    vehicleDetails: { make: "Ford", model: "F-150", year: 2019, plateNumber: "SEA-7789", color: "Black" },
    isActive: true,
    workingHours: { start: "10:00", end: "22:00" },
    workingDays: ["thursday", "friday", "saturday", "sunday"],
    rating: 4.5,
    totalRides: 120,
    currentLocation: { address: "Fremont, Seattle, WA", coordinates: { lat: 47.6511, lng: -122.3502 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 12, maxDuration: 25 }
  },
  {
    name: "Isabella Garcia",
    phone: "+12135550077",
    email: "isabella.garcia@example.com",
    licenseNumber: "NY55667788",
    vehicleDetails: { make: "Honda", model: "Civic", year: 2022, plateNumber: "NYC-8899", color: "Red" },
    isActive: true,
    workingHours: { start: "05:30", end: "17:30" },
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "saturday"],
    rating: 5.0,
    totalRides: 200,
    currentLocation: { address: "Harlem, Manhattan, NY", coordinates: { lat: 40.8116, lng: -73.9465 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 14, maxDuration: 30 }
  },
  {
    name: "Ethan Brown",
    phone: "+14155551234",
    email: "ethan.brown@example.com",
    licenseNumber: "CA11223344",
    vehicleDetails: { make: "Chevrolet", model: "Malibu", year: 2021, plateNumber: "CA-4455", color: "Silver" },
    isActive: true,
    workingHours: { start: "07:00", end: "19:00" },
    workingDays: ["monday", "tuesday", "wednesday", "thursday"],
    rating: 4.6,
    totalRides: 132,
    currentLocation: { address: "Oakland, CA", coordinates: { lat: 37.8044, lng: -122.2711 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 17, maxDuration: 33 }
  },
  {
    name: "Olivia Chen",
    phone: "+16175550987",
    email: "olivia.chen@example.com",
    licenseNumber: "MA99887766",
    vehicleDetails: { make: "BMW", model: "X5", year: 2020, plateNumber: "BOS-2020", color: "Black" },
    isActive: true,
    workingHours: { start: "09:00", end: "21:00" },
    workingDays: ["monday", "wednesday", "friday", "saturday"],
    rating: 4.9,
    totalRides: 175,
    currentLocation: { address: "Back Bay, Boston, MA", coordinates: { lat: 42.3505, lng: -71.0810 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 13, maxDuration: 27 }
  },
  {
    name: "David Martinez",
    phone: "+17865550222",
    email: "david.martinez@example.com",
    licenseNumber: "FL44556677",
    vehicleDetails: { make: "Nissan", model: "Rogue", year: 2021, plateNumber: "MIA-9988", color: "Gray" },
    isActive: true,
    workingHours: { start: "06:00", end: "16:00" },
    workingDays: ["tuesday", "thursday", "friday", "sunday"],
    rating: 4.4,
    totalRides: 105,
    currentLocation: { address: "Brickell, Miami, FL", coordinates: { lat: 25.7617, lng: -80.1918 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 11, maxDuration: 24 }
  },
  {
    name: "Emma Davis",
    phone: "+13015550321",
    email: "emma.davis@example.com",
    licenseNumber: "DC22334455",
    vehicleDetails: { make: "Audi", model: "A4", year: 2022, plateNumber: "DC-3344", color: "White" },
    isActive: true,
    workingHours: { start: "07:00", end: "17:00" },
    workingDays: ["monday", "tuesday", "wednesday", "friday"],
    rating: 4.8,
    totalRides: 165,
    currentLocation: { address: "Georgetown, Washington, DC", coordinates: { lat: 38.9072, lng: -77.0369 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 16, maxDuration: 29 }
  },
  {
    name: "Lucas Silva",
    phone: "+13125550777",
    email: "lucas.silva@example.com",
    licenseNumber: "IL77889900",
    vehicleDetails: { make: "Kia", model: "Sportage", year: 2019, plateNumber: "CHI-4455", color: "Blue" },
    isActive: true,
    workingHours: { start: "08:00", end: "18:00" },
    workingDays: ["wednesday", "thursday", "friday", "saturday"],
    rating: 4.5,
    totalRides: 118,
    currentLocation: { address: "Lincoln Park, Chicago, IL", coordinates: { lat: 41.9214, lng: -87.6513 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 14, maxDuration: 26 }
  },
  {
    name: "Grace Wilson",
    phone: "+12135550987",
    email: "grace.wilson@example.com",
    licenseNumber: "NY88990011",
    vehicleDetails: { make: "Volkswagen", model: "Jetta", year: 2020, plateNumber: "NY-6677", color: "Green" },
    isActive: true,
    workingHours: { start: "06:30", end: "16:30" },
    workingDays: ["monday", "wednesday", "friday"],
    rating: 4.7,
    totalRides: 138,
    currentLocation: { address: "Queens, NY", coordinates: { lat: 40.7282, lng: -73.7949 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 15, maxDuration: 28 }
  },
  {
    name: "Daniel Rivera",
    phone: "+15015550099",
    email: "daniel.rivera@example.com",
    licenseNumber: "OR33445566",
    vehicleDetails: { make: "Mazda", model: "CX-5", year: 2021, plateNumber: "PDX-1122", color: "Silver" },
    isActive: true,
    workingHours: { start: "09:00", end: "19:00" },
    workingDays: ["tuesday", "thursday", "saturday", "sunday"],
    rating: 4.6,
    totalRides: 124,
    currentLocation: { address: "Pearl District, Portland, OR", coordinates: { lat: 45.5231, lng: -122.6765 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 12, maxDuration: 25 }
  },
  {
    name: "Mia Lopez",
    phone: "+17185551234",
    email: "mia.lopez@example.com",
    licenseNumber: "TX55667788",
    vehicleDetails: { make: "Toyota", model: "Corolla", year: 2022, plateNumber: "TX-2244", color: "White" },
    isActive: true,
    workingHours: { start: "07:00", end: "17:00" },
    workingDays: ["monday", "tuesday", "wednesday", "friday"],
    rating: 4.8,
    totalRides: 150,
    currentLocation: { address: "Downtown Houston, TX", coordinates: { lat: 29.7604, lng: -95.3698 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 18, maxDuration: 32 }
  },
  {
    name: "Jack Miller",
    phone: "+12025550155",
    email: "jack.miller@example.com",
    licenseNumber: "WA11224455",
    vehicleDetails: { make: "Ford", model: "Fusion", year: 2020, plateNumber: "SEA-3344", color: "Gray" },
    isActive: true,
    workingHours: { start: "06:00", end: "18:00" },
    workingDays: ["monday", "tuesday", "thursday", "saturday"],
    rating: 4.6,
    totalRides: 135,
    currentLocation: { address: "Bellevue, WA", coordinates: { lat: 47.6101, lng: -122.2015 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 14, maxDuration: 28 }
  },
  {
    name: "Charlotte Evans",
    phone: "+13105551234",
    email: "charlotte.evans@example.com",
    licenseNumber: "IL66778899",
    vehicleDetails: { make: "Hyundai", model: "Tucson", year: 2021, plateNumber: "CHI-7788", color: "Blue" },
    isActive: true,
    workingHours: { start: "09:00", end: "21:00" },
    workingDays: ["wednesday", "thursday", "friday", "sunday"],
    rating: 4.5,
    totalRides: 122,
    currentLocation: { address: "Hyde Park, Chicago, IL", coordinates: { lat: 41.7943, lng: -87.5907 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 13, maxDuration: 26 }
  },
  {
    name: "Benjamin Clark",
    phone: "+14155550199",
    email: "benjamin.clark@example.com",
    licenseNumber: "CA22334455",
    vehicleDetails: { make: "Honda", model: "Accord", year: 2019, plateNumber: "CA-7789", color: "Black" },
    isActive: true,
    workingHours: { start: "07:30", end: "17:30" },
    workingDays: ["tuesday", "thursday", "saturday"],
    rating: 4.7,
    totalRides: 147,
    currentLocation: { address: "San Jose, CA", coordinates: { lat: 37.3382, lng: -121.8863 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 16, maxDuration: 31 }
  },
  {
    name: "Amelia Wright",
    phone: "+16175550101",
    email: "amelia.wright@example.com",
    licenseNumber: "MA11223344",
    vehicleDetails: { make: "Subaru", model: "Forester", year: 2022, plateNumber: "BOS-5566", color: "Green" },
    isActive: true,
    workingHours: { start: "08:00", end: "18:00" },
    workingDays: ["monday", "wednesday", "friday", "sunday"],
    rating: 4.9,
    totalRides: 190,
    currentLocation: { address: "Cambridge, MA", coordinates: { lat: 42.3736, lng: -71.1097 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 15, maxDuration: 29 }
  },
  {
    name: "James Scott",
    phone: "+17865550999",
    email: "james.scott@example.com",
    licenseNumber: "FL77889900",
    vehicleDetails: { make: "Chevrolet", model: "Equinox", year: 2020, plateNumber: "MIA-3344", color: "White" },
    isActive: true,
    workingHours: { start: "10:00", end: "22:00" },
    workingDays: ["friday", "saturday", "sunday"],
    rating: 4.3,
    totalRides: 112,
    currentLocation: { address: "Coconut Grove, Miami, FL", coordinates: { lat: 25.7280, lng: -80.2374 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 12, maxDuration: 24 }
  },
  {
    name: "Ella Thompson",
    phone: "+13015550987",
    email: "ella.thompson@example.com",
    licenseNumber: "DC88990011",
    vehicleDetails: { make: "Toyota", model: "RAV4", year: 2021, plateNumber: "DC-7788", color: "Silver" },
    isActive: true,
    workingHours: { start: "06:30", end: "16:30" },
    workingDays: ["monday", "tuesday", "wednesday", "friday"],
    rating: 4.8,
    totalRides: 158,
    currentLocation: { address: "Capitol Hill, Washington, DC", coordinates: { lat: 38.8899, lng: -76.9940 }, lastUpdated: new Date() },
    serviceArea: { maxDistance: 17, maxDuration: 33 }
  }
]



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