/**
 * Pruefungen der Stimmen-Entscheidung.
 *
 * Warum diese Datei: castVote im Store kennt vier Werte, die API nur zwei, und
 * der Store SCHALTET UM, waehrend die API ein eigenes DELETE braucht. Genau
 * diese Uebersetzung ist die Stelle, an der eine naive Verdrahtung entweder
 * eine Meilenstein-Stimme an einen Ideen-Endpunkt schickt (Antwort 404) oder
 * eine Stimme stehen laesst, die der Nutzer zuruecknehmen wollte.
 */
import { describe, expect, it } from 'vitest';
import { isIdeaKey, planVote, toApiDirection } from '@/lib/votePlan';

const IDEE = '11111111-1111-1111-1111-111111111111';
/** So heissen die Meilenstein-Stimmen in TeamDetail.tsx. */
const MEILENSTEIN = 'ms-33333333-3333-3333-3333-333333333333-0';

describe('isIdeaKey - nur eine UUID bezeichnet eine Idee', () => {
  it('erkennt eine UUID', () => {
    expect(isIdeaKey(IDEE)).toBe(true);
  });

  it('erkennt eine Meilenstein-Kennung NICHT, obwohl sie eine UUID enthaelt', () => {
    // Das ist der Punkt: eine laxe Pruefung ('enthaelt eine UUID') wuerde die
    // Meilenstein-Stimme fuer eine Idee halten und an den falschen Endpunkt
    // schicken.
    expect(isIdeaKey(MEILENSTEIN)).toBe(false);
  });

  it('weist Unfug ab', () => {
    for (const wert of ['', 'abc', IDEE + 'x', 'ms-0']) {
      expect(isIdeaKey(wert)).toBe(false);
    }
  });
});

describe('toApiDirection - nur zwei der vier Werte haben einen Endpunkt', () => {
  it('uebersetzt up und down', () => {
    expect(toApiDirection('up')).toBe('up');
    expect(toApiDirection('down')).toBe('down');
  });

  it('gibt fuer yes und no null - dafuer gibt es keinen Endpunkt', () => {
    expect(toApiDirection('yes')).toBeNull();
    expect(toApiDirection('no')).toBeNull();
  });
});

describe('planVote - was tatsaechlich geschieht', () => {
  it('ohne API bleibt alles lokal - die oeffentliche Seite kennt keinen Server', () => {
    expect(planVote({ apiMode: false, key: IDEE, value: 'up', current: undefined })).toEqual({ kind: 'local' });
  });

  it('eine Meilenstein-Stimme bleibt lokal, auch MIT API', () => {
    const plan = planVote({ apiMode: true, key: MEILENSTEIN, value: 'yes', current: undefined });
    expect(plan).toEqual({ kind: 'local' });
  });

  it('yes/no auf einer Idee bleibt lokal - geraten wird nicht', () => {
    const plan = planVote({ apiMode: true, key: IDEE, value: 'yes', current: undefined });
    expect(plan).toEqual({ kind: 'local' });
  });

  it('erste Stimme: POST ohne Zuruecknahme', () => {
    expect(planVote({ apiMode: true, key: IDEE, value: 'up', current: undefined }))
      .toEqual({ kind: 'api', direction: 'up', withdraw: false });
  });

  it('RICHTUNG WECHSELN: POST, kein Zuruecknehmen', () => {
    expect(planVote({ apiMode: true, key: IDEE, value: 'down', current: 'up' }))
      .toEqual({ kind: 'api', direction: 'down', withdraw: false });
  });

  it('DERSELBE WERT ERNEUT: das ist ein Zuruecknehmen, kein zweites Abstimmen', () => {
    // Hier geht die naive Verdrahtung schief: der Store meint Umschalten, die
    // API braucht DELETE. Ohne diese Zeile bliebe die Stimme stehen.
    expect(planVote({ apiMode: true, key: IDEE, value: 'up', current: 'up' }))
      .toEqual({ kind: 'api', direction: 'up', withdraw: true });
  });

  it('kein API-Betrieb: auch bei gleichem Wert lokal', () => {
    expect(planVote({ apiMode: false, key: IDEE, value: 'up', current: 'up' })).toEqual({ kind: 'local' });
  });
});
