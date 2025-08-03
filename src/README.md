# Twilio Ride Booking System - Organized Structure

This directory contains the reorganized codebase with a clean, modular architecture.

## Directory Structure

```
src/
├── config/           # Configuration files
│   ├── database.js   # MongoDB connection setup
│   ├── twilio.js     # Twilio client configuration
│   └── google.js     # Google Calendar & Maps setup
├── controllers/      # Request handlers
│   └── rideController.js
├── middleware/       # Express middleware
│   └── errorHandler.js
├── models/          # Database models
│   ├── Conversation.js
│   ├── Driver.js
│   ├── PendingConfirmation.js
│   ├── Ride.js
│   └── User.js
├── routes/          # API route definitions
│   └── rideRoutes.js
├── services/        # Business logic layer
│   ├── calendarService.js
│   ├── conversationService.js
│   ├── mapsService.js
│   ├── notificationService.js
│   └── rideService.js
├── utils/           # Utility functions
│   └── timeUtils.js
├── app.js           # Express app setup
└── server.js        # Server entry point
```

## Architecture Overview

### Separation of Concerns

1. **Config** - External service configurations (database, Twilio, Google)
2. **Controllers** - Handle HTTP requests and responses
3. **Services** - Business logic and external API interactions
4. **Models** - Database schemas and data validation
5. **Routes** - API endpoint definitions
6. **Middleware** - Request processing and error handling
7. **Utils** - Reusable utility functions

### Key Benefits

- **Maintainability** - Each file has a single responsibility
- **Testability** - Services can be easily unit tested
- **Scalability** - Easy to add new features without affecting existing code
- **Readability** - Clear separation makes code easier to understand
- **Reusability** - Services can be reused across different controllers

## Migration from Old Structure

The original `server.js` file (1189 lines) has been broken down into:

- **Database schemas** → `src/models/`
- **Business logic** → `src/services/`
- **API endpoints** → `src/controllers/` + `src/routes/`
- **Configuration** → `src/config/`
- **Utilities** → `src/utils/`

## Running the Application

```bash
# Development
npm run dev

# Production
npm start
```

The application maintains all original functionality while being much more organized and maintainable. 