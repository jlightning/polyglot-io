import { Router, Request, Response } from 'express';
import { LessonType } from '@prisma/client';
import { LessonService } from '../services/lessonService';
import { SentenceService } from '../services/sentenceService';
import { UserLessonProgressService } from '../services/userLessonProgressService';
import { ConfigService } from '../services/configService';
import { OpenAIService } from '../services/ai/openaiService';

const router = Router();
const openaiService = new OpenAIService();

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

// Create a new manga lesson with OCR processing
router.post('/manga', async (req: Request, res: Response) => {
  try {
    const { title, languageCode, imageKey, mangaPageKeys } = req.body;

    if (!title || !languageCode) {
      return res.status(400).json({
        success: false,
        message: 'Title and language code are required',
      });
    }

    // Validate that at least one manga page is provided
    if (
      !mangaPageKeys ||
      !Array.isArray(mangaPageKeys) ||
      mangaPageKeys.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'At least one manga page is required',
      });
    }

    const result = await LessonService.createMangaLesson(req.userId!, {
      title,
      languageCode,
      imageKey,
      mangaPageKeys,
    });

    if (result.success) {
      return res.status(201).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create manga lesson route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Create a new manual lesson (no file; add sentences from lesson view)
router.post('/manual', async (req: Request, res: Response) => {
  try {
    const { title, languageCode, imageKey, audioKey } = req.body;

    if (!title || !languageCode) {
      return res.status(400).json({
        success: false,
        message: 'Title and language code are required',
      });
    }

    const result = await LessonService.createManualLesson(req.userId!, {
      title,
      languageCode,
      imageKey,
      audioKey,
    });

    if (result.success) {
      return res.status(201).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create manual lesson route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Generate a manual lesson with AI from a prompt
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { title, languageCode, prompt, difficulty } = req.body;

    const validDifficulties = [
      'Beginner',
      'Easy',
      'Intermediate',
      'Advanced',
      'Native',
    ];
    const difficultyValue =
      difficulty && validDifficulties.includes(difficulty)
        ? difficulty
        : 'Intermediate';

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }
    if (
      !languageCode ||
      typeof languageCode !== 'string' ||
      !languageCode.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Language code is required',
      });
    }
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required',
      });
    }

    if (!ConfigService.isLanguageEnabled(languageCode.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Language not supported or not enabled',
      });
    }

    const { text } = await openaiService.generateLessonFromPrompt(
      prompt.trim(),
      languageCode.trim(),
      difficultyValue
    );

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'AI did not generate any content; try a different prompt.',
      });
    }

    // Split into sentences: by newlines and by sentence-ending punctuation
    const sentences = text
      .trim()
      .split(/\n+|(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sentences.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'AI did not generate any sentences; try a different prompt.',
      });
    }

    const result = await LessonService.createManualLesson(req.userId!, {
      title: title.trim(),
      languageCode: languageCode.trim(),
      sentences,
      lessonType: LessonType.generated,
    });

    if (result.success) {
      return res.status(201).json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('Generate lesson route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Get a specific lesson by ID
router.get('/:lessonId', async (req: Request, res: Response) => {
  try {
    const lessonId = parseInt(req.params['lessonId'] || '0');

    if (isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson ID',
      });
    }

    const result = await LessonService.getLessonById(req.userId!, lessonId);

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get lesson by ID route error:', error);
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

    const search = req.query['search'] as string | undefined;
    const status = req.query['status'] as 'reading' | 'finished' | undefined;
    const type = req.query['type'] as
      | 'text'
      | 'subtitle'
      | 'manga'
      | 'manual'
      | undefined;

    // Validate status enum
    if (status && !['reading', 'finished'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status filter. Must be "reading" or "finished"',
      });
    }

    // Validate type enum
    if (
      type &&
      !['text', 'subtitle', 'manga', 'manual', 'generated'].includes(type)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid type filter. Must be "text", "subtitle", "manga", "manual", or "generated"',
      });
    }

    const filters = {
      ...(search && { search }),
      ...(status && { status }),
      ...(type && { type }),
    };

    const result = await LessonService.getLessonsByLanguage(
      req.userId!,
      languageCode,
      filters
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
    const lessonFileId = req.query['lesson_file_id']
      ? parseInt(req.query['lesson_file_id'] as string)
      : undefined;

    // Set limit to 100 if lesson_file_id is provided (for manga), otherwise use query param or default to 10
    const limit = lessonFileId
      ? 100
      : parseInt(req.query['limit'] as string) || 10;

    if (isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson ID',
      });
    }

    if (lessonFileId && isNaN(lessonFileId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson file ID',
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
      limit,
      lessonFileId
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

// Add a sentence to a manual lesson
router.post('/:lessonId/sentences', async (req: Request, res: Response) => {
  try {
    const lessonId = parseInt(req.params['lessonId'] || '0');
    const { text } = req.body;

    if (isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson ID',
      });
    }

    if (typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Text is required',
      });
    }

    const result = await SentenceService.addSentenceToLesson(
      lessonId,
      req.userId!,
      text
    );

    if (result.success) {
      return res.status(201).json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('Add sentence route error:', error);
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

// Update sentence timing (start_time and end_time)
router.put(
  '/sentences/:sentenceId/timing',
  async (req: Request, res: Response) => {
    try {
      const sentenceId = parseInt(req.params['sentenceId'] || '0');
      const { timeOffset, moveSubsequent } = req.body;

      if (isNaN(sentenceId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sentence ID',
        });
      }

      if (typeof timeOffset !== 'number' || isNaN(timeOffset)) {
        return res.status(400).json({
          success: false,
          message: 'Valid timeOffset (number) is required',
        });
      }

      if (typeof moveSubsequent !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'moveSubsequent must be a boolean',
        });
      }

      const result = await SentenceService.updateSentenceTiming(
        sentenceId,
        req.userId!,
        timeOffset,
        moveSubsequent
      );

      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Update sentence timing route error:', error);
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

// OCR on selected region of manga page
router.post('/:lessonId/ocr-region', async (req: Request, res: Response) => {
  try {
    const lessonId = parseInt(req.params['lessonId'] || '0');
    const { lessonFileId, selection } = req.body;

    if (isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lesson ID',
      });
    }

    if (!lessonFileId || isNaN(parseInt(lessonFileId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid lesson file ID is required',
      });
    }

    if (!selection || typeof selection !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Selection coordinates are required',
      });
    }

    const { x, y, width, height } = selection;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      x < 0 ||
      y < 0 ||
      width <= 0 ||
      height <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Valid selection coordinates (x, y, width, height) are required',
      });
    }

    const result = await LessonService.processOCROnSelectedRegion(
      lessonId,
      parseInt(lessonFileId),
      { x, y, width, height }
    );

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('OCR region route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
