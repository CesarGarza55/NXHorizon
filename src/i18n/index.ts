import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import es from './locales/es.json';
import en from './locales/en.json';

const LANGUAGE_KEY = '@nx_library_language_preference';

export const SUPPORTED_LANGUAGES = [
  { code: 'auto', label: 'settings.languageSystem' },
  { code: 'es', label: 'settings.languageSpanish' },
  { code: 'en', label: 'settings.languageEnglish' },
] as const;

export type SupportedLanguage = 'auto' | 'es' | 'en';

export const getDeviceLanguage = (): 'es' | 'en' => {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const languageCode = locales[0].languageCode?.toLowerCase();
      if (languageCode === 'es') {
        return 'es';
      }
    }
  } catch (err) {
    console.warn('[i18n] Error detecting device language:', err);
  }
  return 'en';
};

export const initializeI18n = async () => {
  let savedLang: string | null = null;
  try {
    savedLang = await AsyncStorage.getItem(LANGUAGE_KEY);
  } catch (e) {
    console.warn('[i18n] Failed reading saved language:', e);
  }

  const initialLng =
    savedLang === 'es' || savedLang === 'en'
      ? savedLang
      : getDeviceLanguage();

  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: {
        es: { translation: es },
        en: { translation: en },
      },
      lng: initialLng,
      fallbackLng: 'en',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });
  }

  return initialLng;
};

export const setAppLanguage = async (lang: SupportedLanguage) => {
  try {
    if (lang === 'auto') {
      await AsyncStorage.removeItem(LANGUAGE_KEY);
      const deviceLang = getDeviceLanguage();
      await i18n.changeLanguage(deviceLang);
    } else {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      await i18n.changeLanguage(lang);
    }
  } catch (err) {
    console.error('[i18n] Failed to persist/change language:', err);
  }
};

export default i18n;
