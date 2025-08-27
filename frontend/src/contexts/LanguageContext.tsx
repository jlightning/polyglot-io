import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useAuth } from './AuthContext';

interface Language {
  code: string;
  name: string;
  localName?: string;
  tag: string;
  enabled: boolean;
}

interface LanguageContextType {
  selectedLanguage: string;
  setSelectedLanguage: (languageCode: string) => void;
  languages: Language[];
  loading: boolean;
  error: string | null;
  refreshLanguages: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

const LANGUAGE_STORAGE_KEY = 'polyglotio_selected_language';

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
}) => {
  const [selectedLanguage, setSelectedLanguageState] = useState<string>('');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { axiosInstance, isAuthenticated } = useAuth();

  // Custom setter that also saves to localStorage
  const setSelectedLanguage = (languageCode: string) => {
    setSelectedLanguageState(languageCode);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    } catch (error) {
      console.warn(
        'Failed to save language preference to localStorage:',
        error
      );
    }
  };

  const fetchLanguages = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/api/config/languages');

      if (response.data.success) {
        const fetchedLanguages = response.data.languages;
        setLanguages(fetchedLanguages);
        setError(null);

        // Set default language if none is stored or if stored language is invalid
        let storedLanguage = null;
        try {
          storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        } catch (error) {
          console.warn(
            'Failed to read language preference from localStorage:',
            error
          );
        }
        const validLanguageCodes = fetchedLanguages.map(
          (lang: Language) => lang.code
        );

        if (!storedLanguage || !validLanguageCodes.includes(storedLanguage)) {
          // Always default to first language from backend
          if (fetchedLanguages.length > 0) {
            setSelectedLanguage(fetchedLanguages[0].code);
          }
        } else {
          setSelectedLanguageState(storedLanguage);
        }
      } else {
        setError('Failed to load languages');
      }
    } catch (err) {
      console.error('Error fetching languages:', err);
      setError('Failed to load languages');
    } finally {
      setLoading(false);
    }
  };

  const refreshLanguages = () => {
    if (isAuthenticated) {
      fetchLanguages();
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchLanguages();
    } else {
      setLanguages([]);
      // Load from localStorage even when not authenticated
      let storedLanguage = null;
      try {
        storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      } catch (error) {
        console.warn(
          'Failed to read language preference from localStorage:',
          error
        );
      }
      if (storedLanguage) {
        setSelectedLanguageState(storedLanguage);
      }
      // Note: selectedLanguage will remain empty until languages are fetched
      setLoading(false);
    }
  }, [isAuthenticated]);

  const value: LanguageContextType = {
    selectedLanguage,
    setSelectedLanguage,
    languages,
    loading,
    error,
    refreshLanguages,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
