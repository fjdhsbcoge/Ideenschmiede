/**
 * Pruefungen der Datenschicht des Frontends.
 *
 * Warum diese Datei: webapp/ hatte bis hierher KEINEN einzigen Test. Die
 * Datenschicht ist die Stelle, an der eine Backend-Aenderung still zu falschen
 * ANZEIGEN fuehrt - eine Zahl, die nicht mehr passt, faellt im Browser nicht auf.
 * Genau dort wird geprueft.
 *
 * Die Faelle sind absichtlich die UNGUENSTIGEN: was abgewiesen werden MUSS,
 * nicht was zufaellig durchgeht.
 */
import { describe, expect, it } from 'vitest';
import { parseIdea, parseIdeaPage, parseStage, satToNumber, ApiError } from '@/lib/api';
import { mapApiIdea } from '@/lib/dataSource';

/** Eine gueltige Idee in der Form, die GET /api/ideas liefert. */
function idee(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    authorId: '22222222-2222-2222-2222-222222222222',
    title: 'Eine Pruefidee',
    description: 'Eine Beschreibung, deutlich mehr als zwanzig Zeichen lang.',
    tags: ['pruef'],
    language: 'de',
    stage: 'voting',
    discussion: { openedAt: '2026-01-02T03:04:05.000Z', comments: 3, votes: { up: 5, down: 2 } },
    createdAt: '2026-01-02T03:04:05.000Z',
    ...overrides,
  };
}

describe('satToNumber - ein Betrag, der nicht exakt passt, ist ein Fehler', () => {
  it('nimmt eine Zahl, die exakt darstellbar ist', () => {
    expect(satToNumber(2100000000000000)).toBe(2100000000000000);
    expect(satToNumber(0)).toBe(0);
  });

  it('nimmt einen TEXT und rechnet ihn um - so kommt ein grosser Betrag an', () => {
    expect(satToNumber('9007199254740991')).toBe(9007199254740991);
  });

  it('weist einen Betrag ueber 2^53-1 ab, statt still zu runden', () => {
    expect(() => satToNumber('9007199254740993')).toThrow(ApiError);
    expect(() => satToNumber(Number.MAX_SAFE_INTEGER + 2)).toThrow(ApiError);
  });

  it('weist Unfug ab', () => {
    expect(() => satToNumber('keine Zahl')).toThrow(ApiError);
    expect(() => satToNumber('12.5')).toThrow(ApiError);
  });
});

describe('parseStage - ein unbekannter Wert muss auffallen', () => {
  it('nimmt die bekannten Stufen', () => {
    for (const s of ['discussion', 'voting', 'marketplace', 'active', 'completed']) {
      expect(parseStage(s)).toBe(s);
    }
  });

  it('weist einen unbekannten Wert ab, statt ihn durchzureichen', () => {
    expect(() => parseStage('fertig')).toThrow(ApiError);
    expect(() => parseStage('')).toThrow(ApiError);
    expect(() => parseStage(null)).toThrow(ApiError);
  });
});

describe('parseIdea - fehlende Pflichtfelder sind Fehler, zusaetzliche nicht', () => {
  it('nimmt eine vollstaendige Idee', () => {
    const i = parseIdea(idee());
    expect(i.title).toBe('Eine Pruefidee');
    expect(i.discussion.votes.up).toBe(5);
    expect(i.marketplace).toBeUndefined();
  });

  it('ignoriert ein Feld, das die API spaeter hinzufuegt', () => {
    expect(() => parseIdea(idee({ etwasNeues: 42 }))).not.toThrow();
  });

  it('weist ein fehlendes Pflichtfeld ab', () => {
    const ohneTitel = idee();
    delete ohneTitel.title;
    expect(() => parseIdea(ohneTitel)).toThrow(ApiError);
  });

  it('weist einen falschen Typ ab, statt ihn umzudeuten', () => {
    expect(() => parseIdea(idee({ title: 42 }))).toThrow(ApiError);
    expect(() => parseIdea(idee({ tags: 'keine Liste' }))).toThrow(ApiError);
    expect(() => parseIdea(idee({ discussion: { openedAt: 'x', comments: '3', votes: { up: 1, down: 0 } } }))).toThrow(ApiError);
  });

  it('prueft marketplace nur, wenn es da ist', () => {
    expect(() => parseIdea(idee({ marketplace: null }))).not.toThrow();
    const voll = { openedAt: 'a', closesAt: 'b', fundingGoal: 1, raised: 0, investors: 1, creatorShareBp: 2000 };
    expect(() => parseIdea(idee({ marketplace: voll }))).not.toThrow();
    expect(() => parseIdea(idee({ marketplace: { openedAt: 'a' } }))).toThrow(ApiError);
  });
});

describe('parseIdeaPage', () => {
  it('nimmt eine Seite', () => {
    const p = parseIdeaPage({ items: [idee()], count: 1, limit: 20, offset: 0 });
    expect(p.items).toHaveLength(1);
    expect(p.count).toBe(1);
  });

  it('weist items ab, das keine Liste ist', () => {
    expect(() => parseIdeaPage({ items: {}, count: 0, limit: 20, offset: 0 })).toThrow(ApiError);
  });

  it('nennt in der Meldung, WELCHER Eintrag falsch ist', () => {
    try {
      parseIdeaPage({ items: [idee(), idee({ title: 7 })], count: 2, limit: 20, offset: 0 });
      throw new Error('haette werfen muessen');
    } catch (error) {
      expect((error as Error).message).toContain('items[1]');
    }
  });
});

describe('mapApiIdea - die eine Stelle, an der die Formen getauscht werden', () => {
  it('uebernimmt die Stimmen verschachtelt nach flach', () => {
    const i = mapApiIdea(parseIdea(idee()));
    expect(i.votes).toEqual({ up: 5, down: 2 });
    expect(i.commentCount).toBe(3);
  });

  it('laesst die Marktplatzfelder leer, wenn es keine Marktplatzphase gibt', () => {
    const i = mapApiIdea(parseIdea(idee()));
    expect(i.fundingGoal).toBeUndefined();
    expect(i.raised).toBeUndefined();
    expect(i.closesIn).toBeUndefined();
  });

  it('rechnet Betraege um, wenn es eine Marktplatzphase gibt', () => {
    const markt = { openedAt: '2026-01-01T00:00:00.000Z', closesAt: '2026-02-01T00:00:00.000Z', fundingGoal: '12000000', raised: 0, investors: 0, creatorShareBp: 2000 };
    const i = mapApiIdea(parseIdea(idee({ stage: 'marketplace', marketplace: markt })));
    expect(i.fundingGoal).toBe(12000000);
    expect(i.raised).toBe(0);
    expect(i.closesIn).toBe('2026-02-01');
  });

  it('erfindet keine Teams - der Vertrag hat dort kein Gegenstueck', () => {
    expect(mapApiIdea(parseIdea(idee())).teams).toEqual([]);
  });
});
