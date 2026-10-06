/**
 * Pruefungen der schreibenden API-Aufrufe.
 *
 * Warum diese Datei: die neuen Endpunkte (Stimmen, Bewerbungen) senden RUEMPFE
 * und brauchen eine Sitzung. Beides kann man am Ergebnistyp nicht ablesen. Hier
 * wird deshalb kontrolliert, was WIRKLICH gesendet wird: Methode, Pfad, Rumpf,
 * credentials.
 *
 * Kein Netz: fetch wird ersetzt. Die Erwartungen sind die unguenstigen Faelle -
 * ein 403 wegen fehlendem Abonnement ist ein ERWARTETER Zustand und muss als
 * ApiError mit Status ankommen, nicht als stiller Erfolg.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  applyToTeam,
  castVote,
  getMyApplications,
  getVotes,
  withdrawVote,
} from '@/lib/api';

interface Abgefangen {
  url: string;
  method: string;
  body: unknown;
  credentials: string | undefined;
  contentType: string | undefined;
}

let abgefangen: Abgefangen[] = [];

/** Ersetzt fetch und merkt sich, was gesendet wurde. */
function antworteMit(status: number, payload: unknown): void {
  abgefangen = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    abgefangen.push({
      url,
      method: init.method ?? 'GET',
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
      credentials: init.credentials,
      contentType: (init.headers as Record<string, string> | undefined)?.['content-type'],
    });
    return new Response(payload === null ? '' : JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const IDEE = '11111111-1111-1111-1111-111111111111';
const TEAM = '33333333-3333-3333-3333-333333333333';

describe('castVote - eine Stimme senden', () => {
  it('sendet POST mit der Richtung und liest die Zaehler', async () => {
    antworteMit(200, { voteUp: 4, voteDown: 1 });
    const zaehler = await castVote(IDEE, 'up');
    expect(zaehler).toEqual({ voteUp: 4, voteDown: 1 });
    expect(abgefangen).toHaveLength(1);
    expect(abgefangen[0]?.method).toBe('POST');
    expect(abgefangen[0]?.url).toBe('/api/ideas/' + IDEE + '/vote');
    expect(abgefangen[0]?.body).toEqual({ direction: 'up' });
    // Der Kopf gehoert zum Rumpf: ohne ihn sieht die API keinen JSON-Koerper.
    expect(abgefangen[0]?.contentType).toBe('application/json');
  });

  it('sendet das Sitzungs-Cookie mit - ohne das waere der Aufruf anonym', async () => {
    antworteMit(200, { voteUp: 1, voteDown: 0 });
    await castVote(IDEE, 'down');
    expect(abgefangen[0]?.credentials).toBe('include');
  });

  it('gibt bei HTTP 403 den Status weiter - fehlendes Abonnement ist ein Zustand', async () => {
    antworteMit(403, { error: { code: 'vote_requires_subscription', message: 'Stimmrecht erfordert ein aktives Abonnement (ADR-003).' } });
    await expect(castVote(IDEE, 'up')).rejects.toMatchObject({ status: 403 });
  });

  it('weist eine unbekannte Richtung ab, BEVOR gesendet wird', async () => {
    antworteMit(200, { voteUp: 0, voteDown: 0 });
    await expect(castVote(IDEE, 'seitwaerts' as never)).rejects.toThrow(ApiError);
    expect(abgefangen).toHaveLength(0);
  });

  it('weist eine Antwort ab, die die Zaehler nicht traegt', async () => {
    antworteMit(200, { up: 1, down: 0 });
    await expect(castVote(IDEE, 'up')).rejects.toThrow(ApiError);
  });
});

describe('withdrawVote und getVotes', () => {
  it('DELETE ohne Rumpf', async () => {
    antworteMit(200, { voteUp: 0, voteDown: 0 });
    await withdrawVote(IDEE);
    expect(abgefangen[0]?.method).toBe('DELETE');
    expect(abgefangen[0]?.body).toBeUndefined();
    // Kein Rumpf, also auch kein content-type: ein Kopf ohne Rumpf ist eine
    // Zusage ueber etwas, das nicht da ist.
    expect(abgefangen[0]?.contentType).toBeUndefined();
  });

  it('GET liefert dieselbe Form wie die schreibenden Aufrufe', async () => {
    antworteMit(200, { voteUp: 2, voteDown: 3 });
    const zaehler = await getVotes(IDEE);
    expect(zaehler).toEqual({ voteUp: 2, voteDown: 3 });
    expect(abgefangen[0]?.method).toBe('GET');
  });
});

function bewerbung(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '44444444-4444-4444-4444-444444444444',
    teamId: TEAM,
    userId: '55555555-5555-5555-5555-555555555555',
    status: 'offen',
    message: 'Ich moechte mitmachen und kann TypeScript und PostgreSQL.',
    createdAt: '2026-01-02T03:04:05.000Z',
    decidedAt: null,
    ...extra,
  };
}

describe('Bewerbungen', () => {
  it('sendet die Bewerbung und liest sie aus der Huelle { application }', async () => {
    antworteMit(201, { application: bewerbung() });
    const a = await applyToTeam(TEAM, 'Ich moechte mitmachen und kann TypeScript und PostgreSQL.');
    expect(a.status).toBe('offen');
    expect(a.decidedAt).toBeNull();
    expect(abgefangen[0]?.method).toBe('POST');
    expect(abgefangen[0]?.url).toBe('/api/teams/' + TEAM + '/applications');
    expect(abgefangen[0]?.body).toEqual({ message: 'Ich moechte mitmachen und kann TypeScript und PostgreSQL.' });
    expect(abgefangen[0]?.contentType).toBe('application/json');
  });

  it('nimmt eine Liste mit verschachteltem Team', async () => {
    antworteMit(200, { items: [bewerbung({ team: { id: TEAM, name: 'Team Sonne' } })], count: 1 });
    const liste = await getMyApplications();
    expect(liste).toHaveLength(1);
    expect(liste[0]?.team?.name).toBe('Team Sonne');
  });

  it('verlangt team und applicant NICHT - sie fehlen, wenn sie nicht gefragt wurden', async () => {
    antworteMit(200, { items: [bewerbung()], count: 1 });
    const liste = await getMyApplications();
    expect(liste[0]?.team).toBeUndefined();
    expect(liste[0]?.applicant).toBeUndefined();
  });

  it('weist eine Liste ab, die keine ist', async () => {
    antworteMit(200, { items: {}, count: 0 });
    await expect(getMyApplications()).rejects.toThrow(ApiError);
  });

  it('weist eine Bewerbung ohne Pflichtfeld ab', async () => {
    const kaputt = bewerbung();
    delete kaputt.message;
    antworteMit(200, { items: [kaputt], count: 1 });
    await expect(getMyApplications()).rejects.toThrow(ApiError);
  });

  it('gibt bei HTTP 409 den Status weiter - schon beworben ist ein Zustand', async () => {
    antworteMit(409, { error: { code: 'application_exists', message: 'Fuer dieses Team liegt bereits eine Bewerbung vor.' } });
    await expect(applyToTeam(TEAM, 'ein zweiter Versuch mit genug Zeichen')).rejects.toMatchObject({ status: 409 });
  });
});
