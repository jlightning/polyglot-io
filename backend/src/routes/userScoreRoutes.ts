import express from 'express';
import { UserScoreService } from '../services/userScoreService';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Get user statistics (daily score and known words count) for the authenticated user
router.get('/getUserStats', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const result = await UserScoreService.getUserStats(userId);

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

export default router;
