const { checkCalendarConflicts, createCalendarEvent } = require('./core/calendarCore');
const { checkTimeOverlap } = require('./utils/timeUtils');

module.exports = {
  // Core functionality
  checkCalendarConflicts,
  createCalendarEvent,
  
  // Time utilities
  checkTimeOverlap
}; 