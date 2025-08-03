# Notification Service

This service handles all notification-related functionality including WhatsApp and SMS messaging.

## Directory Structure

```
notification/
├── core/                # Core notification functionality
│   └── notificationCore.js # Main notification operations
├── utils/              # Utility functions
│   └── phoneUtils.js   # Phone number handling utilities
└── index.js           # Service entry point
```

## Features

- WhatsApp message sending
- SMS fallback when WhatsApp fails
- Mock mode for testing
- Pakistani phone number normalization
- Error handling and logging
- Sandbox mode support

## Usage

```javascript
const notificationService = require('./services/notification');

// Send a notification (automatically chooses WhatsApp or SMS)
const result = await notificationService.sendNotification(
  '+923001234567',
  'Hello! Your ride has been confirmed.'
);

// Normalize a Pakistani phone number
const normalizedNumber = notificationService.normalizePakistaniNumber('03001234567');
// Returns: +923001234567
```

## Core Functions

### sendNotification(to, message)
Sends a notification message via WhatsApp with SMS fallback.

#### Parameters
- `to`: Phone number in any format (local or international)
- `message`: The message to send

#### Returns
```javascript
{
  success: true|false,
  sid?: string,        // Twilio message ID
  method?: 'whatsapp'|'sms',
  fallback?: boolean,  // true if SMS fallback was used
  mock?: boolean,      // true if mock mode was used
  error?: string       // error message if failed
}
```

## Utility Functions

### normalizePakistaniNumber(number)
Normalizes Pakistani phone numbers to international format.

#### Supported Formats
- Local: `03xxxxxxxxx`
- International: `92xxxxxxxxxx`
- International with plus: `+92xxxxxxxxxx`

#### Returns
- Normalized number with `+92` prefix
- `null` if invalid format

## Dependencies

- Twilio API
- Environment variables:
  - `TWILIO_PHONE_NUMBER`: WhatsApp-enabled Twilio number
  - `TWILIO_ACCOUNT_SID`: Twilio account SID
  - `TWILIO_AUTH_TOKEN`: Twilio auth token
  - `MOCK_TWILIO`: Set to true to use mock mode
  
## Error Handling

- WhatsApp sandbox errors (code: 63016)
- Rate limiting
- Invalid phone numbers
- Network issues
- API configuration errors

## Testing

Use `MOCK_TWILIO=true` environment variable to run in mock mode, which logs messages instead of sending them. 