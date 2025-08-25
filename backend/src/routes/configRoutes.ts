import { Router } from 'express';
import { ConfigService } from '../services/configService';

const router = Router();

// Get enabled languages
router.get('/languages', (_req, res) => {
  try {
    const enabledLanguages = ConfigService.getEnabledLanguages();
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
router.get('/languages/all', (_req, res) => {
  try {
    const allLanguages = ConfigService.getAllLanguages();
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
router.get('/languages/validate/:code', (req, res) => {
  try {
    const { code } = req.params;
    const isValid = ConfigService.isValidLanguageCode(code);
    const languageInfo = isValid ? ConfigService.getLanguageInfo(code) : null;

    res.json({
      success: true,
      valid: isValid,
      languageInfo,
    });
  } catch (error) {
    console.error('Validate language code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate language code',
    });
  }
});

export default router;
