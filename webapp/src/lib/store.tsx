import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { IDEAS_PLAN, initialIdeas, loadIdeas, type IdeasLoadResult, type IdeasSource } from '@/lib/dataSource';
import {
  applyToTeam as applyToTeamApi,
  castVote as castVoteApi,
  getCurrentUser,
  getMyApplications,
  withdrawApplication as withdrawApplicationApi,
  withdrawVote as withdrawVoteApi,
} from '@/lib/api';
import { planVote, type VoteValue } from '@/lib/votePlan';
import { planWithdraw, toMyApplications } from '@/lib/applications';
import { canRole, roleFromApi, type Role } from '@/lib/role';
import type { Idea } from '@/lib/data';

// Die Rolle steht in lib/role.ts - EINE Stelle. Hier nur weitergereicht, damit
// die vielen import { type Role } from '@/lib/store' nicht alle angefasst
// werden muessen.
export type { Role };

export const ROLE_CONFIG: Record<Role, { name: string; icon: string; handle: string; description: string }> = {
  visitor: { name: 'Visitor', icon: '🌐', handle: 'Gast', description: 'Nicht angemeldet' },
  user: { name: 'User', icon: '👤', handle: '@tobias_r', description: 'Angemeldet (kostenlos)' },
  subscriber: { name: 'Subscriber', icon: '⭐', handle: '@tobias_r', description: '$120/Jahr – Voller Zugriff' },
};

export interface MyApplication {
  id: string;
  teamId: string;
  teamName: string;
  ideaTitle: string;
  skills: string;
  hours: number;
  message: string;
  date: string;
  status: 'offen' | 'angenommen' | 'abgelehnt';
}

export interface TeamAllocation {
  teamId: string;
  teamName: string;
  pct: number;
  sat: number;
}

export interface Settings {
  handle: string;
  displayName: string;
  bio: string;
  payoutAddress: string;
  xpub: string;
  email: string;
  notifications: boolean[]; // Reihenfolge = de.ts pages.settings.notify
}

export const DEFAULT_SETTINGS: Settings = {
  handle: '@tobias_r',
  displayName: '',
  bio: '',
  payoutAddress: '',
  xpub: '',
  email: '',
  notifications: [true, true, true, true, true],
};

interface StoreState {
  /**
   * Die Ideen - aus lib/dataSource.ts, NICHT mehr direkt aus lib/data.ts.
   *
   * Ohne gesetzte VITE_API_BASE_URL sind das sofort und dauerhaft die
   * Beispieldaten (kein Netzaufruf, kein Hinweis). Ist die API eingeschaltet,
   * kommen sie von dort; scheitert der Aufruf, bleiben es die Beispieldaten und
   * `ideasSource.kind` steht auf 'fallback'.
   */
  ideas: Idea[];
  ideasSource: IdeasSource;
  /** Nochmal versuchen - nur sinnvoll, wenn 'fallback' angezeigt wird. */
  reloadIdeas: () => void;
  getIdea: (id: string) => Idea | undefined;
  role: Role;
  setRole: (r: Role) => void;
  can: (action: 'read' | 'post' | 'comment' | 'vote' | 'invest' | 'teams' | 'marketplace') => boolean;
  toast: (msg: string) => void;
  applications: MyApplication[];
  addApplication: (a: Omit<MyApplication, 'id' | 'date' | 'status'>) => void;
  withdrawApplication: (id: string) => void;
  votes: Record<string, 'up' | 'down' | 'yes' | 'no'>;
  castVote: (key: string, v: 'up' | 'down' | 'yes' | 'no') => void;
  allocations: Record<string, TeamAllocation[]>;
  saveAllocation: (ideaId: string, alloc: TeamAllocation[]) => void;
  settings: Settings;
  saveSettings: (patch: Partial<Settings>) => void;
  resetDemo: () => void;
}

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Die Rolle kommt im API-Betrieb vom SERVER und wird dort auch durchgesetzt.
  // Der Wert in localStorage gilt nur noch fuer den Demo-Betrieb ohne API -
  // sonst koennte jeder Besucher sich im Browser zum Subscriber machen und die
  // Oberflaeche gaebe Rechte frei, die der Server danach mit HTTP 403 abweist.
  const [role, setRoleState] = useState<Role>(() => {
    if (IDEAS_PLAN.mode === 'api') return 'visitor';
    return roleFromApi(localStorage.getItem('ideenschmiede_role'));
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [applications, setApplications] = useState<MyApplication[]>(() => load('ideenschmiede_applications', []));
  const [votes, setVotes] = useState<Record<string, 'up' | 'down' | 'yes' | 'no'>>(() => load('ideenschmiede_votes', {}));
  const [allocations, setAllocations] = useState<Record<string, TeamAllocation[]>>(() => load('ideenschmiede_allocations', {}));
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load('ideenschmiede_settings', DEFAULT_SETTINGS) }));

  // Der Ideen-Stand. initialIdeas() ist synchron: ohne API sind die
  // Beispieldaten schon im ersten Rendering da (die Seite sieht dann genauso
  // aus wie vorher), mit API beginnt es leer und wird ersetzt.
  const [ideaState, setIdeaState] = useState<IdeasLoadResult>(initialIdeas);
  const [ideaReloads, setIdeaReloads] = useState(0);

  useEffect(() => {
    // Ohne API gibt es nichts zu holen - und der Zustand bleibt der Startwert.
    // Das ist der Grund, warum die oeffentliche Seite ohne Backend unveraendert
    // bleibt: es wird nicht einmal ein Netzaufruf versucht.
    if (IDEAS_PLAN.mode !== 'api') return;
    let current = true;
    const controller = new AbortController();
    // loadIdeas() wirft nie: ein Fehler kommt als 'fallback' zurueck. Deshalb
    // gibt es hier kein catch - aber sehr wohl ein current, damit das Ergebnis
    // eines abgebrochenen Laufs (StrictMode, erneuter Versuch) nichts ueberschreibt.
    loadIdeas({ signal: controller.signal }).then((result) => {
      if (current) setIdeaState(result);
    });
    return () => { current = false; controller.abort(); };
  }, [ideaReloads]);

  const reloadIdeas = useCallback(() => { setIdeaReloads((n) => n + 1); }, []);

  /**
   * Setzt die Zaehler EINER Idee auf die Zahlen der API.
   *
   * Der Server ist die Wahrheit: er liest ideas.vote_up/vote_down, die ein
   * Trigger pflegt. Die Antwort des Schreibbefehls wird deshalb uebernommen,
   * statt die Zahl im Browser hochzuzaehlen - eine hochgezaehlte Zahl waere
   * eine Behauptung, die beim naechsten Laden wieder verschwindet.
   */
  const applyVoteCounts = useCallback((ideaId: string, zaehler: { voteUp: number; voteDown: number }) => {
    setIdeaState((prev) => ({
      ...prev,
      ideas: prev.ideas.map((i) =>
        i.id === ideaId ? { ...i, votes: { up: zaehler.voteUp, down: zaehler.voteDown } } : i,
      ),
    }));
  }, []);

  /**
   * Holt die Rolle vom Server - die einzige Quelle im API-Betrieb.
   *
   * Nicht angemeldet (HTTP 401) ist ein erwarteter Zustand und ergibt
   * 'visitor'; getCurrentUser liefert dafuer null und wirft nicht. Ein
   * Netzfehler wird NICHT als Rolle missdeutet: die vorige Rolle bleibt
   * stehen, statt jemanden mitten in der Sitzung zum Gast zu machen.
   */
  const refreshRole = useCallback(async () => {
    if (IDEAS_PLAN.mode !== 'api') return;
    try {
      const nutzer = await getCurrentUser();
      setRoleState(nutzer === null ? 'visitor' : roleFromApi(nutzer.role));
    } catch {
      // Netz weg oder unbrauchbare Antwort - die Rolle bleibt, wie sie war.
    }
  }, []);

  useEffect(() => {
    void refreshRole();
  }, [refreshRole]);

  /**
   * Holt die eigenen Bewerbungen vom Server.
   *
   * Ohne API bleibt es beim localStorage-Stand - der Demo-Betrieb braucht
   * keinen Server und muss sich genau wie vorher verhalten. Ein Fehler ist
   * kein stiller: die vorige Liste bleibt stehen, damit die Seite nicht leer
   * wird, und die Meldung sagt, dass der Stand nicht aktuell ist.
   */
  const refreshApplications = useCallback(async () => {
    if (IDEAS_PLAN.mode !== 'api') return;
    try {
      const liste = await getMyApplications();
      setApplications(toMyApplications(liste));
    } catch (fehler: unknown) {
      setToastMsg('Die eigenen Bewerbungen konnten nicht geladen werden: ' + (fehler instanceof Error ? fehler.message : String(fehler)));
      setToastKey((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    void refreshApplications();
  }, [refreshApplications]);

  const getIdea = useCallback((id: string) => ideaState.ideas.find((i) => i.id === id), [ideaState.ideas]);

  /**
   * Bewerben - im API-Betrieb beim Server, sonst im Browser.
   *
   * Die zusaetzlichen Formularfelder (skills, hours) gehen NICHT mit: die API
   * kennt sie nicht, und ein Feld zu senden, das niemand speichert, waere eine
   * Zusage ueber etwas, das verloren geht. Siehe UEBERGABE.md - das ist eine
   * offene Produktentscheidung, keine Nachlaessigkeit.
   */
  const addApplication = useCallback((a: Omit<MyApplication, 'id' | 'date' | 'status'>) => {
    if (IDEAS_PLAN.mode === 'api') {
      void applyToTeamApi(a.teamId, a.message)
        .then(() => refreshApplications())
        .catch((fehler: unknown) => {
          // Kein stiller Fehlschlag: eine zu kurze Nachricht ergibt 400, eine
          // zweite Bewerbung 409. Beides muss der Nutzer erfahren.
          const text = fehler instanceof Error ? fehler.message : String(fehler);
          setToastMsg(text);
          setToastKey((n) => n + 1);
        });
      return;
    }
    setApplications(prev => {
      const next = [...prev, { ...a, id: `myapp-${Date.now()}`, date: new Date().toISOString().slice(0, 10), status: 'offen' as const }];
      localStorage.setItem('ideenschmiede_applications', JSON.stringify(next));
      return next;
    });
  }, [refreshApplications]);

  /**
   * Bewerbung zuruecknehmen - im API-Betrieb beim Server.
   *
   * Die API nimmt NUR eine offene Bewerbung zurueck (sonst 409, nachgemessen).
   * Die Entscheidung, ob ueberhaupt gefragt wird, steht in lib/applications.ts.
   */
  const withdrawApplication = useCallback((id: string) => {
    const vorher = applications.find((a) => a.id === id);
    const plan = planWithdraw({
      apiMode: IDEAS_PLAN.mode === 'api',
      status: vorher?.status ?? 'offen',
    });

    if (plan.kind === 'local') {
      setApplications(prev => {
        const next = prev.filter(a => a.id !== id);
        localStorage.setItem('ideenschmiede_applications', JSON.stringify(next));
        return next;
      });
      return;
    }
    if (plan.kind === 'refused') {
      setToastMsg(plan.reason);
      setToastKey((n) => n + 1);
      return;
    }

    void withdrawApplicationApi(id)
      .then(() => refreshApplications())
      .catch((fehler: unknown) => {
        const text = fehler instanceof Error ? fehler.message : String(fehler);
        setToastMsg(text);
        setToastKey((n) => n + 1);
      });
  }, [applications, refreshApplications]);

  /**
   * Eine Stimme abgeben - im API-Betrieb an den Server, sonst in den Browser.
   *
   * WAS WOZU GEHOERT, steht in lib/votePlan.ts: dort ist entschieden, welche
   * Stimme ueberhaupt einen Endpunkt hat (Ideen ja, Meilensteine nein), und
   * dass ein zweiter Klick auf denselben Wert ein ZURUECKNEHMEN ist und kein
   * zweites Abstimmen. Hier steht nur die Ausfuehrung.
   *
   * Der Server ist die Wahrheit: der Zaehler kommt aus ideas und wird vom
   * Trigger gepflegt. Der lokale Merker `votes` sagt nur, was DIESER Nutzer
   * gewaehlt hat - er faellt bei einem Fehler nicht auseinander, weil er nur
   * nach einem erfolgreichen Aufruf gesetzt wird.
   */
  const castVote = useCallback((key: string, v: VoteValue) => {
    const merken = () => {
      setVotes(prev => {
        const next = { ...prev };
        if (next[key] === v) delete next[key];
        else next[key] = v;
        localStorage.setItem('ideenschmiede_votes', JSON.stringify(next));
        return next;
      });
    };

    const plan = planVote({ apiMode: IDEAS_PLAN.mode === 'api', key, value: v, current: votes[key] });
    if (plan.kind === 'local') {
      merken();
      return;
    }
    if (plan.kind === 'none') return;

    const lauf = plan.withdraw ? withdrawVoteApi(key) : castVoteApi(key, plan.direction);
    void lauf
      .then((zaehler) => {
        merken();
        // Die Zaehler der API sind die Wahrheit und ersetzen die Anzeige. Der
        // Ideen-Stand wird nachgeladen, damit Liste und Detail dieselben Zahlen
        // zeigen - sonst stuenden dort zwei Staende nebeneinander.
        applyVoteCounts(key, zaehler);
        setIdeaReloads((n) => n + 1);
      })
      .catch((fehler: unknown) => {
        // Kein stiller Fehlschlag: ohne Abonnement antwortet die API mit 403,
        // und das muss der Nutzer erfahren - die Stimme wurde NICHT gezaehlt.
        const text = fehler instanceof Error ? fehler.message : String(fehler);
        setToastMsg(text);
        setToastKey((n) => n + 1);
      });
  }, [votes, applyVoteCounts]);

  const saveAllocation = useCallback((ideaId: string, alloc: TeamAllocation[]) => {
    setAllocations(prev => {
      const next = { ...prev, [ideaId]: alloc };
      localStorage.setItem('ideenschmiede_allocations', JSON.stringify(next));
      return next;
    });
  }, []);

  /**
   * Im API-Betrieb aendert das die Rolle NICHT - und sagt das auch.
   *
   * Die Rolle ist eine Ableitung aus dem Abonnement (ADR-003); die Datenbank
   * setzt sie ueber users_derive_role_trg, die Anwendung schreibt die Spalte nie
   * selbst. Ein Schalter im Browser, der sie trotzdem aendert, waere genau die
   * Faelschung, die diese Datei verhindern soll.
   *
   * Aber nicht stumm: fuenf Stellen in der Oberflaeche rufen setRole auf
   * ('Rolle wechseln', 'Subscriber werden'). Ein stiller No-op machte sie zu
   * toten Knoepfen - der Nutzer klickt und nichts geschieht, ohne Erklaerung.
   * Die Meldung nennt den Grund, damit die Ablehnung verstaendlich ist.
   *
   * Im Demo-Betrieb ohne API bleibt der Schalter erhalten: dort gibt es keinen
   * Server, der widersprechen koennte.
   */
  const setRole = useCallback((r: Role) => {
    if (IDEAS_PLAN.mode === 'api') {
      setToastMsg('Deine Rolle ergibt sich aus deinem Abonnement - sie lässt sich hier nicht umschalten.');
      setToastKey((n) => n + 1);
      return;
    }
    setRoleState(r);
    localStorage.setItem('ideenschmiede_role', r);
  }, []);

  const saveSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem('ideenschmiede_settings', JSON.stringify(next));
      return next;
    });
  }, []);

  const resetDemo = useCallback(() => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('ideenschmiede_'))
      .forEach(k => localStorage.removeItem(k));
    window.location.reload();
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastKey(k => k + 1);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg, toastKey]);

  // Die Regel steht in lib/role.ts neben der Herkunft der Rolle: beide gehoeren
  // zusammen, und getrennt liessen sie sich aendern, ohne dass es auffiele.
  const can = useCallback((action: string) => canRole(role, action), [role]);

  return (
    <StoreContext.Provider value={{ ideas: ideaState.ideas, ideasSource: ideaState.source, reloadIdeas, getIdea, role, setRole, can, toast, applications, addApplication, withdrawApplication, votes, castVote, allocations, saveAllocation, settings, saveSettings, resetDemo }}>
      {children}
      <div key={toastKey} className={`toast ${toastMsg ? 'show' : ''}`}>{toastMsg}</div>
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

/** Hook for scroll-reveal animations */
export function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  });
}

/** Format satoshis nicely */
export function fmtSat(sat: number): string {
  if (sat >= 1_000_000) return (sat / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + 'M';
  if (sat >= 1_000) return (sat / 1_000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + 'k';
  return sat.toLocaleString('de-DE');
}

export function fmtBtc(sat: number): string {
  return '₿ ' + (sat / 100_000_000).toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
