import Settings from '../models/Settings.js';

// Get all settings
export const getSettings = async (req, res) => {
  try {
    const settings = await Settings.find();
    const settingsObj = {};
    
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
};

// Update settings
export const updateSettings = async (req, res) => {
  try {
    const settingsData = req.body;
    
    const updatePromises = Object.entries(settingsData).map(([key, value]) => {
      return Settings.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true }
      );
    });
    
    await Promise.all(updatePromises);
    
    const updatedSettings = await Settings.find();
    const settingsObj = {};
    updatedSettings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    
    res.json(settingsObj);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};




