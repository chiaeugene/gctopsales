"use client";

import { createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { t as translate, LANG_COOKIE, type Lang } from "@/lib/i18n";

// Client-side language context. The (app) layout reads the "gc-lang" cookie
// server-side and passes it down, so server and client always agree and
// there's no hydration flash.

const I18nContext = createContext<Lang>("en");

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <I18nContext.Provider value={lang}>{children}</I18nContext.Provider>;
}

export function useT() {
  const lang = useContext(I18nContext);
  const t = useCallback((key: string) => translate(lang, key), [lang]);
  return { lang, t };
}

// The EN / 中文 switch. Writes the cookie then refreshes so server components
// re-render in the new language too.
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang } = useT();
  const router = useRouter();

  const setLang = (next: Lang) => {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  };

  const btn = (value: Lang, label: string) => (
    <button
      onClick={() => setLang(value)}
      className={
        "px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors " +
        (lang === value ? "bg-white text-[var(--accent-ink)] shadow-sm" : "text-black/45 hover:text-black/70")
      }
    >
      {label}
    </button>
  );

  return (
    <div className={"inline-flex items-center gap-0.5 rounded-lg bg-black/[0.05] p-0.5 " + className}>
      {btn("en", "EN")}
      {btn("zh", "中文")}
    </div>
  );
}
