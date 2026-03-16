import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { ctx } from './index';

const router = express.Router();

// Get user statistics (user score and known words count) for the authenticated user
router.get('/getUserStats', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const languageCode = req.query['languageCode'] as string;
    const timezone = req.query['timezone'] as string | undefined;

    if (!languageCode) {
      return res.status(400).json({
        success: false,
        message: 'languageCode parameter is required',
      });
    }

    const result = await ctx.userScoreService.getUserStats(
      ctx,
      userId,
      languageCode,
      undefined,
      timezone
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error getting user statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get user score history for the last 7 days
router.get('/getScoreHistory', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const languageCode = req.query['languageCode'] as string;
    const timezone = req.query['timezone'] as string | undefined;

    if (!languageCode) {
      return res.status(400).json({
        success: false,
        message: 'languageCode parameter is required',
      });
    }

    const result = await ctx.userScoreService.getScoreHistory(
      ctx,
      userId,
      languageCode,
      timezone
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error getting score history:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
