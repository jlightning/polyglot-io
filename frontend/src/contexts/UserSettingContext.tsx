import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

interface UserSettings {
  DAILY_SCORE_TARGET: string;
}

interface UserSettingContextType {
  dailyScoreTarget: number;
  settings: UserSettings | null;
  isLoading: boolean;
  fetchUserSettings: () => Promise<void>;
  updateUserSetting: (
    key: string,
    value: string
  ) => Promise<{ success: boolean; message: string }>;
}

const UserSettingContext = createContext<UserSettingContextType | undefined>(
  undefined
);

export const useUserSettings = () => {
  const context = useContext(UserSettingContext);
  if (context === undefined) {
    throw new Error(
      'useUserSettings must be used within a UserSettingProvider'
    );
  }
  return context;
};

interface UserSettingProviderProps {
  children: ReactNode;
}

export const UserSettingProvider: React.FC<UserSettingProviderProps> = ({
  children,
}) => {
  const { token, isAuthenticated, axiosInstance } = useAuth();
  const [dailyScoreTarget, setDailyScoreTarget] = useState<number>(200);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  const fetchUserSettings = useCallback(async () => {
    if (!token || !isAuthenticated) {
      setSettings(null);
      setDailyScoreTarget(200);
      return;
    }

    try {
      setIsLoading(true);
      const response = await axiosInstance.get('/api/user-settings');
      if (response.data.success && response.data.settings) {
        setSettings(response.data.settings);
        const dailyScoreTargetValue = parseInt(
          response.data.settings.DAILY_SCORE_TARGET || '200',
          10
        );
        setDailyScoreTarget(dailyScoreTargetValue || 200);
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      // Keep default value on error
    } finally {
      setIsLoading(false);
    }
  }, [token, isAuthenticated, axiosInstance]);

  const updateUserSetting = useCallback(
    async (
      key: string,
      value: string
    ): Promise<{ success: boolean; message: string }> => {
      if (!token || !isAuthenticated) {
        return { success: false, message: 'Not authenticated' };
      }

      try {
        const response = await axiosInstance.put(`/api/user-settings/${key}`, {
          value,
        });

        if (response.data.success) {
          // Update local state
          if (key === 'DAILY_SCORE_TARGET') {
            const newValue = parseInt(value, 10);
            if (!isNaN(newValue)) {
              setDailyScoreTarget(newValue);
            }
          }
          // Refresh settings
          await fetchUserSettings();
          return {
            success: true,
            message: response.data.message || 'Setting updated successfully',
          };
        } else {
          return {
            success: false,
            message: response.data.message || 'Failed to update setting',
          };
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.data?.message) {
          return {
            success: false,
            message: error.response.data.message,
          };
        }
        return {
          success: false,
          message: 'Network error. Please try again.',
        };
      }
    },
    [token, isAuthenticated, axiosInstance, fetchUserSettings]
  );

  // Fetch settings when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchUserSettings();
    } else {
      setSettings(null);
      setDailyScoreTarget(200);
    }
  }, [isAuthenticated, token, fetchUserSettings]);

  const value: UserSettingContextType = {
    dailyScoreTarget,
    settings,
    isLoading,
    fetchUserSettings,
    updateUserSetting,
  };

  return (
    <UserSettingContext.Provider value={value}>
      {children}
    </UserSettingContext.Provider>
  );
};
