import { Router, Request, Response } from 'express';
import { WordService } from '../services/wordService';

const router = Router();

// Create or update word user mark
router.post('/mark', async (req: Request, res: Response) => {
  try {
    const { word, languageCode, note, mark } = req.body;

    if (!word || !languageCode || mark === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Word, language code, and mark are required',
      });
    }

    if (typeof mark !== 'number' || mark < 0 || mark > 5) {
      return res.status(400).json({
        success: false,
        message: 'Mark must be a number between 0 and 5',
      });
    }

    const result = await WordService.createOrUpdateWordUserMark(req.userId!, {
      word,
      languageCode,
      note: note || '',
      mark,
    });

    if (result.success) {
      return res.status(result.data ? 200 : 201).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create/update word mark route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get word user mark
router.get('/mark/:word/:languageCode', async (req: Request, res: Response) => {
  try {
    const { word, languageCode } = req.params;

    if (!word || !languageCode) {
      return res.status(400).json({
        success: false,
        message: 'Word and language code are required',
      });
    }

    const result = await WordService.getWordUserMark(
      req.userId!,
      decodeURIComponent(word),
      languageCode
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get word mark route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Delete word user mark
router.delete(
  '/mark/:word/:languageCode',
  async (req: Request, res: Response) => {
    try {
      const { word, languageCode } = req.params;

      if (!word || !languageCode) {
        return res.status(400).json({
          success: false,
          message: 'Word and language code are required',
        });
      }

      const result = await WordService.deleteWordUserMark(
        req.userId!,
        decodeURIComponent(word),
        languageCode
      );

      if (result.success) {
        return res.json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Delete word mark route error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

// Get all user word marks with pagination
router.get('/marks', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 50;

    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid pagination parameters. Page must be >= 1, limit must be 1-100',
      });
    }

    const result = await WordService.getUserWordMarks(req.userId!, page, limit);

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get user word marks route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get bulk word marks
router.post('/marks/bulk', async (req: Request, res: Response) => {
  try {
    const { words, languageCode } = req.body;

    if (!words || !Array.isArray(words) || !languageCode) {
      return res.status(400).json({
        success: false,
        message: 'Words array and language code are required',
      });
    }

    if (words.length === 0) {
      return res.json({
        success: true,
        data: {},
      });
    }

    const result = await WordService.getBulkWordUserMarks(
      req.userId!,
      words,
      languageCode
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get bulk word marks route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get user word marks with details (sentences and lessons)
router.get('/marks/details', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 50;
    const markFilter = req.query['mark']
      ? parseInt(req.query['mark'] as string)
      : undefined;
    const languageFilter = req.query['language'] as string | undefined;
    const searchFilter = req.query['search'] as string | undefined;
    const sortBy = (req.query['sortBy'] as string) || 'updated_at';
    const sortOrder = (req.query['sortOrder'] as 'asc' | 'desc') || 'desc';

    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid pagination parameters. Page must be >= 1, limit must be 1-100',
      });
    }

    if (markFilter !== undefined && (markFilter < 0 || markFilter > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Mark filter must be between 0 and 5',
      });
    }

    const result = await WordService.getUserWordMarksWithDetails(
      req.userId!,
      page,
      limit,
      markFilter,
      languageFilter,
      searchFilter,
      sortBy,
      sortOrder
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get user word marks with details route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get word translations
router.get(
  '/translations/:word/:sourceLanguage/:targetLanguage',
  async (req: Request, res: Response) => {
    try {
      const { word, sourceLanguage, targetLanguage } = req.params;

      if (!word || !sourceLanguage || !targetLanguage) {
        return res.status(400).json({
          success: false,
          message: 'Word, source language, and target language are required',
        });
      }

      const result = await WordService.getWordTranslations(
        decodeURIComponent(word),
        sourceLanguage,
        targetLanguage
      );

      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Get word translations route error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

// Get word pronunciations
router.get(
  '/pronunciations/:word/:languageCode',
  async (req: Request, res: Response) => {
    try {
      const { word, languageCode } = req.params;

      if (!word || !languageCode) {
        return res.status(400).json({
          success: false,
          message: 'Word and language code are required',
        });
      }

      const result = await WordService.getWordPronunciations(
        decodeURIComponent(word),
        languageCode
      );

      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Get word pronunciations route error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

export default router;
