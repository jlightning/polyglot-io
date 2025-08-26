// Difficulty rating colors and labels
export const DIFFICULTY_COLORS = {
  0: '#222222', // gray - Ignore
  1: '#FF9800CC', // 40% opacity orange - Don't remember
  2: '#FF980066', // 60% opacity orange - Hard to remember
  3: '#FF980033', // 80% opacity orange - Remembered
  4: 'transparent', // transparent - Easy to remember (dotted underline)
  5: 'transparent', // transparent - No problem (no styling)
} as const;

export const DIFFICULTY_LABELS = {
  0: 'Ignore',
  1: "Don't remember",
  2: 'Hard to remember',
  3: 'Remembered',
  4: 'Easy to remember',
  5: 'No problem',
} as const;

export const getDifficultyColor = (mark: number): string => {
  return (
    DIFFICULTY_COLORS[mark as keyof typeof DIFFICULTY_COLORS] ||
    DIFFICULTY_COLORS[0]
  );
};

export const getDifficultyLabel = (mark: number): string => {
  return DIFFICULTY_LABELS[mark as keyof typeof DIFFICULTY_LABELS] || '';
};

export const getDifficultyStyles = (mark: number) => {
  const baseStyles = {
    backgroundColor: getDifficultyColor(mark),
    borderColor: getDifficultyColor(mark),
    border: '1px solid transparent',
  };

  // Special styling for level 4: dotted underline
  if (mark === 4) {
    return {
      ...baseStyles,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      border: '1px dotted #FF9800',
    };
  }

  return baseStyles;
};
