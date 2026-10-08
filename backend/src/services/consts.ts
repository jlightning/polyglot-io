export const NUMBER_OF_TRANSLATION_TO_REDUCE = 5;
export const PLIMIT_CONCURRENCY = 10;
export const TRANSLATION_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  vi: 'Vietnamese',
};
export const SUPPORTED_TRANSLATION_LANGUAGES = Object.keys(
  TRANSLATION_LANGUAGE_NAMES
);

export const translationTarget = (
  uiLanguage: string | undefined,
  studyLanguage: string
): string => {
  const requested =
    SUPPORTED_TRANSLATION_LANGUAGES.find(language => language === uiLanguage) ??
    'en';
  return requested === studyLanguage ? 'en' : requested;
};
