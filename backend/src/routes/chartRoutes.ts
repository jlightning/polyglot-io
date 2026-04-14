import express from 'express';
import { ctx } from './index';

const router = express.Router();

router.get('/daily-score', (req, res, next) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }
  const languageCode = req.query['languageCode'] as string;
  if (!languageCode) {
    res.status(400).json({ error: 'languageCode parameter is required' });
    return;
  }
  void ctx.chartService
    .getDailyScoreChart(
      ctx,
      userId,
      languageCode,
      req.query['timezone'] as string | undefined,
      req.query['range'] as string | undefined
    )
    .then(data => res.json(data))
    .catch(next);
});

router.get('/cumulative-score', (req, res, next) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }
  const languageCode = req.query['languageCode'] as string;
  if (!languageCode) {
    res.status(400).json({ error: 'languageCode parameter is required' });
    return;
  }
  void ctx.chartService
    .getCumulativeScoreChart(
      ctx,
      userId,
      languageCode,
      req.query['timezone'] as string | undefined,
      req.query['range'] as string | undefined
    )
    .then(data => res.json(data))
    .catch(next);
});

router.get('/learned-words', (req, res, next) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }
  const languageCode = req.query['languageCode'] as string;
  if (!languageCode) {
    res.status(400).json({ error: 'languageCode parameter is required' });
    return;
  }
  void ctx.chartService
    .getLearnedWordsChart(
      ctx,
      userId,
      languageCode,
      req.query['timezone'] as string | undefined,
      req.query['range'] as string | undefined
    )
    .then(data => res.json(data))
    .catch(next);
});

router.get('/learned-per-day', (req, res, next) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }
  const languageCode = req.query['languageCode'] as string;
  if (!languageCode) {
    res.status(400).json({ error: 'languageCode parameter is required' });
    return;
  }
  void ctx.chartService
    .getLearnedPerDayChart(
      ctx,
      userId,
      languageCode,
      req.query['timezone'] as string | undefined,
      req.query['range'] as string | undefined
    )
    .then(data => res.json(data))
    .catch(next);
});

router.get('/read-words-per-day', (req, res, next) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }
  const languageCode = req.query['languageCode'] as string;
  if (!languageCode) {
    res.status(400).json({ error: 'languageCode parameter is required' });
    return;
  }
  void ctx.chartService
    .getReadWordsPerDayChart(
      ctx,
      userId,
      languageCode,
      req.query['timezone'] as string | undefined,
      req.query['range'] as string | undefined
    )
    .then(data => res.json(data))
    .catch(next);
});

export default router;
