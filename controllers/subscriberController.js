import Subscriber from '../models/Subscriber.js';

// Create a new subscriber
export const createSubscriber = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and phone are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Validate phone format (10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    const cleanPhone = phone.replace(/\s/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit phone number'
      });
    }

    // Check if subscriber already exists
    const existingSubscriber = await Subscriber.findOne({
      $or: [
        { email: email.toLowerCase() },
        { phone: cleanPhone }
      ]
    });

    if (existingSubscriber) {
      // If subscriber exists but is inactive, reactivate them
      if (!existingSubscriber.isActive) {
        existingSubscriber.isActive = true;
        existingSubscriber.name = name; // Update name in case it changed
        await existingSubscriber.save();
        return res.status(200).json({
          success: true,
          message: 'Subscription reactivated successfully',
          data: existingSubscriber
        });
      }
      
      return res.status(409).json({
        success: false,
        message: 'You are already subscribed with this email or phone number'
      });
    }

    // Create new subscriber
    const subscriber = new Subscriber({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: cleanPhone
    });

    await subscriber.save();

    res.status(201).json({
      success: true,
      message: 'Subscription successful',
      data: subscriber
    });
  } catch (error) {
    console.error('Error creating subscriber:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You are already subscribed with this email or phone number'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating subscription',
      error: error.message
    });
  }
};

// Get all subscribers (admin only - can be protected later)
export const getSubscribers = async (req, res) => {
  try {
    const { page = 1, limit = 50, isActive } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const subscribers = await Subscriber.find(query)
      .sort({ subscribedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Subscriber.countDocuments(query);

    res.status(200).json({
      success: true,
      data: subscribers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching subscribers',
      error: error.message
    });
  }
};

// Check if subscriber exists
export const checkSubscriber = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone is required'
      });
    }

    const query = {};
    if (email) {
      query.email = email.toLowerCase().trim();
    }
    if (phone) {
      query.phone = phone.replace(/\s/g, '');
    }

    const subscriber = await Subscriber.findOne({
      $or: [
        ...(email ? [{ email: email.toLowerCase().trim() }] : []),
        ...(phone ? [{ phone: phone.replace(/\s/g, '') }] : [])
      ],
      isActive: true
    });

    if (subscriber) {
      return res.status(200).json({
        success: true,
        exists: true,
        subscriber: {
          name: subscriber.name,
          email: subscriber.email,
          phone: subscriber.phone
        }
      });
    }

    return res.status(200).json({
      success: true,
      exists: false
    });
  } catch (error) {
    console.error('Error checking subscriber:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking subscriber',
      error: error.message
    });
  }
};

// Unsubscribe (soft delete)
export const unsubscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const subscriber = await Subscriber.findOne({ email: email.toLowerCase() });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Subscriber not found'
      });
    }

    subscriber.isActive = false;
    await subscriber.save();

    res.status(200).json({
      success: true,
      message: 'Unsubscribed successfully'
    });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({
      success: false,
      message: 'Error unsubscribing',
      error: error.message
    });
  }
};

