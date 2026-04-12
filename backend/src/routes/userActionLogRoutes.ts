import { Router, Request, Response } from 'express';
import { ctx } from './index';

const router = Router();

// Get action history for a word (query: word, languageCode)
router.get('/word', async (req: Request, res: Response) => {
  try {
    const word = req.query['word'] as string | undefined;
    const languageCode = req.query['languageCode'] as string | undefined;

    if (!word || !languageCode) {
      return res.status(400).json({
        success: false,
        message: 'Query params word and languageCode are required',
      });
    }

    const result = await ctx.userActionLogService.getActionHistoryByWord(
      ctx,
      req.userId!,
      word,
      languageCode
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Get word action history route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Log user action (read)
router.post('/log', async (req: Request, res: Response) => {
  try {
    const { type, languageCode, actionData } = req.body;

    if (!type || !languageCode || !actionData) {
      return res.status(400).json({
        success: false,
        message: 'Type, language code, and action data are required',
      });
    }

    let result;
    if (type === 'read') {
      if (!actionData.word) {
        return res.status(400).json({
          success: false,
          message: 'Word is required for read action',
        });
      }

      if (!actionData.sentence_id) {
        return res.status(400).json({
          success: false,
          message: 'Sentence_id is required for read action',
        });
      }

      // Log the action with word_id
      result = await ctx.userActionLogService.logReadAction(
        ctx,
        req.userId!,
        languageCode,
        { word: actionData.word, sentence_id: actionData.sentence_id }
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action type',
      });
    }

    if (result.success) {
      return res.status(201).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Log user action route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

router.get('/clean-up', async (req: Request, res: Response) => {
  await ctx.userActionLogService.cleanUpDuplicatedLog(ctx);

  return res.status(200).json({
    success: true,
  });
});

export default router;
