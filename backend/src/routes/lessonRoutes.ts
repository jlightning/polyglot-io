import { Router, Request, Response } from 'express';
import { LessonService } from '../services/lessonService';
import { SentenceService } from '../services/sentenceService';
import { UserLessonProgressService } from '../services/userLessonProgressService';

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

// Update a lesson
router.put('/:lessonId', async (req: Request, res: Response) => {
  try {
    const lessonId = parseInt(req.params['lessonId'] || '0');
    const { title, imageKey, audioKey } = req.body;

    if (isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson ID',
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    const result = await LessonService.updateLesson(req.userId!, lessonId, {
      title: title.trim(),
      imageKey,
      audioKey,
    });

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Update lesson route error:', error);
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

// Get translation for a specific sentence with context
router.get(
  '/sentences/:sentenceId/translation',
  async (req: Request, res: Response) => {
    try {
      const sentenceId = parseInt(req.params['sentenceId'] || '0');

      if (isNaN(sentenceId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sentence ID',
        });
      }

      const result = await SentenceService.getSentenceTranslation(
        sentenceId,
        req.userId!
      );

      if (result.success) {
        return res.json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Get sentence translation route error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

// Update user progress for a lesson (when page changes or lesson is finished)
router.post('/:lessonId/progress', async (req: Request, res: Response) => {
  try {
    const lessonId = parseInt(req.params['lessonId'] || '0');
    const { currentPage, sentencesPerPage, finishLesson } = req.body;

    if (isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson ID',
      });
    }

    if (!currentPage || currentPage < 1) {
      return res.status(400).json({
        success: false,
        message: 'Current page is required and must be >= 1',
      });
    }

    const result = await UserLessonProgressService.updateProgress(
      req.userId!,
      lessonId,
      currentPage,
      sentencesPerPage || 5,
      finishLesson || false
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Update progress route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get user progress for a lesson
router.get('/:lessonId/progress', async (req: Request, res: Response) => {
  try {
    const lessonId = parseInt(req.params['lessonId'] || '0');
    const sentencesPerPage =
      parseInt(req.query['sentencesPerPage'] as string) || 5;

    if (isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson ID',
      });
    }

    const result = await UserLessonProgressService.getProgress(
      req.userId!,
      lessonId,
      sentencesPerPage
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get progress route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Reset user progress for a lesson
router.delete('/:lessonId/progress', async (req: Request, res: Response) => {
  try {
    const lessonId = parseInt(req.params['lessonId'] || '0');

    if (isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson ID',
      });
    }

    const result = await UserLessonProgressService.resetProgress(
      req.userId!,
      lessonId
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Reset progress route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Update user progress for a lesson by sentence ID (for video view)
router.post(
  '/:lessonId/progress/sentence',
  async (req: Request, res: Response) => {
    try {
      const lessonId = parseInt(req.params['lessonId'] || '0');
      const { sentenceId, finishLesson } = req.body;

      if (isNaN(lessonId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid lesson ID',
        });
      }

      if (!sentenceId || isNaN(parseInt(sentenceId))) {
        return res.status(400).json({
          success: false,
          message: 'Valid sentence ID is required',
        });
      }

      const result = await UserLessonProgressService.updateProgressBySentence(
        req.userId!,
        lessonId,
        parseInt(sentenceId),
        finishLesson || false
      );

      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Update progress by sentence route error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

// Get user progress overview for all lessons
router.get('/progress/overview', async (req: Request, res: Response) => {
  try {
    const result = await UserLessonProgressService.getUserProgressOverview(
      req.userId!
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Get progress overview route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
