import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { ctx } from './index';

const router = express.Router();

// Get all settings for authenticated user (optional languageCode for language-scoped settings e.g. DAILY_SCORE_TARGET)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const languageCode = req.query['languageCode'] as string | undefined;
    const settings = await ctx.userSettingService.getUserSettings(
      ctx,
      userId,
      languageCode
    );

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
    const { value, languageCode } = req.body;

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

    if (
      key === 'DAILY_SCORE_TARGET' &&
      (!languageCode ||
        typeof languageCode !== 'string' ||
        languageCode.trim() === '')
    ) {
      return res.status(400).json({
        success: false,
        message: 'languageCode is required for DAILY_SCORE_TARGET',
      });
    }

    const result = await ctx.userSettingService.setUserSetting(
      ctx,
      userId,
      key,
      value,
      key === 'DAILY_SCORE_TARGET' ? languageCode : undefined
    );

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
