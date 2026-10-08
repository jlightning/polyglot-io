import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import en from './en.json';
import vi from './vi.json';

export type UiLanguage = 'en' | 'vi';
export type Messages = typeof en;

export type MessagePath = {
  [Group in keyof Messages]: {
    [Key in keyof Messages[Group]]: Messages[Group][Key] extends string
      ? `${Group & string}.${Key & string}`
      : never;
  }[keyof Messages[Group]];
}[keyof Messages];

const dictionaries: Record<UiLanguage, Messages> = { en, vi };

const STORAGE_KEY = 'polyglotio_ui_language';

interface UiLanguageContextType {
  uiLanguage: UiLanguage;
  setUiLanguage: (language: UiLanguage) => void;
  t: (path: MessagePath, vars?: Record<string, string | number>) => string;
}

const UiLanguageContext = createContext<UiLanguageContextType | undefined>(
  undefined
);

export const useI18n = () => {
  const context = useContext(UiLanguageContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within a UiLanguageProvider');
  }
  return context;
};

export const translationTarget = (
  uiLanguage: string | undefined,
  studyLanguage: string | undefined
): UiLanguage => {
  if (uiLanguage !== 'en' && uiLanguage !== 'vi') return 'en';
  if (studyLanguage && uiLanguage === studyLanguage) return 'en';
  return uiLanguage;
};

export const difficultyPath = (mark: number): MessagePath => {
  if (mark === -1) return 'difficulty.unmarked';
  if (mark === 0) return 'difficulty.ignore';
  if (mark === 1) return 'difficulty.dontRemember';
  if (mark === 2) return 'difficulty.hard';
  if (mark === 3) return 'difficulty.remembered';
  if (mark === 4) return 'difficulty.easy';
  return 'difficulty.noProblem';
};

interface UiLanguageProviderProps {
  children: ReactNode;
}

export const UiLanguageProvider: React.FC<UiLanguageProviderProps> = ({
  children,
}) => {
  const [uiLanguage, setUiLanguageState] = useState<UiLanguage>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'vi' || stored === 'en') return stored;
    } catch (error) {
      console.warn('Failed to read UI language', error);
    }
    return 'en';
  });

  const setUiLanguage = useCallback((language: UiLanguage) => {
    setUiLanguageState(language);
    document.documentElement.lang = language;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch (error) {
      console.warn('Failed to save UI language', error);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = uiLanguage;
  }, [uiLanguage]);

  const t = useCallback(
    (path: MessagePath, vars?: Record<string, string | number>) => {
      const dot = path.indexOf('.');
      const group = path.slice(0, dot) as keyof Messages;
      const name = path.slice(dot + 1);
      const section = dictionaries[uiLanguage][group];
      const raw = section[name as keyof typeof section];
      const template = typeof raw === 'string' ? raw : path;
      if (!vars) return template;
      return template.replace(
        /\{([A-Za-z0-9_]+)\}/g,
        (match, token: string) => {
          const value = vars[token];
          if (value === undefined) return match;
          return String(value);
        }
      );
    },
    [uiLanguage]
  );

  return (
    <UiLanguageContext.Provider value={{ uiLanguage, setUiLanguage, t }}>
      {children}
    </UiLanguageContext.Provider>
  );
};
