import { translations } from '@/i18n/translations';
import { useLanguageStore } from '@/stores/languageStore';

export function useTranslation() {
  const language = useLanguageStore((s) => s.language);
  return translations[language];
}
