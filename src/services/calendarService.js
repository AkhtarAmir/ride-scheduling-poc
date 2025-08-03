const { calendar } = require('../config/google');
const moment = require('moment');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';


async function checkCalendarConflicts(driverPhone, riderPhone, requestedTime, duration = 60) {
  try {
    // Check if calendar is available
    if (!calendar) {
      console.warn('⚠️ Google Calendar not available, skipping conflict check');
      return {
        hasConflict: false,
        rejectionReason: null,
        conflicts: [],
        summary: 'Calendar not available - no conflicts detected',
        startTime: moment(requestedTime).toISOString(),
        endTime: moment(requestedTime).add(duration, 'minutes').toISOString()
      };
    }

    const startTime = moment(requestedTime);
    const endTime = moment(requestedTime).add(duration, 'minutes');
    
    const conflicts = [];
    let hasConflict = false;
    let rejectionReason = null;
    let hasDriverConflict = false;
    let hasRiderConflict = false;
    
    try {
    
      const searchStartTime = startTime.clone().subtract(2, 'hours'); 
      const searchEndTime = endTime.clone().add(2, 'hours');           
      
      const allEvents = await calendar.events.list({
        calendarId: CALENDAR_ID,
        timeMin: searchStartTime.toISOString(),
        timeMax: searchEndTime.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      if (allEvents.data.items && allEvents.data.items.length > 0) {
        allEvents.data.items.forEach(event => {
          const eventTitle = event.summary || 'Untitled Event';
          const eventDescription = event.description || '';
          
          const eventStart = moment(event.start.dateTime || event.start.date);
          const eventEnd = moment(event.end.dateTime || event.end.date);
          
          const hasTimeOverlap = checkTimeOverlap(startTime, endTime, eventStart, eventEnd);
          
          if (!hasTimeOverlap) {
            return; // Skip this event
          }
          
          const eventText = `${eventTitle} ${eventDescription}`.toLowerCase();
          
          // Check if driver is in event with proper validation
          let driverInEvent = false;
          if (driverPhone && typeof driverPhone === 'string' && driverPhone.trim()) {
            const driverPhoneLower = driverPhone.toLowerCase();
            driverInEvent = eventText.includes(driverPhoneLower) || 
                           (driverPhone.startsWith('+92') && eventText.includes(driverPhone.replace('+92', '0'))) ||
                           (driverPhone.length > 1 && eventText.includes(driverPhone.substring(1))); // Remove first character
          }
          
          // Check if rider is in event with proper validation
          let riderInEvent = false;
          if (riderPhone && typeof riderPhone === 'string' && riderPhone.trim()) {
            const riderPhoneLower = riderPhone.toLowerCase();
            riderInEvent = eventText.includes(riderPhoneLower) || 
                          (riderPhone.startsWith('+92') && eventText.includes(riderPhone.replace('+92', '0'))) ||
                          (riderPhone.length > 1 && eventText.includes(riderPhone.substring(1))); // Remove first character
          }
          
          if (driverInEvent && !riderInEvent) {
            hasDriverConflict = true;
            conflicts.push({
              type: 'driver',
              phone: driverPhone,
              title: eventTitle,
              start: event.start.dateTime || event.start.date,
              end: event.end.dateTime || event.end.date,
              eventId: event.id,
              overlapDetails: {
                requestedStart: startTime.format(),
                requestedEnd: endTime.format(),
                eventStart: eventStart.format(),
                eventEnd: eventEnd.format()
              }
            });
            
          } else if (riderInEvent && !driverInEvent) {
            hasRiderConflict = true;
            conflicts.push({
              type: 'rider',
              phone: riderPhone,
              title: eventTitle,
              start: event.start.dateTime || event.start.date,
              end: event.end.dateTime || event.end.date,
              eventId: event.id,
              overlapDetails: {
                requestedStart: startTime.format(),
                requestedEnd: endTime.format(),
                eventStart: eventStart.format(),
                eventEnd: eventEnd.format()
              }
            });
            
          } else if (driverInEvent && riderInEvent) {
            hasDriverConflict = true;
            hasRiderConflict = true;
            conflicts.push({
              type: 'both',
              phone: `${driverPhone},${riderPhone}`,
              title: eventTitle,
              start: event.start.dateTime || event.start.date,
              end: event.end.dateTime || event.end.date,
              eventId: event.id,
              overlapDetails: {
                requestedStart: startTime.format(),
                requestedEnd: endTime.format(),
                eventStart: eventStart.format(),
                eventEnd: eventEnd.format()
              }
            });
            
          } else {
          }
        });
      } else {  
      }
      
    } catch (calendarError) {
      console.error(`❌ Error checking calendar:`, calendarError.message);
    }
    
    if (hasDriverConflict || hasRiderConflict) {
      hasConflict = true;
      
      if (hasRiderConflict) {
        rejectionReason = 'rider_conflict';
      } else if (hasDriverConflict) {
        rejectionReason = 'driver_conflict';
      }
    } else {
      console.log(`✅ Final decision: NO CONFLICTS`);
    }
    
    const summary = conflicts.length > 0 
      ? `${conflicts.length} conflict(s) found: ${conflicts.map(c => `${c.type} - ${c.title} (overlapping)`).join(', ')}`
      : 'No conflicts found';
    
    console.log(`📋 Conflict summary: ${summary}`);
    
    return {
      hasConflict,
      rejectionReason,
      conflicts,
      summary,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    };
    
  } catch (error) {
    console.error('❌ Calendar conflict check failed:', error.message);
    console.error('Error details:', error);
    
    return {
      hasConflict: false,
      rejectionReason: null,
      conflicts: [],
      summary: `Calendar check failed: ${error.message}`,
      error: error.message,
      startTime: moment(requestedTime).toISOString(),
      endTime: moment(requestedTime).add(duration, 'minutes').toISOString()
    };
  }
}


async function createCalendarEvent(ride) {
  try {
    
    if (!calendar) {
      console.warn('⚠️ Google Calendar not available, skipping event creation');
      return null;
    }

    const startTime = moment(ride.requestedTime);
    const endTime = moment(ride.requestedTime).add(ride.estimatedDuration, 'minutes');
    
    const event = {
      summary: `Ride: ${ride.from} to ${ride.to}`,
      description: `Ride booking via WhatsApp\nRide ID: ${ride.rideId}\nDriver: ${ride.driverPhone}\nRider: ${ride.riderPhone}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Karachi',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Karachi',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 15 },
          { method: 'email', minutes: 30 }
        ],
      },
    };
    
    const response = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      resource: event,
    });
    
    
    return response.data.id;
    
  } catch (error) {
    console.error('❌ Failed to create calendar event:', error.message);
    console.error('Error details:', error);
    throw error;
  }
}

function checkTimeOverlap(start1, end1, start2, end2) { 
  const overlap = start1.isBefore(end2) && start2.isBefore(end1);
  
  if (overlap) { 
    const overlapStart = moment.max(start1, start2);
    const overlapEnd = moment.min(end1, end2);
    const overlapMinutes = overlapEnd.diff(overlapStart, 'minutes');
    
    console.log(`         Overlap Period: ${overlapStart.format()} to ${overlapEnd.format()} (${overlapMinutes} minutes)`);
    return true;
  }
  
  return overlap;
}


module.exports = {
  checkCalendarConflicts,
  createCalendarEvent,
  checkTimeOverlap
}; 