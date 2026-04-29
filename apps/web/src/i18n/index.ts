import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import enTranslation from "@vellum/shared/locales/en.json";
import zhTWTranslation from "@vellum/shared/locales/zh-TW.json";

const SUPPORTED_LANGUAGES = ["zh-TW", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "zh-TW",
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    resources: {
      "zh-TW": { translation: zhTWTranslation },
      en: { translation: enTranslation },
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
