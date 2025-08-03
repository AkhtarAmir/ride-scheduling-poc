function normalizePakistaniNumber(number) {
  console.log(`📞 Normalizing phone number: ${number}`);
  
  // Remove non-digit characters
  const cleanNumber = number.replace(/\D/g, '');
  console.log(`📞 Cleaned number (digits only): ${cleanNumber}`);

  // If it starts with '03', it's a local number — convert to international
  if (/^03\d{9}$/.test(cleanNumber)) {
    const normalized = `+92${cleanNumber.slice(1)}`;
    console.log(`📞 Converted local number to international: ${normalized}`);
    return normalized;
  }

  // If it starts with '92', prepend '+'
  if (/^92\d{10}$/.test(cleanNumber)) {
    const normalized = `+${cleanNumber}`;
    console.log(`📞 Added + prefix to country code: ${normalized}`);
    return normalized;
  }

  // If already starts with +92 and is valid (handle cases where + was already there)
  if (/^\+?92\d{10}$/.test(number)) {
    const normalized = number.startsWith('+') ? number : `+${number}`;
    console.log(`📞 Already valid international format: ${normalized}`);
    return normalized;
  }

  // Handle case where number already has + but digits were cleaned
  if (/^92\d{10}$/.test(cleanNumber)) {
    const normalized = `+${cleanNumber}`;
    console.log(`📞 Added + to cleaned number: ${normalized}`);
    return normalized;
  }

  console.error(`📞 Invalid Pakistani phone number format: ${number} (cleaned: ${cleanNumber})`);
  console.error(`📞 Expected formats: 03xxxxxxxxx, 92xxxxxxxxxx, or +92xxxxxxxxxx`);
  return null; // Invalid
}

module.exports = {
  normalizePakistaniNumber
}; 