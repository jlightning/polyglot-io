export type LanguageKey = 'ja' | 'ko' | 'zh' | 'other';

export const languageMap = {
  japanese: 'ja',
  korean: 'ko',
  chinese: 'zh',
  mandarin: 'zh',
};

export class LanguageRule {
  constructor(private rules: Partial<Record<LanguageKey, string[]>>) {}

  getRule(languageCode: string, allowAll?: boolean): string {
    if (!languageCode) return '';

    const arr =
      this.rules[
        (languageMap[languageCode.toLowerCase() as keyof typeof languageMap] ||
          languageCode) as LanguageKey
      ] || (allowAll ? this.rules['other'] : []);

    return arr?.join('\n') || '';
  }
}
