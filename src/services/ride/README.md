# Ride Service

This service handles all ride-related functionality including booking, driver matching, location tracking, and notifications.

## Directory Structure

```
ride/
├── core/                # Core ride functionality
│   └── rideCore.js     # Main ride booking and status logic
├── utils/              # Utility functions
│   ├── driverUtils.js  # Driver-related utilities
│   ├── locationUtils.js # Location tracking and validation
│   └── notificationUtils.js # Notification handling
└── index.js           # Service entry point
```

## Features

- Ride booking and management
- Driver matching and scoring
- Location validation and tracking
- Automated notifications
- Calendar integration
- Conflict resolution

## Usage

```javascript
const rideService = require('./services/ride');

// Book a ride
const booking = await rideService.bookRide({
  driverPhone: '+1234567890',
  riderPhone: '+0987654321',
  from: '123 Main St',
  to: '456 Oak Ave',
  time: new Date(),
  estimatedDuration: 30
});

// Find nearest drivers
const drivers = await rideService.findNearestAvailableDrivers(
  'pickup location',
  new Date(),
  5 // max results
);

// Get ride status
const status = await rideService.getRideStatus('ride-123');
```

## Core Functions

### bookRide(rideData)
Books a new ride with validation and notifications.

### getRideStatus(rideId)
Gets the current status and details of a ride.

### findNearestAvailableDrivers(pickupLocation, requestedTime, maxResults)
Finds and scores available drivers near a location.

## Utility Functions

### Location Utils
- `validateDriverPickupDistance(driverPhone, pickupLocation, requestedTime)`
- `getDriverLastLocation(driverPhone)`
- `updateDriverLocation(driverPhone, newLocation)`

### Driver Utils
- `calculateDriverScore(distance, rating, totalRides)`
- `findNearestAvailableDrivers(pickupLocation, requestedTime, maxResults)`

### Notification Utils
- `generateAlternativeTimes(originalTime)`
- `sendAutomatedNotifications(ride, conflictResult, conflictResolution)`

## Dependencies

- Maps Service: For distance calculations
- Calendar Service: For scheduling and conflict checking
- Notification Service: For sending automated messages
- Vector DB Service: For driver preference tracking 