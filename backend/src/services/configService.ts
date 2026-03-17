import type { Context } from './index';

export interface LanguageConfig {
  code: string;
  name: string;
  localName?: string;
  tag: string;
  enabled: boolean;
}

export class ConfigService {
  private supportedLanguages: LanguageConfig[] = [
    {
      code: 'ja',
      name: 'Japanese',
      localName: '日本語',
      tag: 'ja-JP',
      enabled: true,
    },
    {
      code: 'ko',
      name: 'Korean',
      localName: '한국어',
      tag: 'ko-KR',
      enabled: true,
    },
    {
      code: 'en',
      name: 'English',
      localName: 'English',
      tag: 'en-US',
      enabled: false,
    }, // Example disabled language
    {
      code: 'zh',
      name: 'Chinese',
      localName: '中文',
      tag: 'zh-CN',
      enabled: true,
    },
  ];

  /**
   * Get all enabled languages for the application
   */
  getEnabledLanguages(ctx: Context): LanguageConfig[] {
    return this.supportedLanguages.filter(lang => lang.enabled);
  }

  /**
   * Check if a language code is enabled
   */
  isLanguageEnabled(ctx: Context, languageCode: string): boolean {
    return this.supportedLanguages.some(
      lang => lang.code === languageCode && lang.enabled
    );
  }

  /**
   * Get language configuration by code
   */
  getLanguageByCode(ctx: Context, languageCode: string): LanguageConfig | null {
    return (
      this.supportedLanguages.find(lang => lang.code === languageCode) || null
    );
  }
}
