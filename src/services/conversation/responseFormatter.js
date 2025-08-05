function formatRideConfirmation(rideData, rideId, driverPhone) {
  return `✅ *Ride Confirmed!*

📍 *Pickup:* ${rideData.from}
🎯 *Destination:* ${rideData.to}
⏰ *Time:* ${rideData.time}
⏱️ *Duration:* ${rideData.estimatedDuration} minutes
📱 *Driver:* ${driverPhone}

*Ride ID:* ${rideId}

Your ride has been successfully booked!`;
}

function formatRideConfirmationWithRestart(rideData, rideId, driverPhone) {
  return `${formatRideConfirmation(rideData, rideId, driverPhone)}

Type 'restart' for a new booking.`;
}

function formatAlternativeDriverConfirmation(rideData, rideId, driverPhone) {
  return `✅ *Ride Confirmed with Alternative Driver!*

📍 *Pickup:* ${rideData.from}
🎯 *Destination:* ${rideData.to}
⏰ *Time:* ${rideData.time}
⏱️ *Duration:* ${rideData.estimatedDuration} minutes
📱 *Driver:* ${driverPhone}

*Ride ID:* ${rideId}

Your ride has been successfully booked with the alternative driver!`;
}

function formatAlternativeTimeConfirmation(rideData, rideId, driverPhone, time) {
  return `✅ *Ride Confirmed with Alternative Time!*

📍 *Pickup:* ${rideData.from}
🎯 *Destination:* ${rideData.to}
⏰ *Time:* ${time}
⏱️ *Duration:* ${rideData.estimatedDuration} minutes
📱 *Driver:* ${driverPhone}

*Ride ID:* ${rideId}

Your ride has been successfully booked for the alternative time!`;
}

function formatBookingError(message = 'Sorry, there was an error processing your ride request. Please try again.') {
  return `❌ *Booking Error*

${message}`;
}

function formatBookingErrorWithRestart(message = 'Sorry, there was an error processing your ride request. Please try again.') {
  return `${formatBookingError(message)}

Type 'restart' for a new booking.`;
}

function formatRideRejection(rideData, rejectionReason) {
  return `❌ *Ride Request Rejected*

📍 *Pickup:* ${rideData.from}
🎯 *Destination:* ${rideData.to}
⏰ *Time:* ${rideData.time}

*Reason:* ${rejectionReason}

Please try a different time or contact support.`;
}

function formatPickupLocationPrompt() {
  return "🚗 *New Ride Booking*\n\nWhere would you like to be picked up from?\n\n📍 Examples:\n🇵🇰 Pakistan: 'DHA Phase 5', 'Gulberg III', 'Emporium Mall Lahore'\n🇺🇸 US: 'Times Square NYC', 'LAX Airport', '123 Main St Chicago'";
}

function formatDestinationPrompt(pickup) {
  return `📍 *Pickup:* ${pickup}\n\nWhere would you like to go?\n\n🎯 Examples:\n🇵🇰 Pakistan: 'Liberty Market', 'Packages Mall', 'F-10 Markaz Islamabad'\n🇺🇸 US: 'Central Park NYC', 'Hollywood Blvd', '456 Oak Ave'`;
}

function formatTimePrompt(pickup, destination) {
  return `📍 *Pickup:* ${pickup}\n🎯 *Destination:* ${destination}\n\nWhen would you like to be picked up?\n\nExamples: "now", "3pm", "tomorrow 9am", "in 2 hours"`;
}

function formatDriverPrompt(pickup, destination, time, duration) {
  return `📍 *Pickup:* ${pickup}\n🎯 *Destination:* ${destination}\n⏰ *Time:* ${time}\n⏱️ *Estimated Duration:* ${duration || 60} minutes\n\nWhat's the driver's phone number?\n\n📱 Examples:\n🇵🇰 Pakistan: +923001234567 or 03001234567\n🇺🇸 US: +15551234567 or 5551234567`;
}

function formatTimeError(error, pickup, destination) {
  return `❌ ${error}\n\n📍 *Current booking:*\n• Pickup: ${pickup}\n• Destination: ${destination}\n\nPlease provide a valid time for your ride.`;
}

function formatInvalidLocationError(locationType) {
  const examples = locationType === 'pickup' 
    ? "Please provide a pickup location:\n🇵🇰 Pakistan: 'DHA Phase 5', 'Gulberg III', 'Airport'\n🇺🇸 US: 'Times Square', 'LAX Airport', '123 Main St'"
    : "Please provide a destination:\n🇵🇰 Pakistan: 'Liberty Market', 'Packages Mall', 'F-10 Markaz'\n🇺🇸 US: 'Central Park', 'Hollywood Blvd', '456 Oak Ave'";
    
  return `${examples}\n\nOr type 'help' for available commands.`;
}

function formatInvalidPhoneError() {
  return "Please provide a valid phone number:\n📱 Pakistan: +923001234567 or 03001234567\n📱 US: +15551234567 or 5551234567";
}

function formatInvalidTimeError() {
  return "I couldn't understand that time. Please try formats like 'now', '3pm', 'tomorrow 9am', or 'in 2 hours'";
}

function formatCompletedMessage() {
  return "Your ride request is being processed. You'll receive a confirmation shortly. Type 'restart' to book another ride.";
}

function formatGenericError() {
  return "Sorry, I encountered an error. Please try again or type 'restart' to start over.";
}

module.exports = {
  formatRideConfirmation,
  formatRideConfirmationWithRestart,
  formatAlternativeDriverConfirmation,
  formatAlternativeTimeConfirmation,
  formatBookingError,
  formatBookingErrorWithRestart,
  formatRideRejection,
  formatPickupLocationPrompt,
  formatDestinationPrompt,
  formatTimePrompt,
  formatDriverPrompt,
  formatTimeError,
  formatInvalidLocationError,
  formatInvalidPhoneError,
  formatInvalidTimeError,
  formatCompletedMessage,
  formatGenericError
}; 