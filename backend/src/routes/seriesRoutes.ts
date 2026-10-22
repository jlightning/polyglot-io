import { Router, Request, Response } from 'express';
import { ctx } from './index';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, languageCode } = req.body;
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';

    if (!trimmedTitle || !languageCode || typeof languageCode !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Title and language code are required',
      });
    }

    if (trimmedTitle.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Title must be 255 characters or fewer',
      });
    }

    const result = await ctx.seriesService.createSeries(ctx, req.userId!, {
      title: trimmedTitle,
      languageCode,
    });

    if (result.success) {
      return res.status(201).json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('Create series route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

router.get('/language/:languageCode', async (req: Request, res: Response) => {
  try {
    const languageCode = req.params['languageCode'];
    if (!languageCode) {
      return res.status(400).json({
        success: false,
        message: 'Language code is required',
      });
    }

    let lessonId: number | undefined;
    if (req.query['lessonId'] !== undefined) {
      lessonId = parseInt(String(req.query['lessonId']), 10);
      if (isNaN(lessonId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid lesson ID',
        });
      }
    }

    const result = await ctx.seriesService.getSeriesByLanguage(
      ctx,
      req.userId!,
      languageCode,
      lessonId
    );

    if (result.success) {
      return res.json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('Get series by language route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

router.get('/:seriesId', async (req: Request, res: Response) => {
  try {
    const seriesId = parseInt(req.params['seriesId'] || '0', 10);
    if (isNaN(seriesId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid series ID',
      });
    }

    const result = await ctx.seriesService.getSeriesById(
      ctx,
      req.userId!,
      seriesId
    );

    if (result.success) {
      return res.json(result);
    }
    return res.status(404).json(result);
  } catch (error) {
    console.error('Get series route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

router.put('/:seriesId', async (req: Request, res: Response) => {
  try {
    const seriesId = parseInt(req.params['seriesId'] || '0', 10);
    const { title } = req.body;
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';

    if (isNaN(seriesId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid series ID',
      });
    }

    if (!trimmedTitle) {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    if (trimmedTitle.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Title must be 255 characters or fewer',
      });
    }

    const result = await ctx.seriesService.updateSeries(
      ctx,
      req.userId!,
      seriesId,
      { title: trimmedTitle }
    );

    if (result.success) {
      return res.json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('Update series route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

router.delete('/:seriesId', async (req: Request, res: Response) => {
  try {
    const seriesId = parseInt(req.params['seriesId'] || '0', 10);
    if (isNaN(seriesId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid series ID',
      });
    }

    const result = await ctx.seriesService.deleteSeries(
      ctx,
      req.userId!,
      seriesId
    );

    if (result.success) {
      return res.json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('Delete series route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

router.post('/:seriesId/lessons', async (req: Request, res: Response) => {
  try {
    const seriesId = parseInt(req.params['seriesId'] || '0', 10);
    const lessonId = parseInt(req.body?.lessonId, 10);

    if (isNaN(seriesId) || isNaN(lessonId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid series or lesson ID',
      });
    }

    const result = await ctx.seriesService.addLesson(
      ctx,
      req.userId!,
      seriesId,
      lessonId
    );

    if (result.success) {
      return res.status(201).json(result);
    }
    return res.status(400).json(result);
  } catch (error) {
    console.error('Add lesson to series route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

router.delete(
  '/:seriesId/lessons/:lessonId',
  async (req: Request, res: Response) => {
    try {
      const seriesId = parseInt(req.params['seriesId'] || '0', 10);
      const lessonId = parseInt(req.params['lessonId'] || '0', 10);
      if (isNaN(seriesId) || isNaN(lessonId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid series or lesson ID',
        });
      }

      const result = await ctx.seriesService.removeLesson(
        ctx,
        req.userId!,
        seriesId,
        lessonId
      );

      if (result.success) {
        return res.json(result);
      }
      return res.status(400).json(result);
    } catch (error) {
      console.error('Remove lesson from series route error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

router.post(
  '/:seriesId/lessons/:lessonId/move',
  async (req: Request, res: Response) => {
    try {
      const seriesId = parseInt(req.params['seriesId'] || '0', 10);
      const lessonId = parseInt(req.params['lessonId'] || '0', 10);
      const { direction } = req.body;

      if (isNaN(seriesId) || isNaN(lessonId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid series or lesson ID',
        });
      }

      if (direction !== 'up' && direction !== 'down') {
        return res.status(400).json({
          success: false,
          message: 'Direction must be up or down',
        });
      }

      const result = await ctx.seriesService.moveLesson(
        ctx,
        req.userId!,
        seriesId,
        lessonId,
        direction
      );

      if (result.success) {
        return res.json(result);
      }
      return res.status(400).json(result);
    } catch (error) {
      console.error('Move lesson in series route error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  }
);

export default router;
