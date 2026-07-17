import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Role = 'visitor' | 'user' | 'subscriber';

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
  const [role, setRoleState] = useState<Role>(() => {
    return (localStorage.getItem('ideenschmiede_role') as Role) || 'visitor';
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);
  const [applications, setApplications] = useState<MyApplication[]>(() => load('ideenschmiede_applications', []));
  const [votes, setVotes] = useState<Record<string, 'up' | 'down' | 'yes' | 'no'>>(() => load('ideenschmiede_votes', {}));
  const [allocations, setAllocations] = useState<Record<string, TeamAllocation[]>>(() => load('ideenschmiede_allocations', {}));
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...load('ideenschmiede_settings', DEFAULT_SETTINGS) }));

  const addApplication = useCallback((a: Omit<MyApplication, 'id' | 'date' | 'status'>) => {
    setApplications(prev => {
      const next = [...prev, { ...a, id: `myapp-${Date.now()}`, date: new Date().toISOString().slice(0, 10), status: 'offen' as const }];
      localStorage.setItem('ideenschmiede_applications', JSON.stringify(next));
      return next;
    });
  }, []);

  const withdrawApplication = useCallback((id: string) => {
    setApplications(prev => {
      const next = prev.filter(a => a.id !== id);
      localStorage.setItem('ideenschmiede_applications', JSON.stringify(next));
      return next;
    });
  }, []);

  const castVote = useCallback((key: string, v: 'up' | 'down' | 'yes' | 'no') => {
    setVotes(prev => {
      const next = { ...prev };
      if (next[key] === v) delete next[key];
      else next[key] = v;
      localStorage.setItem('ideenschmiede_votes', JSON.stringify(next));
      return next;
    });
  }, []);

  const saveAllocation = useCallback((ideaId: string, alloc: TeamAllocation[]) => {
    setAllocations(prev => {
      const next = { ...prev, [ideaId]: alloc };
      localStorage.setItem('ideenschmiede_allocations', JSON.stringify(next));
      return next;
    });
  }, []);

  const setRole = useCallback((r: Role) => {
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

  const can = useCallback((action: string) => {
    switch (action) {
      case 'read': return true;
      case 'post':
      case 'comment': return role === 'user' || role === 'subscriber';
      case 'vote':
      case 'invest':
      case 'teams':
      case 'marketplace': return role === 'subscriber';
      default: return false;
    }
  }, [role]);

  return (
    <StoreContext.Provider value={{ role, setRole, can, toast, applications, addApplication, withdrawApplication, votes, castVote, allocations, saveAllocation, settings, saveSettings, resetDemo }}>
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
