import * as locale from 'locale-codes';

export interface LanguageConfig {
  code: string;
  name: string;
  localName?: string;
  tag: string;
  enabled: boolean;
}

export class ConfigService {
  private static supportedLanguages: LanguageConfig[] = [
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
      enabled: false,
    }, // Example disabled language
  ];

  /**
   * Get all enabled languages for the application
   */
  static getEnabledLanguages(): LanguageConfig[] {
    return this.supportedLanguages.filter(lang => lang.enabled);
  }

  /**
   * Get all supported languages (enabled and disabled)
   */
  static getAllLanguages(): LanguageConfig[] {
    return [...this.supportedLanguages];
  }

  /**
   * Check if a language code is enabled
   */
  static isLanguageEnabled(languageCode: string): boolean {
    return this.supportedLanguages.some(
      lang => lang.code === languageCode && lang.enabled
    );
  }

  /**
   * Get language configuration by code
   */
  static getLanguageByCode(languageCode: string): LanguageConfig | null {
    return (
      this.supportedLanguages.find(lang => lang.code === languageCode) || null
    );
  }

  /**
   * Enable/disable a language (for admin functionality)
   */
  static updateLanguageStatus(languageCode: string, enabled: boolean): boolean {
    const languageIndex = this.supportedLanguages.findIndex(
      lang => lang.code === languageCode
    );

    if (languageIndex === -1) {
      return false;
    }

    this.supportedLanguages[languageIndex]!.enabled = enabled;
    return true;
  }

  /**
   * Validate a language code using locale-codes package
   */
  static isValidLanguageCode(languageCode: string): boolean {
    const localeInfo = locale.getByISO6391(languageCode);
    return localeInfo !== undefined;
  }

  /**
   * Get language information from locale-codes package
   */
  static getLanguageInfo(languageCode: string) {
    return locale.getByISO6391(languageCode);
  }

  /**
   * Get language information by tag (e.g., 'ja-JP', 'ko-KR')
   */
  static getLanguageInfoByTag(tag: string) {
    return locale.getByTag(tag);
  }

  /**
   * Add a new language to supported languages using locale-codes validation
   */
  static addSupportedLanguage(
    languageCode: string,
    enabled: boolean = false
  ): boolean {
    // Check if already exists
    if (this.supportedLanguages.some(lang => lang.code === languageCode)) {
      return false;
    }

    // Validate using locale-codes
    const localeInfo = locale.getByISO6391(languageCode);
    if (!localeInfo) {
      return false;
    }

    // Add the language
    const newLanguage: LanguageConfig = {
      code: languageCode,
      name: localeInfo.name,
      tag: localeInfo.tag,
      enabled,
    };

    if (localeInfo.local) {
      newLanguage.localName = localeInfo.local;
    }

    this.supportedLanguages.push(newLanguage);

    return true;
  }
}
