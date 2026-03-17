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

export default router;
