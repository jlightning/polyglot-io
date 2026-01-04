import express from 'express';
import { UserSettingService } from '../services/userSettingService';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get all settings for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const settings = await UserSettingService.getUserSettings(userId);

    return res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error getting user settings:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Update a specific setting
router.put('/:key', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const { key } = req.params;
    const { value } = req.body;

    // Validate key
    const allowedKeys = ['DAILY_SCORE_TARGET'];
    if (!key || !allowedKeys.includes(key)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid setting key',
      });
    }

    if (!value) {
      return res.status(400).json({
        success: false,
        message: 'value is required in request body',
      });
    }

    const result = await UserSettingService.setUserSetting(userId, key, value);

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error updating user setting:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
