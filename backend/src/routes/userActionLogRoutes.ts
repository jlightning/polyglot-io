import { Router, Request, Response } from 'express';
import { UserActionLogService } from '../services/userActionLogService';
import { prisma } from '../services';

const router = Router();

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

      // Look up or create the word to get word_id
      const word = await prisma.word.findUnique({
        where: {
          word_language_code: {
            word: actionData.word,
            language_code: languageCode,
          },
        },
      });

      if (!word) return res.status(200);

      // Log the action with word_id
      result = await UserActionLogService.logReadAction(
        req.userId!,
        languageCode,
        { word_id: word.id }
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

export default router;
