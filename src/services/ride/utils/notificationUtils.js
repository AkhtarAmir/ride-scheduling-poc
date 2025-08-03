const moment = require('moment');
const { sendNotification } = require('../../notification');
const { clearConversationHistory } = require('../../conversation');

function generateAlternativeTimes(originalTime) {
  const original = moment(originalTime);
  const alternatives = [];
  
  // Generate times around the original time (±1 hour, ±2 hours, ±3 hours)
  const offsets = [-180, -120, -60, 60, 120, 180]; // in minutes
  
  offsets.forEach(offset => {
    const alternative = original.clone().add(offset, 'minutes');
    // Only include times that are in the future and reasonable hours (6 AM to 10 PM)
    const hour = alternative.hour();
    if (alternative.isAfter(moment()) && hour >= 6 && hour <= 22) {
      alternatives.push({
        time: alternative.format('YYYY-MM-DD HH:mm'),
        display: alternative.format('MMM DD, YYYY [at] h:mm A'),
        offset: offset
      });
    }
  });
  
  return alternatives.slice(0, 4); // Return top 4 alternatives
}

async function sendAutomatedNotifications(ride, conflictResult, conflictResolution) {
  try {
    const status = ride.status;
    const driverPhone = ride.driverPhone;
    const riderPhone = ride.riderPhone;
    
    if (status === "auto_accepted") {
      // Notify driver
      const driverMessage = `🚗 *New Ride Confirmed!*\n\n📍 *Pickup:* ${ride.from}\n🎯 *Destination:* ${ride.to}\n⏰ *Time:* ${moment(ride.requestedTime).format('MMM DD, YYYY h:mm A')}\n⏱️ *Duration:* ${ride.estimatedDuration} minutes\n📱 *Rider:* ${ride.riderPhone}\n\nRide ID: ${ride.rideId}`;
      await sendNotification(driverPhone, driverMessage);
      
      // Clear conversation history after successful booking
      try {
        await clearConversationHistory(riderPhone);
        console.log(`✅ Conversation history cleared for rider ${riderPhone} after successful booking`);
      } catch (clearError) {
        console.error(`❌ Failed to clear conversation history for rider ${riderPhone}:`, clearError.message);
      }
      
    } else if (status === "auto_rejected") {
      let rejectionMessage = `❌ *Ride Request Rejected*\n\n📍 *Pickup:* ${ride.from}\n🎯 *Destination:* ${ride.to}\n⏰ *Time:* ${moment(ride.requestedTime).format('MMM DD, YYYY h:mm A')}\n\n`;
      
      const rejectionReason = ride.rejectionReason || 'System error';
      
      if (rejectionReason === 'driver_conflict') {
        rejectionMessage += `*Reason:* Your driver has a conflicting appointment at this time.\n\n`;
        rejectionMessage += `*🔄 Resolution Options:*\n`;
        rejectionMessage += `1. Choose a different driver\n`;
        rejectionMessage += `2. Select a different time\n\n`;
        rejectionMessage += `Please reply with:\n`;
        rejectionMessage += `• A different driver's phone number, OR\n`;
        rejectionMessage += `• "different time" for alternative times`;
        
      } else if (rejectionReason === 'rider_conflict') {
        rejectionMessage += `*Reason:* You have a conflicting appointment at this time.\n\n`;
        rejectionMessage += `*🔄 Suggested Alternative Times:*\n`;
        const alternatives = generateAlternativeTimes(ride.requestedTime);
        alternatives.forEach((alt, index) => {
          rejectionMessage += `${index + 1}. ${alt.display}\n`;
        });
        rejectionMessage += `\nReply with your preferred time or suggest a different time.`;
        
      } else if (rejectionReason === 'driver_location') {
        rejectionMessage += `*Reason:* Driver is too far from your pickup location (max 10km allowed).\n\n`;
        rejectionMessage += `*🔄 Resolution:*\n`;
        rejectionMessage += `Please try a different driver who is closer to your location.\n\n`;
        rejectionMessage += `Reply with a different driver's phone number.`;
        
      } else {
        rejectionMessage += `*Reason:* ${rejectionReason.replace('_', ' ')}\n\n`;
        rejectionMessage += `Please try again with different details.`;
      }
      
      rejectionMessage += `\n\nType 'restart' to book a new ride.`;
      
      await sendNotification(riderPhone, rejectionMessage);
      
      // Clear conversation history after rejection to allow fresh start
      try {
        await clearConversationHistory(riderPhone);
        console.log(`✅ Conversation history cleared for rider ${riderPhone} after ride rejection`);
      } catch (clearError) {
        console.error(`❌ Failed to clear conversation history after rejection for rider ${riderPhone}:`, clearError.message);
      }
    }
    
  } catch (error) {
    console.error("Failed to send automated notifications:", error);
  }
}

module.exports = {
  generateAlternativeTimes,
  sendAutomatedNotifications
}; 