import type { Context } from './index';

// Default settings values
const DEFAULT_SETTINGS = {
  DAILY_SCORE_TARGET: '200',
  UI_LANGUAGE: 'en',
};

// Allowed values for DAILY_SCORE_TARGET
const ALLOWED_DAILY_SCORE_TARGETS = [
  '50',
  '100',
  '200',
  '250',
  '300',
  '400',
  '600',
  '1000',
  '2000',
];

const ALLOWED_UI_LANGUAGES = ['en', 'vi'];

export interface UserSettings {
  DAILY_SCORE_TARGET: string;
  UI_LANGUAGE: string;
}

export class UserSettingService {
  /**
   * Get settings for a user as an object.
   * For language-scoped keys (e.g. DAILY_SCORE_TARGET), pass languageCode to filter by that language.
   * Returns default values if settings don't exist.
   */
  async getUserSettings(
    ctx: Context,
    userId: number,
    languageCode?: string
  ): Promise<UserSettings> {
    try {
      const where = languageCode
        ? {
            user_id: userId,
            OR: [{ language_code: languageCode }, { language_code: null }],
          }
        : { user_id: userId };

      const settings = await ctx.prisma.userSetting.findMany({
        where,
      });

      // Null language_code (global) first, then language-scoped so per-language keys win.
      const ordered = [...settings].sort((a, b) => {
        if (a.language_code == null && b.language_code != null) return -1;
        if (a.language_code != null && b.language_code == null) return 1;
        return 0;
      });

      const settingsObject: Partial<UserSettings> = {};
      ordered.forEach(setting => {
        settingsObject[setting.setting_key as keyof UserSettings] =
          setting.setting_value;
      });

      // Merge with defaults for any missing settings
      return {
        ...DEFAULT_SETTINGS,
        ...settingsObject,
      } as UserSettings;
    } catch (error) {
      console.error('Error retrieving user settings:', error);
      // Return defaults on error
      return { ...DEFAULT_SETTINGS } as UserSettings;
    }
  }

  /**
   * Set/update a setting value for a user.
   * For DAILY_SCORE_TARGET, languageCode is required (setting is per-language).
   */
  async setUserSetting(
    ctx: Context,
    userId: number,
    key: string,
    value: string,
    languageCode?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // DAILY_SCORE_TARGET is language-scoped; require languageCode
      if (key === 'DAILY_SCORE_TARGET') {
        if (!languageCode || languageCode.trim() === '') {
          return {
            success: false,
            message: 'languageCode is required for DAILY_SCORE_TARGET',
          };
        }
        if (!ALLOWED_DAILY_SCORE_TARGETS.includes(value)) {
          return {
            success: false,
            message: `Invalid value for DAILY_SCORE_TARGET. Allowed values: ${ALLOWED_DAILY_SCORE_TARGETS.join(', ')}`,
          };
        }
      }

      if (key === 'UI_LANGUAGE' && !ALLOWED_UI_LANGUAGES.includes(value)) {
        return {
          success: false,
          message: `Invalid value for UI_LANGUAGE. Allowed values: ${ALLOWED_UI_LANGUAGES.join(', ')}`,
        };
      }

      const langCode = key === 'DAILY_SCORE_TARGET' ? languageCode! : null;
      const languageCodeKey = langCode ?? '';

      await ctx.prisma.userSetting.upsert({
        where: {
          user_id_setting_key_language_code_key: {
            user_id: userId,
            setting_key: key,
            language_code_key: languageCodeKey,
          },
        },
        update: {
          setting_value: value,
        },
        create: {
          user_id: userId,
          setting_key: key,
          language_code: langCode,
          setting_value: value,
        },
      });

      return {
        success: true,
        message: 'Setting updated successfully',
      };
    } catch (error) {
      console.error('Error setting user setting:', error);
      return {
        success: false,
        message: 'Failed to update setting',
      };
    }
  }
}
