const { googleMapsClient } = require('../config/google');

async function calculateDistance(from, to) {
  try {
    const response = await googleMapsClient.distancematrix({
      params: {
        origins: [from],
        destinations: [to],
        key: process.env.GOOGLE_MAPS_API_KEY,
        mode: 'driving',
        units: 'metric'
      }
    });

    if (response.data.rows[0].elements[0].status === 'OK') {
      const distance = response.data.rows[0].elements[0].distance.value / 1000; // Convert to km
      const duration = response.data.rows[0].elements[0].duration.value / 60; // Convert to minutes
      
      console.log(`Distance from ${from} to ${to}: ${distance}km, ${duration} minutes`);
      return { distance, duration };
    } else {
      console.warn(`Could not calculate distance from ${from} to ${to}`);
      return { distance: null, duration: null };
    }
  } catch (error) {
    console.error('Distance calculation failed:', error);
    return { distance: null, duration: null };
  }
}

async function validateLocationExists(locationText) {
  try {
    if (!googleMapsClient || !process.env.GOOGLE_MAPS_API_KEY) {
      console.warn('⚠️ Google Maps client or API key not available for location validation');
      return { 
        isValid: true, 
        reason: 'Validation skipped - API not available',
        formattedAddress: locationText 
      };
    }

    console.log(`🔍 Validating location exists: "${locationText}"`);

    // Quick validation for obviously incomplete locations
    const trimmed = locationText.trim().toLowerCase();
    
    // Too short
    if (trimmed.length < 3) {
      return {
        isValid: false,
        reason: 'Location too short - please provide more details',
        suggestion: 'Include street name, landmark, or building details'
      };
    }

    // Common incomplete patterns (generic, not region-specific)
    const incompletePatterns = [
      /^(kfc|mcdonald'?s?|starbucks|subway|dominos?|pizza hut|burger king|taco bell)$/i,
      /^(mall|hospital|airport|hotel|restaurant|school|office|bank|gym|park|mosque|church|temple)$/i,
      /^(downtown|uptown|center|near|close|opposite|main|central)$/i,
      /^(fake|test|random|nowhere|example|abc|xyz).*$/i
    ];

    const isIncomplete = incompletePatterns.some(pattern => pattern.test(trimmed));
    
    if (isIncomplete) {
      return {
        isValid: false,
        reason: 'Location too vague - please provide complete address',
        suggestion: `Try: "${locationText} [Street Address], [City]"`
      };
    }

    const response = await googleMapsClient.geocode({
      params: {
        address: locationText,
        key: process.env.GOOGLE_MAPS_API_KEY,
        region: process.env.GOOGLE_MAPS_COUNTRY_BIAS || 'US',
        language: 'en',
        components: process.env.GOOGLE_MAPS_COUNTRY_CODE ? {
          country: process.env.GOOGLE_MAPS_COUNTRY_CODE
        } : undefined
      }
    });

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      const components = result.address_components || [];
      const types = result.types || [];
      
      // Enhanced validation using address components (Address Line 1, 2, 3 approach)
      let confidence = 0.1;
      let isValid = false;
      let reason = '';
      let locationType = 'unknown';

      // Helper function to get component by type
      const getComponent = (type) => {
        const comp = components.find(c => c.types.includes(type));
        return comp ? comp.long_name : null;
      };

      const streetNumber = getComponent('street_number');
      const route = getComponent('route');
      const neighborhood = getComponent('neighborhood') || getComponent('sublocality') || getComponent('sublocality_level_1');
      const locality = getComponent('locality') || getComponent('administrative_area_level_2');
      const establishment = getComponent('establishment');
      const pointOfInterest = getComponent('point_of_interest');

      // Address Line 1: Street level validation (most specific)
      if (streetNumber && route) {
        confidence = 0.9;
        locationType = 'street_address';
        isValid = true;
        reason = 'Complete street address found';
      }
      // Address Line 2: Establishment/Landmark with context
      else if (establishment || pointOfInterest) {
        confidence = 0.6;
        locationType = 'establishment';
        
        // Check if establishment has location context
        const hasContext = neighborhood || locality || route || 
                          locationText.split(' ').length >= 3;
        
        if (hasContext) {
          confidence = 0.7;
          isValid = true;
          reason = 'Specific business/landmark location found';
        } else {
          isValid = false;
          reason = 'Business found but location too vague - please add area/street details';
        }
      }
      // Address Line 3: Area with street reference
      else if (route && (neighborhood || locality)) {
        confidence = 0.6;
        locationType = 'neighborhood';
        isValid = true;
        reason = 'Area with street reference found';
      }
      // Major landmarks/institutions
      else if (types.includes('hospital') || types.includes('shopping_mall') || 
               types.includes('airport') || types.includes('university') ||
               types.includes('transit_station') || types.includes('school')) {
        confidence = 0.7;
        locationType = 'landmark';
        isValid = true;
        reason = 'Major landmark suitable for ride booking';
      }
      // Just city/large area (reject)
      else if (locality && !neighborhood && !route && !establishment) {
        confidence = 0.1;
        locationType = 'city_only';
        isValid = false;
        reason = 'Only city found - please provide specific area, street, or landmark';
      }
      // Approximate location (low confidence)
      else if (result.geometry.location_type === 'APPROXIMATE') {
        confidence = 0.3;
        locationType = 'approximate';
        isValid = false;
        reason = 'Location too approximate - please provide more specific details';
      }
      else {
        confidence = 0.4;
        isValid = false;
        reason = 'Location found but not specific enough for pickup/dropoff';
      }

      console.log(`✅ Location validation result: ${isValid ? 'Valid' : 'Invalid'} (${(confidence * 100).toFixed(1)}% confidence)`);
      console.log(`📍 Formatted: ${result.formatted_address}`);
      
      return {
        isValid: isValid,
        formattedAddress: result.formatted_address,
        coordinates: {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        },
        placeId: result.place_id,
        types: result.types,
        confidence: confidence,
        locationType: locationType,
        reason: reason,
        suggestion: !isValid ? `Try: "${locationText} [Street Address], [City]"` : null,
        // Include information about multiple results
        isAmbiguous: response.data.results.length > 1,
        totalResults: response.data.results.length,
        alternativeLocations: response.data.results.length > 1 ? 
          response.data.results.slice(1, 3).map(alt => ({
            formattedAddress: alt.formatted_address,
            coordinates: {
              lat: alt.geometry.location.lat,
              lng: alt.geometry.location.lng
            },
            placeId: alt.place_id
          })) : []
      };
    } else {
      console.log(`❌ Location not found: ${locationText} (Status: ${response.data.status})`);
      return {
        isValid: false,
        reason: `Location "${locationText}" not found in map database`,
        suggestion: 'Please check spelling or provide more details',
        status: response.data.status
      };
    }
  } catch (error) {
    console.error(`❌ Error validating location "${locationText}":`, error.message);
    
    // Handle rate limits gracefully
    if (error.response && error.response.status === 429) {
      console.warn('⚠️ Google Maps API rate limit reached');
      return {
        isValid: true,
        reason: 'Rate limit reached - allowing location',
        warning: 'Could not validate due to API limits',
        formattedAddress: locationText
      };
    }
    
    // Graceful fallback for other errors
    return {
      isValid: true,
      reason: 'Validation failed - allowing location',
      error: error.message,
      formattedAddress: locationText
    };
  }
}

async function reverseGeocode(latitude, longitude) {
  try {
    if (!googleMapsClient || !process.env.GOOGLE_MAPS_API_KEY) {
      console.warn('⚠️ Google Maps client or API key not available for reverse geocoding');
      return { 
        success: false, 
        address: `Location: ${latitude}, ${longitude}`,
        reason: 'Google Maps API not available' 
      };
    }

    console.log(`🗺️ Reverse geocoding coordinates: ${latitude}, ${longitude}`);

    const response = await googleMapsClient.reverseGeocode({
      params: {
        latlng: [latitude, longitude],
        key: process.env.GOOGLE_MAPS_API_KEY,
        language: 'en',
        result_type: ['street_address', 'route', 'neighborhood', 'political']
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      const formattedAddress = result.formatted_address;
      
      console.log(`✅ Reverse geocoding successful: ${formattedAddress}`);
      
      return {
        success: true,
        address: formattedAddress,
        coordinates: { latitude, longitude },
        placeId: result.place_id,
        addressComponents: result.address_components
      };
    } else {
      console.log(`⚠️ No results found for coordinates: ${latitude}, ${longitude}`);
      return {
        success: false,
        address: `Location: ${latitude}, ${longitude}`,
        reason: 'No address found for these coordinates'
      };
    }

  } catch (error) {
    console.error('❌ Reverse geocoding failed:', error.message);
    return {
      success: false,
      address: `Location: ${latitude}, ${longitude}`,
      reason: error.message
    };
  }
}

async function canCalculateDistance(from, to) {
  try {
    const result = await calculateDistance(from, to);
    return {
      canCalculate: result.distance !== null && result.duration !== null,
      distance: result.distance,
      duration: result.duration
    };
  } catch (error) {
    return {
      canCalculate: false,
      error: error.message
    };
  }
}

module.exports = {
  calculateDistance,
  validateLocationExists,
  canCalculateDistance,
  reverseGeocode
};