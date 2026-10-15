const flags: Record<string, string> = {
  ja: '🇯🇵',
  ko: '🇰🇷',
  en: '🇺🇸',
  zh: '🇨🇳',
  vi: '🇻🇳',
};

export const languageFlag = (code: string): string => flags[code] ?? '';
