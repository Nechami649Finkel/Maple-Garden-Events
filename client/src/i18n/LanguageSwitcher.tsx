import { SUPPORTED_LOCALES, type Locale, type TranslationKey, T } from '@shared/i18n';
import { useTranslation } from './useTranslation';
import './LanguageSwitcher.css';

const LOCALE_LABEL_KEYS: Record<Locale, TranslationKey> = {
  en: T.COMMON.LANGUAGE.EN,
  he: T.COMMON.LANGUAGE.HE,
};

export function LanguageSwitcher() {
  const { locale, setLocale, t, T: keys } = useTranslation();

  return (
    <label className="language-switcher">
      <span className="language-switcher-label">{t(keys.COMMON.LANGUAGE.LABEL)}</span>
      <select
        className="language-switcher-select"
        value={locale}
        aria-label={t(keys.COMMON.LANGUAGE.LABEL)}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {t(LOCALE_LABEL_KEYS[code])}
          </option>
        ))}
      </select>
    </label>
  );
}
