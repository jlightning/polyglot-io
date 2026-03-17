import { Router, Request, Response } from 'express';
import { ctx } from './index';

const router = Router();

// Import words from LingQ
router.post('/lingq', async (req: Request, res: Response) => {
  try {
    const { apiKey, languageCode } = req.body;

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'LingQ API key is required',
      });
    }

    if (!languageCode || typeof languageCode !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Language code is required',
      });
    }

    const result = await ctx.lingqService.fetchAndImportFromLingQ(
      ctx,
      req.userId!,
      apiKey,
      languageCode
    );

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('LingQ import route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during import',
    });
  }
});

export default router;
