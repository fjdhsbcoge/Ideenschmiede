import React, { createContext, useContext } from 'react';
import { de, type Dictionary } from './de';

/**
 * i18n-Infrastruktur der Ideenschmiede.
 *
 * Aktuell: nur Deutsch (Launch in Deutschland).
 * Später: Neue Sprache = neue Datei wie `de.ts` mit identischer Struktur.
 * TypeScript erzwingt Vollständigkeit – keine fehlenden Übersetzungen möglich.
 *
 * Nutzung:  const t = useT();  →  {t.landing.heroTitleA}
 */

type LanguageCode = 'de';

const LANGUAGES: Record<LanguageCode, Dictionary> = { de };

const I18nContext = createContext<{ lang: LanguageCode; t: Dictionary }>({ lang: 'de', t: de });

export function LanguageProvider({ children, lang = 'de' as LanguageCode }: { children: React.ReactNode; lang?: LanguageCode }) {
  return (
    <I18nContext.Provider value={{ lang, t: LANGUAGES[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT(): Dictionary {
  return useContext(I18nContext).t;
}

export type { Dictionary };
