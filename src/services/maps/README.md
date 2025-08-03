# Maps Service

This service handles all location-related functionality including distance calculations, geocoding, and location validation.

## Directory Structure

```
maps/
├── core/                # Core maps functionality
│   └── mapsCore.js     # Main maps operations
├── utils/              # Utility functions
│   └── validationUtils.js # Location validation utilities
└── index.js           # Service entry point
```

## Features

- Distance and duration calculations between locations
- Location validation and geocoding
- Reverse geocoding (coordinates to address)
- Location component validation
- Support for different location types (street address, landmarks, etc.)

## Usage

```javascript
const mapsService = require('./services/maps');

// Calculate distance between locations
const distance = await mapsService.calculateDistance(
  '123 Main St',
  '456 Oak Ave'
);

// Validate a location
const validation = await mapsService.validateLocationExists(
  '123 Main St, City'
);

// Reverse geocode coordinates
const address = await mapsService.reverseGeocode(
  37.7749,
  -122.4194
);

// Check if distance can be calculated
const canCalculate = await mapsService.canCalculateDistance(
  'Location A',
  'Location B'
);
```

## Core Functions

### calculateDistance(from, to)
Calculates the driving distance and duration between two locations.

### validateLocationExists(locationText)
Validates a location string and returns detailed information about its validity.

### reverseGeocode(latitude, longitude)
Converts coordinates to a human-readable address.

## Utility Functions

### validateLocationComponents(result)
Validates Google Maps API result components for location quality.

### canCalculateDistance(from, to)
Checks if distance calculation is possible between two locations.

## Dependencies

- Google Maps API
- Environment variables:
  - `GOOGLE_MAPS_API_KEY`: API key for Google Maps services
  - `GOOGLE_MAPS_COUNTRY_BIAS`: Default country bias for geocoding (optional)
  - `GOOGLE_MAPS_COUNTRY_CODE`: Country code filter for geocoding (optional) 