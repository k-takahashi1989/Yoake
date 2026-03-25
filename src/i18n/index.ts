import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ja } from './locales/ja';
import { en } from './locales/en';

export const LANGUAGE_KEY = '@yoake:language';

export async function initI18n(): Promise<void> {
  const saved = await AsyncStorage.getItem(LANGUAGE_KEY).catch(() => null);
  await i18n.use(initReactI18next).init({
    resources: {
      ja: { translation: ja },
      en: { translation: en },
    },
    lng: saved ?? 'ja',
    fallbackLng: 'ja',
    interpolation: { escapeValue: false },
  });
}

export async function changeLanguage(lang: 'ja' | 'en'): Promise<void> {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}

export { i18n };
export { useTranslation } from 'react-i18next';
