# Calendar Service

This service handles all calendar-related functionality including scheduling, conflict checking, and event management.

## Directory Structure

```
calendar/
├── core/                # Core calendar functionality
│   └── calendarCore.js # Main calendar operations
├── utils/              # Utility functions
│   └── timeUtils.js    # Time-related utilities
└── index.js           # Service entry point
```

## Features

- Calendar event creation
- Conflict checking for rides
- Time overlap detection
- Support for both driver and rider schedules
- Automatic event reminders

## Usage

```javascript
const calendarService = require('./services/calendar');

// Check for calendar conflicts
const conflicts = await calendarService.checkCalendarConflicts(
  '+923001234567', // driver phone
  '+923009876543', // rider phone
  new Date(),      // requested time
  60               // duration in minutes
);

// Create a calendar event for a ride
const eventId = await calendarService.createCalendarEvent({
  rideId: 'ride-123',
  driverPhone: '+923001234567',
  riderPhone: '+923009876543',
  from: '123 Main St',
  to: '456 Oak Ave',
  requestedTime: new Date(),
  estimatedDuration: 30
});

// Check if two time periods overlap
const hasOverlap = calendarService.checkTimeOverlap(
  moment('2024-01-01 10:00'),
  moment('2024-01-01 11:00'),
  moment('2024-01-01 10:30'),
  moment('2024-01-01 11:30')
);
```

## Core Functions

### checkCalendarConflicts(driverPhone, riderPhone, requestedTime, duration)
Checks for scheduling conflicts for both driver and rider.

#### Returns
```javascript
{
  hasConflict: boolean,
  rejectionReason: 'driver_conflict' | 'rider_conflict' | null,
  conflicts: Array<{
    type: 'driver' | 'rider' | 'both',
    phone: string,
    title: string,
    start: string,
    end: string,
    eventId: string,
    overlapDetails: {
      requestedStart: string,
      requestedEnd: string,
      eventStart: string,
      eventEnd: string
    }
  }>,
  summary: string,
  startTime: string,
  endTime: string
}
```

### createCalendarEvent(ride)
Creates a calendar event for a ride booking.

#### Parameters
- `ride`: Object containing ride details (rideId, driverPhone, riderPhone, from, to, requestedTime, estimatedDuration)

#### Returns
- Event ID from Google Calendar

## Utility Functions

### checkTimeOverlap(start1, end1, start2, end2)
Checks if two time periods overlap.

#### Parameters
- `start1`, `end1`: First time period (moment objects)
- `start2`, `end2`: Second time period (moment objects)

#### Returns
- `boolean`: True if periods overlap

## Dependencies

- Google Calendar API
- Environment variables:
  - `GOOGLE_CALENDAR_ID`: Calendar ID to use (defaults to 'primary')
  - Google API credentials (configured in google.js)
- Moment.js for time manipulation

## Error Handling

- Graceful fallback when calendar is not available
- Detailed error logging
- Conflict resolution suggestions
- Time zone handling (Asia/Karachi) 