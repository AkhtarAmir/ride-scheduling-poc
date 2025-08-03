const moment = require('moment');

function parseTimeInput(input) {
  const cleanInput = input.toLowerCase().trim();
  
  // List of invalid inputs that should be rejected
  const invalidInputs = [
    'work', 'home', 'office', 'school', 'mall', 'airport',
    'restaurant', 'hotel', 'hospital', 'station', 'stop',
    'place', 'location', 'address', 'building', 'center',
    'park', 'shop', 'store', 'market', 'plaza'
  ];
  
  // Check if input is a location word instead of time
  if (invalidInputs.includes(cleanInput)) {
    throw new Error(`"${input}" appears to be a location, not a time. Please provide a time like "3pm", "tomorrow 9am", or "in 2 hours"`);
  }
  
  // Check if input is too short or doesn't contain time indicators
  if (cleanInput.length < 2 || (!cleanInput.match(/\d/) && !cleanInput.includes('now') && !cleanInput.includes('asap'))) {
    throw new Error(`Please provide a valid time format like "3pm", "tomorrow 9am", "in 2 hours", or "now"`);
  }
  
  // Handle "now" or "asap"
  if (cleanInput === 'now' || cleanInput === 'asap') {
    return moment().add(15, 'minutes').format('YYYY-MM-DD HH:mm');
  }
  
  // Handle "tomorrow"
  if (cleanInput.includes('tomorrow')) {
    const timeMatch = cleanInput.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const period = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
      
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      
      return moment().add(1, 'day').hour(hour).minute(minute).format('YYYY-MM-DD HH:mm');
    } else {
      throw new Error(`Could not understand "tomorrow" time. Please specify like "tomorrow 3pm" or "tomorrow 9:30am"`);
    }
  }
  
  // Handle "today"
  if (cleanInput.includes('today')) {
    const timeMatch = cleanInput.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const period = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
      
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      
      return moment().hour(hour).minute(minute).format('YYYY-MM-DD HH:mm');
    } else {
      throw new Error(`Could not understand "today" time. Please specify like "today 3pm" or "today 9:30am"`);
    }
  }
  
  // Handle "yesterday" - should be rejected
  if (cleanInput.includes('yesterday')) {
    throw new Error(`Cannot book rides for yesterday. Please provide a future time like "tomorrow 3pm" or "in 2 hours"`);
  }
  
  // Handle relative times
  const relativeMatch = cleanInput.match(/(\d+)\s*(hour|hr|minute|min)s?\s*(from now|later)?/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    const multiplier = unit.startsWith('h') ? 'hours' : 'minutes';
    return moment().add(amount, multiplier).format('YYYY-MM-DD HH:mm');
  }
  
  // Handle specific times (e.g., "3pm", "15:30")
  const timeMatch = cleanInput.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
    
    // Validate hour
    if (hour < 1 || hour > 24) {
      throw new Error(`Invalid hour "${hour}". Please use 1-12 with am/pm or 1-24 for 24-hour format`);
    }
    
    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    
    // If time is in the past, assume tomorrow
    const proposedTime = moment().hour(hour).minute(minute);
    if (proposedTime.isBefore(moment())) {
      proposedTime.add(1, 'day');
    }
    
    return proposedTime.format('YYYY-MM-DD HH:mm');
  }
  const dateTimeMatch = cleanInput.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (dateTimeMatch) {
    const year = parseInt(dateTimeMatch[1]);
    const month = parseInt(dateTimeMatch[2]);
    const day = parseInt(dateTimeMatch[3]);
    const hour = parseInt(dateTimeMatch[4]);
    const minute = parseInt(dateTimeMatch[5]);
    
    const dateTime = moment().year(year).month(month - 1).date(day).hour(hour).minute(minute);
    return dateTime.format('YYYY-MM-DD HH:mm');
  }
  
  // If we get here, the input couldn't be parsed
  throw new Error(`Could not understand "${input}". Please use formats like:\n• "3pm" or "15:30"\n• "tomorrow 9am"\n• "in 2 hours"\n• "now"`);
}


function parseDurationInput(input) {
  const cleanInput = input.toLowerCase().trim();
  
  // Handle "1 hour", "2 hours", etc.
  const hourMatch = cleanInput.match(/(\d+)\s*hour?s?/i);
  if (hourMatch) {
    return parseInt(hourMatch[1]) * 60;
  }
  
  // Handle "30 minutes", "45 mins", etc.
  const minuteMatch = cleanInput.match(/(\d+)\s*minute?s?/i);
  if (minuteMatch) {
    return parseInt(minuteMatch[1]);
  }
  
  // Handle just numbers (assume minutes)
  const numberMatch = cleanInput.match(/^(\d+)$/);
  if (numberMatch) {
    const num = parseInt(numberMatch[1]);
    // If number is > 12, assume minutes, otherwise assume hours
    return num > 12 ? num : num * 60;
  }
  
  // Default: 60 minutes
  return 60;
}

module.exports = {
  parseTimeInput,
  parseDurationInput
}; 