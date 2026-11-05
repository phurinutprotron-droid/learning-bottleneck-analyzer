import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Language = "en" | "th";
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
}>({ language: "en", setLanguage: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(
    () => localStorage.getItem("lba-language") === "th" ? "th" : "en",
  );
  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("lba-language", language);
  }, [language]);
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const { language, setLanguage } = useContext(LanguageContext);
  return { language, setLanguage, t: (en: string, th: string) => language === "th" ? th : en };
}

export function LanguagePicker() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <select className="language-picker" aria-label={t("Display language", "ภาษาที่แสดง")} value={language}
      onChange={event => setLanguage(event.target.value === "th" ? "th" : "en")}>
      <option value="en" lang="en">English</option>
      <option value="th" lang="th">ไทย</option>
    </select>
  );
}

export function subjectLabel(id: string, fallback: string, language: Language) {
  const labels: Record<string, string> = { mathematics: "คณิตศาสตร์", science: "วิทยาศาสตร์", coding: "การเขียนโปรแกรม" };
  return language === "th" ? labels[id] ?? fallback : fallback;
}
