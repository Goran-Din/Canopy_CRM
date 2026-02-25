import { create } from 'zustand';
import type { Language } from '@/i18n/translations';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: (localStorage.getItem('crew-language') as Language) || 'en',
  setLanguage: (language) => {
    localStorage.setItem('crew-language', language);
    set({ language });
  },
}));
