function validateLocationComponents(result) {
  const components = result.address_components || [];
  const types = result.types || [];
  
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

  let confidence = 0.1;
  let isValid = false;
  let reason = '';
  let locationType = 'unknown';

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
                      result.formatted_address.split(' ').length >= 3;
    
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

  return {
    isValid,
    confidence,
    locationType,
    reason,
    suggestion: !isValid ? `Try adding more location details like street name or nearby landmarks` : null
  };
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
  validateLocationComponents,
  canCalculateDistance
}; 