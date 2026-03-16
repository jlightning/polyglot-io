import { Router, Request } from 'express';
import { ctx } from './index';

const router = Router();

// Get enabled languages
router.get('/languages', (req: Request, res) => {
  try {
    const enabledLanguages = ctx.configService.getEnabledLanguages(ctx);
    res.json({
      success: true,
      languages: enabledLanguages,
    });
  } catch (error) {
    console.error('Get enabled languages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve enabled languages',
    });
  }
});

// Get all languages (enabled and disabled) - for admin use
router.get('/languages/all', (req: Request, res) => {
  try {
    const allLanguages = ctx.configService.getAllLanguages(ctx);
    res.json({
      success: true,
      languages: allLanguages,
    });
  } catch (error) {
    console.error('Get all languages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve languages',
    });
  }
});

// Validate a language code
router.get('/languages/validate/:code', (req: Request, res) => {
  try {
    const code = req.params['code'];
    if (!code) {
      return res
        .status(400)
        .json({ success: false, message: 'Code is required' });
    }
    const isValid = ctx.configService.isValidLanguageCode(ctx, code);
    const languageInfo = isValid
      ? ctx.configService.getLanguageInfo(ctx, code)
      : null;

    return res.json({
      success: true,
      valid: isValid,
      languageInfo,
    });
  } catch (error) {
    console.error('Validate language code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate language code',
    });
  }
});

export default router;
