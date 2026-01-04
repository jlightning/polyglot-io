import { prisma } from './index';

// Default settings values
const DEFAULT_SETTINGS = {
  DAILY_SCORE_TARGET: '200',
};

// Allowed values for DAILY_SCORE_TARGET
const ALLOWED_DAILY_SCORE_TARGETS = ['50', '100', '200', '250', '300'];

export interface UserSettings {
  DAILY_SCORE_TARGET: string;
}

export class UserSettingService {
  /**
   * Get all settings for a user as an object
   * Returns default values if settings don't exist
   */
  static async getUserSettings(userId: number): Promise<UserSettings> {
    try {
      const settings = await prisma.userSetting.findMany({
        where: {
          user_id: userId,
        },
      });

      // Build settings object from database records
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
   * Set/update a setting value for a user
   */
  static async setUserSetting(
    userId: number,
    key: string,
    value: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate DAILY_SCORE_TARGET value
      if (key === 'DAILY_SCORE_TARGET') {
        if (!ALLOWED_DAILY_SCORE_TARGETS.includes(value)) {
          return {
            success: false,
            message: `Invalid value for DAILY_SCORE_TARGET. Allowed values: ${ALLOWED_DAILY_SCORE_TARGETS.join(', ')}`,
          };
        }
      }

      // Upsert the setting
      await prisma.userSetting.upsert({
        where: {
          user_id_setting_key: {
            user_id: userId,
            setting_key: key,
          },
        },
        update: {
          setting_value: value,
        },
        create: {
          user_id: userId,
          setting_key: key,
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
