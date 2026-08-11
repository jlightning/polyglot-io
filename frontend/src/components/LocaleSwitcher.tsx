import React from 'react';
import { Select } from '@radix-ui/themes';
import { useI18n } from '../contexts/I18nContext';
import type { Locale } from '../i18n/translations';

const LocaleSwitcher: React.FC = () => {
  const { locale, setLocale, t } = useI18n();

  return (
    <Select.Root
      value={locale}
      onValueChange={value => setLocale(value as Locale)}
    >
      <Select.Trigger aria-label={t('locale.label')} />
      <Select.Content>
        <Select.Item value="en">{t('locale.en')}</Select.Item>
        <Select.Item value="vi">{t('locale.vi')}</Select.Item>
      </Select.Content>
    </Select.Root>
  );
};

export default LocaleSwitcher;
