import { Router, Request, Response } from 'express';
import { TtsService } from '../services/ttsService';

const router = Router();
const MAX_TEXT_LENGTH = 5000;

router.post('/', async (req: Request, res: Response) => {
  try {
    const { text, languageCode } = req.body;

    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'text is required and must be a non-empty string',
      });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `text must be at most ${MAX_TEXT_LENGTH} characters`,
      });
    }

    if (typeof languageCode !== 'string' || !languageCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'languageCode is required and must be a non-empty string',
      });
    }

    const buffer = await TtsService.getCachedOrGenerateVoice(
      text,
      languageCode.trim()
    );

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (error) {
    console.error('TTS route error:', error);
    return res.status(502).json({
      success: false,
      message: 'Could not generate audio. Please try again.',
    });
  }
});

export default router;
