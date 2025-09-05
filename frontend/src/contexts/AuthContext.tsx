import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';
import axios, { AxiosInstance } from 'axios';

interface User {
  id: number;
  username: string;
  email: string;
  phone_number?: string;
}

interface DailyScore {
  date: string;
  score: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  axiosInstance: AxiosInstance;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; message: string }>;
  register: (userData: {
    email: string;
    username: string;
    password: string;
    phone_number?: string;
  }) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  userScore: number;
  knownWordsCount: number;
  scoreHistory: DailyScore[];
  fetchUserStats: (languageCode?: string) => Promise<void>;
  fetchScoreHistory: (languageCode?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userScore, setUserScore] = useState<number>(0);
  const [knownWordsCount, setKnownWordsCount] = useState<number>(0);
  const [scoreHistory, setScoreHistory] = useState<DailyScore[]>([]);

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  const logout = () => {
    setUser(null);
    setToken(null);
    setUserScore(0);
    setKnownWordsCount(0);
    setScoreHistory([]);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  // Create axios instance with automatic token handling
  const axiosInstance = useMemo(() => {
    const instance = axios.create({
      baseURL: backendUrl,
    });

    // Add request interceptor to automatically include token
    instance.interceptors.request.use(
      config => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      error => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle token expiration
    instance.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          // Token expired or invalid, logout user
          logout();
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, [token, backendUrl]);

  const fetchScoreHistory = useCallback(
    async (languageCode?: string) => {
      if (!token || !languageCode || languageCode.trim() === '') return;

      try {
        const url = new URL(`${backendUrl}/api/user-score/getScoreHistory`);
        url.searchParams.append('languageCode', languageCode);

        // Add user's timezone
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        url.searchParams.append('timezone', userTimezone);

        const response = await axios.get(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.data.success) {
          setScoreHistory(response.data.scoreHistory || []);
        }
      } catch (error) {
        console.error('Error fetching score history:', error);
        setScoreHistory([]);
      }
    },
    [token, backendUrl]
  );

  const fetchUserStats = useCallback(
    async (languageCode?: string) => {
      if (!token || !languageCode || languageCode.trim() === '') return;

      try {
        const url = new URL(`${backendUrl}/api/user-score/getUserStats`);
        url.searchParams.append('languageCode', languageCode);

        // Add user's timezone
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        url.searchParams.append('timezone', userTimezone);

        const response = await axios.get(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.data.success) {
          setUserScore(response.data.score || 0);
          setKnownWordsCount(response.data.knownWordsCount || 0);
        }

        await fetchScoreHistory(languageCode);
      } catch (error) {
        console.error('Error fetching user stats:', error);
        setUserScore(0);
        setKnownWordsCount(0);
      }
    },
    [token, backendUrl, fetchScoreHistory]
  );

  // Check for existing authentication on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  // Note: User stats are now fetched by components when language is selected

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await axios.post(`${backendUrl}/api/auth/login`, {
        email,
        password,
      });

      const result = response.data;

      if (result.success && result.token && result.user) {
        setToken(result.token);
        setUser(result.user);
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message || 'Login failed' };
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        return { success: false, message: error.response.data.message };
      }
      return { success: false, message: 'Network error. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: {
    email: string;
    username: string;
    password: string;
    phone_number?: string;
  }) => {
    try {
      setIsLoading(true);
      const response = await axios.post(
        `${backendUrl}/api/auth/register`,
        userData
      );

      const result = response.data;

      if (result.success && result.token && result.user) {
        // Automatically log the user in after successful registration
        setToken(result.token);
        setUser(result.user);
        localStorage.setItem('authToken', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        return { success: true, message: result.message };
      } else {
        return {
          success: false,
          message: result.message || 'Registration failed',
        };
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        return { success: false, message: error.response.data.message };
      }
      return { success: false, message: 'Network error. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  const isAuthenticated = !!user && !!token;

  const value: AuthContextType = {
    user,
    token,
    axiosInstance,
    login,
    register,
    logout,
    isLoading,
    isAuthenticated,
    userScore,
    knownWordsCount,
    scoreHistory,
    fetchUserStats,
    fetchScoreHistory,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
