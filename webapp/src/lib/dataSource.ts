/**
 * Die Schicht, die entscheidet, woher die Ideen kommen.
 *
 * Warum es diese Datei gibt: die oeffentliche Seite (GitHub Pages,
 * https://ideenschmiede-forum.de/) wird OHNE laufende API ausgeliefert. Sie
 * darf durch die Anbindung an das Backend nicht kaputtgehen. Deshalb steht die
 * Entscheidung "API oder Beispieldaten" an genau einer Stelle und nicht in den
 * Seiten: die Seiten kennen nur noch die Ansichtsform (`Idea` aus lib/data.ts)
 * und erfahren nie, woher sie stammt.
 *
 * Die drei Faelle:
 *
 *   1. Keine Umgebungsvariable gesetzt  -> Beispieldaten, KEIN Netzaufruf,
 *      kein Hinweis. Das ist der Standard und damit exakt das Verhalten der
 *      heute laufenden Seite.
 *   2. VITE_API_BASE_URL (oder VITE_IDEAS_SOURCE=api) gesetzt und die API
 *      antwortet -> echte Daten.
 *   3. API eingeschaltet, aber der Aufruf scheitert (Netz, 5xx, ungueltige
 *      Antwort) -> Beispieldaten UND ein sichtbarer Hinweis mit dem Grund
 *      (`kind: 'fallback'`). Nichts wird still verschluckt.
 *
 * Der Unterschied zwischen Fall 1 und Fall 3 ist der Grund, warum es zwei
 * verschiedene Arten von "Beispieldaten" gibt: nur im Fehlerfall erscheint der
 * Hinweis in der Oberflaeche. Ohne API ist der Beispieldatenstand der
 * Normalzustand und braucht keine Warnung.
 *
 * Die Abbildung der API-Form in die Ansichtsform steht in mapApiIdea() - EINE
 * Stelle. Die beiden Formen unterscheiden sich (verschachtelt gegen flach,
 * api/migrations/README.md und ARCHITECTURE.md Anhang 5.2 gegen lib/data.ts);
 * verstreut ueber die Seiten waere das nicht nachvollziehbar.
 */
import { ApiError, apiBaseUrl, listIdeas, satToNumber, viteEnv, type ApiIdea } from '@/lib/api';
import { ideas as sampleIdeaData, type Idea } from '@/lib/data';

// ---------------------------------------------------------------------------
// Die Entscheidung
// ---------------------------------------------------------------------------

/** Wie oft die API hoechstens gefragt wird - 100 ist ihre Obergrenze (api/src/app.ts). */
export const IDEAS_LIMIT = 100;

/** Wodurch die Entscheidung zustande kam - fuer Diagnose und README. */
export type IdeasDecision = 'base-url' | 'flag-api' | 'flag-sample' | 'default';

export interface IdeasPlan {
  mode: 'api' | 'sample';
  /** Die Adresse, die im API-Fall angefragt wird. */
  baseUrl: string;
  decidedBy: IdeasDecision;
}

/** Der Wert des ausdruecklichen Schalters, oder '' wenn er fehlt. */
function sourceFlag(): string {
  const raw = viteEnv().VITE_IDEAS_SOURCE;
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/** Ist VITE_API_BASE_URL wirklich gesetzt? apiBaseUrl() liefert sonst '/api'. */
function baseUrlIsSet(): boolean {
  const raw = viteEnv().VITE_API_BASE_URL;
  return typeof raw === 'string' && raw.trim() !== '';
}

/**
 * Die Entscheidung, einmal beim Laden des Moduls.
 *
 * Reihenfolge: der ausdrueckliche Schalter schlaegt die blosse Anwesenheit der
 * Basis-URL. `VITE_IDEAS_SOURCE=sample` ist damit ein Notaus: es schaltet die
 * API auch dann ab, wenn VITE_API_BASE_URL gesetzt ist - genau der Fall, in dem
 * man die oeffentliche Seite schnell wieder auf Beispieldaten stellen muss.
 * Unbekannte Werte werden wie "nicht gesetzt" behandelt (siehe .env.example).
 */
function decidePlan(): IdeasPlan {
  const flag = sourceFlag();
  const baseUrl = apiBaseUrl();
  if (flag === 'sample') return { mode: 'sample', baseUrl, decidedBy: 'flag-sample' };
  if (flag === 'api') return { mode: 'api', baseUrl, decidedBy: 'flag-api' };
  if (baseUrlIsSet()) return { mode: 'api', baseUrl, decidedBy: 'base-url' };
  return { mode: 'sample', baseUrl, decidedBy: 'default' };
}

export const IDEAS_PLAN: IdeasPlan = decidePlan();

// ---------------------------------------------------------------------------
// Die Quelle der geladenen Ideen
// ---------------------------------------------------------------------------

/** Warum auf die Beispieldaten zurueckgefallen wurde. */
export type FallbackReason = 'unreachable' | 'server' | 'rejected' | 'invalid' | 'unknown';

/**
 * Woher der aktuelle Stand stammt.
 *
 * 'sample' und 'fallback' zeigen beide die Beispieldaten, bedeuten aber etwas
 * anderes: 'sample' ist der Normalzustand ohne API, 'fallback' ein Fehler, der
 * gemeldet werden muss. Nur 'fallback' loest den Hinweis in der Oberflaeche aus
 * (siehe DataSourceNotice in components/bits.tsx).
 */
export type IdeasSource =
  | { kind: 'loading'; baseUrl: string }
  | { kind: 'sample'; decidedBy: IdeasDecision }
  | { kind: 'api'; baseUrl: string; loaded: number; total: number }
  | { kind: 'fallback'; baseUrl: string; reason: FallbackReason; detail: string };

export interface IdeasLoadResult {
  ideas: Idea[];
  source: IdeasSource;
}

/**
 * Der Stand VOR dem ersten Aufruf - synchron, ohne Netz.
 *
 * Ohne API sind das sofort die Beispieldaten: die Seite rendert dann schon im
 * ersten Durchlauf vollstaendig, ohne leeren Zwischenzustand. Mit API beginnt
 * sie leer ('loading') und wird nach dem Aufruf ersetzt.
 */
export function initialIdeas(): IdeasLoadResult {
  if (IDEAS_PLAN.mode === 'sample') {
    return {
      ideas: sampleIdeaData,
      source: { kind: 'sample', decidedBy: IDEAS_PLAN.decidedBy },
    };
  }
  return { ideas: [], source: { kind: 'loading', baseUrl: IDEAS_PLAN.baseUrl } };
}

// ---------------------------------------------------------------------------
// Fehler einordnen
// ---------------------------------------------------------------------------

/**
 * Ordnet einen Fehler einem sichtbaren Grund zu.
 *
 * Alle Faelle kommen aus lib/api.ts und sind dort schon unterschieden; hier
 * werden sie nur benannt:
 *   - ein Status ab 500      -> der Server hat versagt ('server')
 *   - ein Status ab 400      -> die Anfrage wurde abgelehnt ('rejected')
 *   - ein Status unter 400, aber ein Fehler: die Antwort war kein JSON, obwohl
 *     der Server sie ausgeliefert hat ('invalid')
 *   - kein Status, aber eine Adresse: es kam gar keine Antwort ('unreachable')
 *   - kein Status und keine Adresse: die Formpruefung in api.ts hat die Antwort
 *     verworfen - `fail()` wirft ohne URL ('invalid')
 *
 * Der letzte Punkt ist der Grund, warum hier nicht einfach "kein Status =
 * kein Netz" steht: eine Antwort mit falscher Form hat einen Status, eine
 * fehlende Antwort nicht.
 */
function classify(error: unknown): FallbackReason {
  if (error instanceof ApiError) {
    if (error.status !== null) {
      if (error.status >= 500) return 'server';
      if (error.status >= 400) return 'rejected';
      return 'invalid';
    }
    return error.url === '' ? 'invalid' : 'unreachable';
  }
  if (error instanceof Error && error.name === 'AbortError') return 'unreachable';
  return 'unknown';
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// ---------------------------------------------------------------------------
// Die Abbildung: API-Form -> Ansichtsform
// ---------------------------------------------------------------------------

/** Ein ISO-Zeitstempel auf seinen Tag gekuerzt - die Ansicht zeigt Text, kein Datum. */
function isoDay(value: string): string {
  return value.slice(0, 10);
}

/**
 * Setzt ein Idea der API in die Form um, die die Seiten lesen.
 *
 * Was der Vertrag NICHT hergibt, wird nicht erfunden, sondern leer gelassen
 * (siehe README, "Was die Abbildung nicht kann"):
 *   - `author`: der Vertrag kennt nur `authorId` (eine UUID). Es gibt keinen
 *     Anzeigenamen; die Anzeige bekommt deshalb die Kennung selbst zu sehen.
 *     Sie ist ehrlicher als ein aus der UUID gebastelter Kunstname.
 *   - `problem`/`solution`/`market`: eigener Fliesstext je Abschnitt ist im
 *     Vertrag nicht vorgesehen, nur `description`.
 *   - `comments`: die API liefert eine ANZAHL (`discussion.comments`), keine
 *     Liste. Sie landet in `commentCount`; die Liste bleibt leer.
 *   - `teams`, `sharePrice`: kein Gegenstueck im Vertrag.
 *   - `time`/`closesIn`: die API liefert Zeitstempel, die Ansicht zeigt Text -
 *     hier der Tag (YYYY-MM-TT). Eine deutsche Relative-Angabe ("vor 2 Tagen")
 *     gehoert in die Sprachdatei, nicht in die Abbildung.
 */
export function mapApiIdea(api: ApiIdea): Idea {
  const market = api.marketplace;
  return {
    id: api.id,
    title: api.title,
    author: api.authorId,
    time: isoDay(api.createdAt),
    tags: api.tags,
    stage: api.stage,
    description: api.description,
    problem: '',
    solution: '',
    market: '',
    comments: [],
    commentCount: api.discussion.comments,
    votes: { up: api.discussion.votes.up, down: api.discussion.votes.down },
    fundingGoal: market ? satToNumber(market.fundingGoal, 'marketplace.fundingGoal') : undefined,
    raised: market ? satToNumber(market.raised, 'marketplace.raised') : undefined,
    investors: market ? market.investors : undefined,
    closesIn: market ? isoDay(market.closesAt) : undefined,
    teams: [],
  };
}

// ---------------------------------------------------------------------------
// Laden
// ---------------------------------------------------------------------------

export interface LoadIdeasOptions {
  signal?: AbortSignal;
  limit?: number;
}

/**
 * Holt die Ideen aus der eingestellten Quelle.
 *
 * Diese Funktion WIRFT NIE. Ein Fehler ist hier ein Ergebnis, kein Abbruch:
 * die Seite muss auch dann stehen, wenn das Backend liegt. Der Grund steht im
 * Ergebnis (`kind: 'fallback'` mit `reason` und `detail`) und wird angezeigt.
 */
export async function loadIdeas(options: LoadIdeasOptions = {}): Promise<IdeasLoadResult> {
  // Ohne API wird gar nicht erst angefragt - kein Netzaufruf, kein Hinweis.
  if (IDEAS_PLAN.mode === 'sample') return initialIdeas();

  const limit = options.limit ?? IDEAS_LIMIT;
  try {
    const page = await listIdeas({ limit, offset: 0, signal: options.signal });
    return {
      ideas: page.items.map(mapApiIdea),
      source: {
        kind: 'api',
        baseUrl: IDEAS_PLAN.baseUrl,
        loaded: page.items.length,
        total: page.count,
      },
    };
  } catch (error) {
    return {
      ideas: sampleIdeaData,
      source: {
        kind: 'fallback',
        baseUrl: IDEAS_PLAN.baseUrl,
        reason: classify(error),
        detail: describeError(error),
      },
    };
  }
}
