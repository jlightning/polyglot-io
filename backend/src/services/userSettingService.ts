import type { Context } from './index';

// Default settings values
const DEFAULT_SETTINGS = {
  DAILY_SCORE_TARGET: '200',
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

export interface UserSettings {
  DAILY_SCORE_TARGET: string;
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
      const where: { user_id: number; language_code?: string | null } = {
        user_id: userId,
      };
      if (languageCode) {
        where.language_code = languageCode;
      }

      const settings = await ctx.prisma.userSetting.findMany({
        where,
      });

      // Build settings object from database records (language-scoped rows take precedence when filtered by language)
      const settingsObject: Partial<UserSettings> = {};
      settings.forEach(setting => {
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
