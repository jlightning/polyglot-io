import { Router, Request, Response } from 'express';
import { LingQService } from '../services/import/lingqService';

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

    const result = await LingQService.fetchAndImportFromLingQ(
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

// Validate LingQ API key
router.post('/lingq/validate', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'LingQ API key is required',
      });
    }

    const result = await LingQService.validateApiKey(apiKey);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('LingQ API key validation route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during validation',
    });
  }
});

// Get available languages from LingQ
router.get('/lingq/languages', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.query;

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'LingQ API key is required',
      });
    }

    const result = await LingQService.getAvailableLanguages(apiKey);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('LingQ languages route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error fetching languages',
    });
  }
});

export default router;
