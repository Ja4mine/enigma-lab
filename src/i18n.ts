import { createContext, useContext } from "react";

export type Lang = "zh" | "en";
/** Every user-facing string is written in both languages side by side. */
export interface Text {
  zh: string;
  en: string;
}
export const tx = (zh: string, en: string): Text => ({ zh, en });

export interface LangValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Stable for a given language, so it is safe in effect dependencies. */
  t: (text: Text | string) => string;
}

export const makeT = (lang: Lang) => (text: Text | string) => (typeof text === "string" ? text : text[lang]);

export const LangContext = createContext<LangValue>({ lang: "zh", setLang: () => {}, t: makeT("zh") });

export function useLang() {
  return useContext(LangContext);
}

const KEY = "enigma-lab.lang";
export function storedLang(): Lang {
  try {
    const value = localStorage.getItem(KEY);
    if (value === "zh" || value === "en") return value;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith("zh") === false ? "en" : "zh";
}
export function storeLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* storage unavailable */
  }
}
