/**
 * Pruefungen der Bewerbungs-Uebersetzung.
 *
 * Warum diese Datei: die Form der API und die Form der Ansicht unterscheiden
 * sich an vier Stellen. Wer ungeprueft uebersetzt, bekommt kein Fehlersignal,
 * sondern LEERE FELDER - die Bewerbungsliste zeigt dann keinen Teamnamen mehr,
 * ohne dass etwas fehlschlaegt.
 */
import { describe, expect, it } from 'vitest';
import { findApplicationForTeam, isApplicationStatus, isoDay, planWithdraw, toMyApplication } from '@/lib/applications';
import type { ApiApplication } from '@/lib/api';
import type { MyApplication } from '@/lib/store';

function ausApi(extra: Partial<ApiApplication> = {}): ApiApplication {
  return {
    id: '44444444-4444-4444-4444-444444444444',
    teamId: '33333333-3333-3333-3333-333333333333',
    userId: '55555555-5555-5555-5555-555555555555',
    status: 'offen',
    message: 'Ich moechte mitmachen und kann TypeScript und PostgreSQL.',
    createdAt: '2026-01-02T03:04:05.000Z',
    decidedAt: null,
    ...extra,
  };
}

describe('isoDay', () => {
  it('nimmt den Tag aus einem Zeitstempel', () => {
    expect(isoDay('2026-01-02T03:04:05.000Z')).toBe('2026-01-02');
  });

  it('gibt bei Unbrauchbarem leer zurueck, statt ein Datum zu erfinden', () => {
    // Ein erfundenes Datum waere schlimmer als ein fehlendes: es sieht wie eine
    // Angabe aus.
    for (const wert of ['', 'kein Datum', '2026-1-2', '02.01.2026']) {
      expect(isoDay(wert)).toBe('');
    }
  });
});

describe('isApplicationStatus', () => {
  it('kennt genau die drei Werte der Oberflaeche', () => {
    expect(isApplicationStatus('offen')).toBe(true);
    expect(isApplicationStatus('angenommen')).toBe(true);
    expect(isApplicationStatus('abgelehnt')).toBe(true);
  });

  it('weist alles andere ab', () => {
    for (const wert of ['Offen', 'zurueckgezogen', '', null, 7]) {
      expect(isApplicationStatus(wert)).toBe(false);
    }
  });
});

describe('toMyApplication - die vier Stellen, an denen die Formen abweichen', () => {
  it('holt den Teamnamen aus der Verschachtelung', () => {
    const a = toMyApplication(ausApi({ team: { id: 't', name: 'Team Sonne' } }));
    expect(a.teamName).toBe('Team Sonne');
  });

  it('macht aus createdAt einen Tag', () => {
    expect(toMyApplication(ausApi()).date).toBe('2026-01-02');
  });

  it('uebernimmt die drei bekannten Zustaende', () => {
    expect(toMyApplication(ausApi({ status: 'angenommen' })).status).toBe('angenommen');
    expect(toMyApplication(ausApi({ status: 'abgelehnt' })).status).toBe('abgelehnt');
  });

  it('haelt einen unbekannten Zustand als offen - und faellt nicht durch', () => {
    expect(toMyApplication(ausApi({ status: 'zurueckgezogen' })).status).toBe('offen');
  });

  it('ERFINDET ideaTitle, skills und hours NICHT', () => {
    // Die API traegt sie nicht. Ein Platzhalter waere eine Behauptung ueber
    // eine Angabe, die es nicht gibt.
    const a = toMyApplication(ausApi());
    expect(a.ideaTitle).toBe('');
    expect(a.skills).toBe('');
    expect(a.hours).toBe(0);
  });

  it('behaelt die Bewerbung, auch wenn das Team fehlt', () => {
    const a = toMyApplication(ausApi());
    expect(a.teamName).toBe('');
    expect(a.id).toBe('44444444-4444-4444-4444-444444444444');
  });
});

describe('findApplicationForTeam', () => {
  const liste: MyApplication[] = [toMyApplication(ausApi())];

  it('findet die eigene Bewerbung zu einem Team', () => {
    expect(findApplicationForTeam(liste, '33333333-3333-3333-3333-333333333333')?.id)
      .toBe('44444444-4444-4444-4444-444444444444');
  });

  it('findet nichts bei einem anderen Team', () => {
    expect(findApplicationForTeam(liste, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).toBeUndefined();
  });
});

describe('planWithdraw', () => {
  it('ohne API lokal', () => {
    expect(planWithdraw({ apiMode: false, status: 'offen' })).toEqual({ kind: 'local' });
  });

  it('mit API und offener Bewerbung an den Server', () => {
    expect(planWithdraw({ apiMode: true, status: 'offen' })).toEqual({ kind: 'api' });
  });

  it('eine ENTSCIEDENE Bewerbung wird abgelehnt, nicht stillschweigend versucht', () => {
    // Die API antwortet hier mit 409; der Aufruf waere ein Fehler, den der
    // Nutzer als Fehlermeldung saehe, obwohl sein Wunsch unerfuellbar ist.
    expect(planWithdraw({ apiMode: true, status: 'angenommen' }).kind).toBe('refused');
    expect(planWithdraw({ apiMode: true, status: 'abgelehnt' }).kind).toBe('refused');
  });
});
