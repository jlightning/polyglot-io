import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  translations,
  type Locale,
  type TranslationKey,
} from '../i18n/translations';

const LOCALE_STORAGE_KEY = 'polyglotio_interface_locale';
const DEFAULT_LOCALE: Locale = 'en';

type TranslationVariables = Record<string, string | number>;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function loadInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return stored === 'vi' || stored === 'en' ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export const I18nProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [locale, setLocaleState] = useState<Locale>(loadInitialLocale);

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (nextLocale: Locale) => {
      setLocaleState(nextLocale);
      document.documentElement.lang = nextLocale;
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
      } catch (error) {
        console.warn('Failed to save interface locale:', error);
      }
    };

    const t = (key: TranslationKey, variables: TranslationVariables = {}) => {
      const template = translations[locale][key] ?? translations.en[key];
      return Object.entries(variables).reduce(
        (result, [name, replacement]) =>
          result.split(`{{${name}}}`).join(String(replacement)),
        template as string
      );
    };

    return { locale, setLocale, t };
  }, [locale]);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within an I18nProvider');
  return context;
}
