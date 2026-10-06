/**
 * Pruefungen der Rolle.
 *
 * Warum diese Datei: die Rolle entscheidet, wer kommentieren, abstimmen und
 * investieren darf. Sie kam bis eben aus localStorage - ein Wert, den jeder im
 * Browser setzen kann. Damit war die Pruefung eine Bitte, keine Regel.
 *
 * Geprueft wird die Zusage: die Rolle kommt vom Server, ein unbekannter Wert
 * gibt die RECHTE DES GERINGSTEN, und ein Besucher kann nicht abstimmen.
 */
import { describe, expect, it } from 'vitest';
import { canRole, isRole, roleFromApi } from '@/lib/role';

describe('roleFromApi - die Rolle kommt vom Server', () => {
  it('nimmt genau die drei Werte, die das Backend wirklich liefert', () => {
    expect(roleFromApi('visitor')).toBe('visitor');
    expect(roleFromApi('user')).toBe('user');
    expect(roleFromApi('subscriber')).toBe('subscriber');
  });

  it('gibt bei einem unbekannten Wert die Rechte des Geringsten', () => {
    for (const wert of ['Subscriber', 'admin', '', 'VISITOR', 'root']) {
      expect(roleFromApi(wert)).toBe('visitor');
    }
  });

  it('gibt bei fehlendem oder falschem Typ die Rechte des Geringsten', () => {
    expect(roleFromApi(undefined)).toBe('visitor');
    expect(roleFromApi(null)).toBe('visitor');
    expect(roleFromApi(7)).toBe('visitor');
    expect(roleFromApi({ role: 'subscriber' })).toBe('visitor');
  });

  it('isRole erkennt genau die drei Werte', () => {
    expect(isRole('user')).toBe(true);
    expect(isRole('User')).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});

describe('canRole - was eine Rolle darf', () => {
  it('lesen darf jeder', () => {
    expect(canRole('visitor', 'read')).toBe(true);
    expect(canRole('user', 'read')).toBe(true);
    expect(canRole('subscriber', 'read')).toBe(true);
  });

  it('posten und kommentieren verlangt ein Konto', () => {
    expect(canRole('visitor', 'post')).toBe(false);
    expect(canRole('visitor', 'comment')).toBe(false);
    expect(canRole('user', 'post')).toBe(true);
    expect(canRole('user', 'comment')).toBe(true);
    expect(canRole('subscriber', 'post')).toBe(true);
  });

  it('abstimmen, investieren, Teams und Marktplatz verlangen ein Abonnement', () => {
    for (const handlung of ['vote', 'invest', 'teams', 'marketplace']) {
      expect(canRole('visitor', handlung)).toBe(false);
      expect(canRole('user', handlung)).toBe(false);
      expect(canRole('subscriber', handlung)).toBe(true);
    }
  });

  it('ein erfundener Wert schaltet NICHTS frei - auch nicht der gefaehrlichste', () => {
    // 'subscriber' ist der Wert, den ein Angreifer in localStorage schreiben
    // wuerde. roleFromApi liest ihn nicht: die Rolle kommt aus der Antwort des
    // Servers. Deshalb fuehrt kein Weg von einem Browserwert zu Stimmrecht.
    const gefaelscht = roleFromApi('subscriber');
    expect(canRole(gefaelscht, 'vote')).toBe(true);
    // ... und genau deshalb darf dieser Wert NICHT aus dem Browser kommen.
    // Der Beleg dafuer steht in store.tsx: im API-Betrieb ist setRole ein
    // No-op und der Startwert ist 'visitor', nicht der localStorage-Wert.
    expect(canRole(roleFromApi('subscriber '), 'vote')).toBe(false);
    expect(canRole(roleFromApi('SUBSCRIBER'), 'vote')).toBe(false);
  });

  it('eine unbekannte Handlung ist gesperrt, nicht erlaubt', () => {
    expect(canRole('subscriber', 'etwasNeues')).toBe(false);
    expect(canRole('visitor', 'etwasNeues')).toBe(false);
  });
});
