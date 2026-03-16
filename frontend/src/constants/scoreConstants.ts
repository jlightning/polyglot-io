// Daily score target for display and backfill logic
export const DAILY_SCORE_TARGET = 200;

// Single source of truth for allowed score targets and their difficulty labels
export const ALLOWED_SCORE_TARGETS = [
  50, 100, 200, 250, 300, 400, 600, 1000, 2000,
] as const;

const SCORE_TARGET_DIFFICULTY: Record<
  (typeof ALLOWED_SCORE_TARGETS)[number],
  string
> = {
  50: 'Very Easy',
  100: 'Easy',
  200: 'Recommended',
  250: 'I want harder',
  300: 'Even harder',
  400: 'Not hard enough',
  600: 'Still Not hard enough',
  1000: 'Now this is hard',
  2000: 'Extreme',
};

export const getScoreTargetDifficulty = (target: number): string =>
  SCORE_TARGET_DIFFICULTY[target as (typeof ALLOWED_SCORE_TARGETS)[number]] ??
  '';
