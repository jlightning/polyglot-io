import { Router, Request, Response } from 'express';
import { LessonService } from '../services/lessonService';
import { SentenceService } from '../services/sentenceService';

const router = Router();

// Create a new lesson
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, languageCode, imageKey, fileKey, audioKey } = req.body;

    if (!title || !languageCode) {
      return res.status(400).json({
        success: false,
        message: 'Title and language code are required',
      });
    }

    // Validate that at least fileKey is provided (lesson file is required)
    if (!fileKey) {
      return res.status(400).json({
        success: false,
        message: 'Lesson file is required',
      });
    }

    const result = await LessonService.createLesson(req.userId!, {
      title,
      languageCode,
      imageKey,
      fileKey,
      audioKey,
    });

    if (result.success) {
      return res.status(201).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create lesson route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get all lessons for the authenticated user
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await LessonService.getUserLessons(req.userId!);

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get lessons route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get lessons filtered by language
router.get('/language/:languageCode', async (req: Request, res: Response) => {
  try {
    const languageCode = req.params['languageCode'];
    if (!languageCode) {
      return res.status(400).json({
        success: false,
        message: 'Language code is required',
      });
    }

    const result = await LessonService.getLessonsByLanguage(
      req.userId!,
      languageCode
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get lessons by language route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Delete a lesson
router.delete('/:lessonId', async (req: Request, res: Response) => {
  try {
    const lessonId = parseInt(req.params['lessonId'] || '0');

    if (isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson ID',
      });
    }

    const result = await LessonService.deleteLesson(req.userId!, lessonId);

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Delete lesson route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get sentences for a specific lesson with pagination
router.get('/:lessonId/sentences', async (req: Request, res: Response) => {
  try {
    const lessonId = parseInt(req.params['lessonId'] || '0');
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 10;

    if (isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson ID',
      });
    }

    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid pagination parameters. Page must be >= 1, limit must be 1-100',
      });
    }

    const result = await SentenceService.getLessonSentences(
      lessonId,
      req.userId!,
      page,
      limit
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get lesson sentences route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get a specific sentence by ID
router.get('/sentences/:sentenceId', async (req: Request, res: Response) => {
  try {
    const sentenceId = parseInt(req.params['sentenceId'] || '0');

    if (isNaN(sentenceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sentence ID',
      });
    }

    const result = await SentenceService.getSentenceById(
      sentenceId,
      req.userId!
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get sentence route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
