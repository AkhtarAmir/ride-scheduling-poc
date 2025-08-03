const config = require("../../../config/vectorDB");

class DriverPreferences {
  constructor(vectorOperations) {
    this.vectorOperations = vectorOperations;
  }

  // Store driver preference as embedding
  async storeDriverPreference(phone, driverPhone, from, to, rideCount = 1, rating = 5) {
    try {
      if (!this.vectorOperations.isReady()) {
        throw new Error("Vector operations not initialized");
      }

      // Check if this preference already exists to avoid duplicates
      const existingDrivers = await this.findPreferredDrivers(phone, to, 1);
      const existingDriver = existingDrivers.find(d => d.driverPhone === driverPhone);
      
      if (existingDriver) {
        console.log(`🔄 Updating existing driver preference for ${phone} with driver ${driverPhone} (current rides: ${existingDriver.rideCount}, new rides: ${rideCount})`);
      } else {
        console.log(`➕ Storing new driver preference for ${phone} with driver ${driverPhone} (rides: ${rideCount})`);
      }

      // Create preference text for embedding
      const preferenceText = `User ${phone} prefers driver ${driverPhone} for rides from ${from} to ${to}. Used ${rideCount} times. Rating: ${rating}/5 stars.`;
      const embedding = await this.vectorOperations.generateEmbedding(preferenceText);

      const vectorId = `driver_pref_${phone}_${driverPhone}_${Date.now()}`;
      const metadata = {
        type: 'driver_preference',
        phone,
        driverPhone,
        from,
        to,
        rideCount,
        rating,
      };

      await this.vectorOperations.storeVector(vectorId, embedding, metadata);
      console.log(`✅ Stored driver preference for ${phone} with driver ${driverPhone}`);
      return vectorId;
    } catch (error) {
      console.error("❌ Failed to store driver preference:", error.message);
      throw error;
    }
  }

  // Enhanced driver preference finding
  async findPreferredDrivers(phone, to, minRides = 2) {
    try {
      if (!this.vectorOperations.isReady()) {
        return [];
      }

      // Use multiple search strategies
      const searchQueries = [
        `User ${phone} driver preferences destination ${to}`,
        `${phone} preferred driver ${to}`,
        `driver for ${to} user ${phone}`
      ];

      let allResults = [];

      for (const query of searchQueries) {
        const embedding = await this.vectorOperations.generateEmbedding(query);
        
        const results = await this.vectorOperations.queryVectors(embedding, {
          limit: 10,
          filter: { 
            type: { $eq: 'driver_preference' },
            phone: { $eq: phone }
          }
        });

        allResults.push(...results);
      }

      // Remove duplicates and process - use driver phone as unique key
      const uniqueDrivers = new Map();
      allResults.forEach(match => {
        const driverPhone = match.metadata.driverPhone;
        const existingDriver = uniqueDrivers.get(driverPhone);
        
        // Keep the driver with the highest ride count and score
        if (!existingDriver || 
            match.metadata.rideCount > existingDriver.rideCount ||
            (match.metadata.rideCount === existingDriver.rideCount && match.score > existingDriver.score)) {
          uniqueDrivers.set(driverPhone, {
            driverPhone: match.metadata.driverPhone,
            name: match.metadata.driverName || 'Unknown Driver',
            from: match.metadata.from,
            to: match.metadata.to,
            rideCount: match.metadata.rideCount || 1,
            rating: match.metadata.rating || 5,
            score: match.score,
            reason: `Used ${match.metadata.rideCount || 1} times for trips to ${match.metadata.to}`
          });
        }
      });

      const preferredDrivers = Array.from(uniqueDrivers.values())
        .filter(driver => driver.score >= 0.2) // Lower threshold
        .filter(driver => driver.rideCount >= minRides)
        .sort((a, b) => b.rideCount - a.rideCount || b.score - a.score);

      console.log(`📋 Found ${preferredDrivers.length} unique preferred drivers for ${phone} going to ${to}`);
      return preferredDrivers;
    } catch (error) {
      console.error("❌ Failed to find preferred drivers:", error.message);
      return [];
    }
  }

  // Check if user has preferred drivers for a destination
  async hasPreferredDrivers(phone, to, minRides = 3) {
    try {
      const drivers = await this.findPreferredDrivers(phone, to, minRides);
      return drivers.length > 0;
    } catch (error) {
      console.error("❌ Failed to check preferred drivers:", error.message);
      return false;
    }
  }

  // Record a completed ride to update preferences
  async recordRide(phone, driverPhone, from, to, success = true) {
    try {
      if (!this.vectorOperations.isReady()) {
        console.warn("Vector operations not initialized, skipping ride recording");
        return;
      }

      // Find existing preference to update ride count
      const existingDrivers = await this.findPreferredDrivers(phone, to, 1);
      const existingDriver = existingDrivers.find(d => d.driverPhone === driverPhone);
      
      const newRideCount = existingDriver ? existingDriver.rideCount + 1 : 1;
      
      // Store updated preference
      await this.storeDriverPreference(phone, driverPhone, from, to, newRideCount, 5);
      
      console.log(`✅ Recorded ride for ${phone} with driver ${driverPhone} (total rides: ${newRideCount})`);
    } catch (error) {
      console.error("❌ Failed to record ride:", error.message);
      // Don't fail the main flow if preference recording fails
    }
  }

  // Extract and store driver preferences when booking starts
  async extractAndStoreDriverPreferences(phone, message, conversationHistory = []) {
    try {
      if (!this.vectorOperations.isReady()) {
        return null;
      }

      // This would need the booking extractor, but we'll keep it simple for now
      // Extract booking data from conversation would be handled by BookingExtractor
      
      return null;
    } catch (error) {
      console.error("❌ Failed to extract and store driver preferences:", error.message);
      return null;
    }
  }

  // Update driver preferences when user expresses new preferences
  async updateDriverPreferences(phone, message, conversationHistory = []) {
    try {
      if (!this.vectorOperations.isReady()) {
        return null;
      }

      // Check if user is expressing a preference for a specific driver
      const preferenceKeywords = [
        'prefer', 'preferred', 'favorite', 'usual', 'same driver',
        'that driver', 'him', 'her', 'this driver', 'my driver'
      ];
      
      const messageLower = message.toLowerCase();
      const hasPreferenceKeyword = preferenceKeywords.some(keyword => 
        messageLower.includes(keyword)
      );
      
      if (!hasPreferenceKeyword) {
        return null;
      }

      // This would need the booking extractor to get context
      // For now, return null - this would be integrated with BookingExtractor
      return null;
    } catch (error) {
      console.error("❌ Failed to update driver preferences:", error.message);
      return null;
    }
  }

  // Clean up duplicate driver preferences
  async cleanupDuplicateDriverPreferences(phone) {
    try {
      if (!this.vectorOperations.isReady()) {
        throw new Error("Vector operations not initialized");
      }

      console.log(`🧹 Cleaning up duplicate driver preferences for ${phone}...`);

      // Get all driver preferences for this user
      const embedding = await this.vectorOperations.generateEmbedding(`User ${phone} driver preferences`);
      const allPreferences = await this.vectorOperations.queryVectors(embedding, {
        limit: 100,
        filter: { 
          type: { $eq: 'driver_preference' },
          phone: { $eq: phone }
        }
      });

      // Group by driver phone and keep only the best entry for each driver
      const driverGroups = new Map();
      
      allPreferences.forEach(match => {
        const driverPhone = match.metadata.driverPhone;
        const existing = driverGroups.get(driverPhone);
        
        if (!existing || 
            match.metadata.rideCount > existing.rideCount ||
            (match.metadata.rideCount === existing.rideCount && match.score > existing.score)) {
          driverGroups.set(driverPhone, match);
        }
      });

      // Find entries to delete (all except the best one for each driver)
      const entriesToDelete = allPreferences.filter(match => {
        const driverPhone = match.metadata.driverPhone;
        const bestEntry = driverGroups.get(driverPhone);
        return match.id !== bestEntry.id;
      });

      if (entriesToDelete.length > 0) {
        console.log(`🗑️ Found ${entriesToDelete.length} duplicate entries to delete`);
        
        // Delete duplicate entries
        const deleteIds = entriesToDelete.map(entry => entry.id);
        await this.vectorOperations.deleteVectorsByIds(deleteIds);
        
        console.log(`✅ Deleted ${deleteIds.length} duplicate driver preference entries`);
      } else {
        console.log(`✅ No duplicate entries found for ${phone}`);
      }

      return {
        totalEntries: allPreferences.length,
        uniqueDrivers: driverGroups.size,
        deletedEntries: entriesToDelete.length
      };
    } catch (error) {
      console.error("❌ Failed to cleanup duplicate driver preferences:", error.message);
      throw error;
    }
  }

  // Format driver suggestion message
  formatDriverSuggestion(drivers, to) {
    if (!drivers || drivers.length === 0) {
      return null;
    }
    
    const topDriver = drivers[0];
    
    let message = `🚗 *Driver Suggestion*\n\n`;
    message += `I see you're going to ${to}.\n\n`;
    message += `Would you like to use your preferred driver?\n`;
    message += `📱 *${topDriver.driverPhone}*\n`;
    message += `💡 ${topDriver.reason}\n`;
    
    if (drivers.length > 1) {
      message += `*Other options:*\n`;
      drivers.slice(1, 3).forEach((driver, index) => {
        message += `${index + 2}. ${driver.driverPhone} (${driver.reason})\n`;
      });
    }
    
    message += `\nReply with "yes" to use this driver, "no" for a different driver, or provide a driver number directly.`;
    
    return message;
  }
}

module.exports = DriverPreferences; 