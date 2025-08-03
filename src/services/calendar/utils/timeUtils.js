const moment = require('moment');

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
  checkTimeOverlap
}; 