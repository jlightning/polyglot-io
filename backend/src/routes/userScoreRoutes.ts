import express from 'express';
import { UserScoreService } from '../services/userScoreService';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get today's score for the authenticated user
router.get('/daily', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const result = await UserScoreService.getDailyScore(userId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error getting daily score:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
