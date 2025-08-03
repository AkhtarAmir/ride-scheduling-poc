const { bookRideInternal } = require('../rideService');
const { calculateDistance } = require('../mapsService');
const { updateConversationStep } = require('./conversationCore');
const { 
  formatRideConfirmation,
  formatRideConfirmationWithRestart,
  formatAlternativeDriverConfirmation,
  formatAlternativeTimeConfirmation,
  formatBookingError,
  formatBookingErrorWithRestart,
  formatRideRejection
} = require('./responseFormatter');

async function bookRide(conversation, rideData) {
  try {
    const rideResult = await bookRideInternal({
      driverPhone: rideData.driverPhone,
      riderPhone: conversation.phone,
      from: rideData.from,
      to: rideData.to,
      time: rideData.time,
      estimatedDuration: rideData.estimatedDuration
    });

    if (rideResult.success) {
      if (rideResult.status === "auto_accepted") {
        return await handleSuccessfulBooking(conversation, rideData, rideResult);
      } else {
        return await handleBookingConflict(conversation, rideData, rideResult);
      }
    } else {
      return await handleBookingFailure(conversation, rideData, rideResult);
    }
  } catch (bookingError) {
    console.error('Ride booking error:', bookingError);
    const errorMessage = formatBookingError();
    await conversation.addMessage('assistant', errorMessage);
    return errorMessage;
  }
}

async function handleSuccessfulBooking(conversation, rideData, rideResult) {
  conversation.step = 'completed';
  conversation.rideData = {
    from: rideData.from,
    to: rideData.to,
    time: rideData.time,
    estimatedDuration: rideData.estimatedDuration,
    driverPhone: rideData.driverPhone
  };
  await conversation.save();

  console.log(`✅ Ride booked successfully for ${conversation.phone}, Ride ID: ${rideResult.rideId}`);

  const successMessage = formatRideConfirmation(rideData, rideResult.rideId, rideData.driverPhone);
  await conversation.addMessage('assistant', successMessage);
  return successMessage;
}

async function handleBookingConflict(conversation, rideData, rideResult) {
  if (rideResult.conflictResolution) {
    if (rideResult.conflictResolution.type === 'driver_conflict') {
      await updateConversationStep(conversation.phone, 'waiting_for_alternative_driver', {
        from: rideData.from,
        to: rideData.to,
        time: rideData.time,
        estimatedDuration: rideData.estimatedDuration,
        originalDriver: rideData.driverPhone,
        alternativeDrivers: rideResult.conflictResolution.alternativeDrivers,
        rideId: rideResult.rideId
      });
    } else if (rideResult.conflictResolution.type === 'rider_conflict') {
      await updateConversationStep(conversation.phone, 'waiting_for_alternative_time', {
        from: rideData.from,
        to: rideData.to,
        driverPhone: rideData.driverPhone,
        estimatedDuration: rideData.estimatedDuration,
        originalTime: rideData.time,
        suggestedTimes: rideResult.conflictResolution.suggestedTimes,
        rideId: rideResult.rideId
      });
    }
  }

  console.log(`⚠️ Conflict detected for ${conversation.phone}, waiting for resolution`);
  await conversation.addMessage('assistant', rideResult.message);
  return rideResult.message;
}

async function handleBookingFailure(conversation, rideData, rideResult) {
  conversation.step = 'completed';
  await conversation.save();
  
  console.error(`❌ Ride booking failed for ${conversation.phone}: ${rideResult.message}`);
  
  // Check if the ride service already sent a message to the user
  // If rejectionReason exists, it means bookRideInternal sent its own rejection message
  if (rideResult.rejectionReason) {
    console.log(`📢 Ride service already sent rejection message, skipping duplicate response`);
    await conversation.addMessage('assistant', `Booking handled by ride service`, { source: 'system' });
    return "__MESSAGE_ALREADY_HANDLED__";
  }
  
  // Only send our own message if the ride service didn't send one
  const errorMessage = formatBookingErrorWithRestart();
  await conversation.addMessage('assistant', errorMessage);
  return errorMessage;
}

async function bookWithAlternativeDriver(conversation, alternativeDriverPhone) {
  try {
    const alternativeRideResult = await bookRideInternal({
      driverPhone: alternativeDriverPhone,
      riderPhone: conversation.phone,
      from: conversation.rideData.from,
      to: conversation.rideData.to,
      time: conversation.rideData.time,
      estimatedDuration: conversation.rideData.estimatedDuration
    });

    if (alternativeRideResult.success && alternativeRideResult.status === "auto_accepted") {
      const response = formatAlternativeDriverConfirmation(
        conversation.rideData, 
        alternativeRideResult.rideId, 
        alternativeDriverPhone
      );

      await updateConversationStep(conversation.phone, 'completed', {
        from: conversation.rideData.from,
        to: conversation.rideData.to,
        time: conversation.rideData.time,
        estimatedDuration: conversation.rideData.estimatedDuration,
        driverPhone: alternativeDriverPhone
      });

      await conversation.addMessage('assistant', response);
      return response;
    } else {
      if (alternativeRideResult.conflictResolution) {
        return alternativeRideResult.message || "The alternative driver is also not available. Please try another driver.";
      } else {
        return "Sorry, there was an error booking with the alternative driver. Please try again.";
      }
    }
  } catch (bookingError) {
    console.error('Alternative driver booking error:', bookingError);
    return "Sorry, there was an error booking with the alternative driver. Please try again.";
  }
}

async function bookWithAlternativeTime(conversation, parsedTime) {
  try {
    const alternativeTimeRideResult = await bookRideInternal({
      driverPhone: conversation.rideData.driverPhone,
      riderPhone: conversation.phone,
      from: conversation.rideData.from,
      to: conversation.rideData.to,
      time: parsedTime,
      estimatedDuration: conversation.rideData.estimatedDuration
    });

    if (alternativeTimeRideResult.success && alternativeTimeRideResult.status === "auto_accepted") {
      const response = formatAlternativeTimeConfirmation(
        conversation.rideData, 
        alternativeTimeRideResult.rideId, 
        conversation.rideData.driverPhone,
        parsedTime
      );

      await updateConversationStep(conversation.phone, 'completed', {
        from: conversation.rideData.from,
        to: conversation.rideData.to,
        time: parsedTime,
        estimatedDuration: conversation.rideData.estimatedDuration,
        driverPhone: conversation.rideData.driverPhone
      });

      await conversation.addMessage('assistant', response);
      return response;
    } else {
      if (alternativeTimeRideResult.conflictResolution) {
        return alternativeTimeRideResult.message || "The alternative time also has conflicts. Please try another time.";
      } else {
        return "Sorry, there was an error booking for the alternative time. Please try again.";
      }
    }
  } catch (bookingError) {
    console.error('Alternative time booking error:', bookingError);
    return "Sorry, there was an error booking for the alternative time. Please try again.";
  }
}

module.exports = {
  bookRide,
  bookWithAlternativeDriver,
  bookWithAlternativeTime
}; 