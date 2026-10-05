-- =============================================================================
-- Ideenschmiede - Migration 005_ratelimit
-- =============================================================================
-- Ratenbegrenzung fuer die OEFFENTLICHEN Auth-Endpunkte (Roadmap Phase 3.2,
-- Nachtrag). Legt EINE Tabelle an, sonst nichts:
--
--   auth_rate_events - je ERLAUBTEM Aufruf eine Zeile mit Zeitstempel.
--
-- Voraussetzung: 001..004 sind eingespielt. 001 bis 004 werden NICHT angefasst.
-- Einzeln einspielbar:
--     psql -d ideenschmiede -v ON_ERROR_STOP=1 -f 005_ratelimit.sql
--
-- -----------------------------------------------------------------------------
-- Warum die Ratenbegrenzung in der DATENBANK steht und nicht im Arbeitsspeicher
-- -----------------------------------------------------------------------------
-- POST /api/auth/challenge ist der einzige Endpunkt dieser API, den ein
-- Unbeteiligter OHNE Anmeldung in einer Schleife aufrufen kann, und jeder Aufruf
-- schreibt eine Zeile. Ohne Begrenzung ist das ein Schreibverstaerker: ein
-- einziger Aufrufer ohne Konto kann auth_challenges und auth_rate_events
-- unbegrenzt wachsen lassen.
--
-- Ein Zaehler im Arbeitsspeicher (Map, Token-Bucket im Prozess) waere billiger,
-- aber er hat zwei Eigenschaften, die ihn hier unbrauchbar machen:
--
--   * Ein Neustart vergisst ihn. Wer die Grenze gerade erreicht hat, darf nach
--     dem Neustart sofort weiter - ein Neustart ist damit ein Umgehungsweg.
--   * Er gilt nur fuer EINEN Prozess. ADR-004 laesst Foederation und mehrere
--     Instanzen ausdruecklich zu; bei n Instanzen hinter einem Lastverteiler
--     waere die wirksame Grenze das n-fache der eingestellten.
--
-- Die Tabelle macht die Begrenzung zu einer Eigenschaft des Systems statt des
-- Prozesses - dieselbe Begruendung wie bei auth_challenges in 002_auth.sql.
--
-- -----------------------------------------------------------------------------
-- Warum EREIGNISZEILEN (Zeitstempel) und kein Zaehler JE FENSTER
-- -----------------------------------------------------------------------------
-- Zwei Formen waeren moeglich:
--
--   (a) Ereigniszeilen: eine Zeile je Aufruf mit Zeitstempel, gezaehlt wird
--       ueber ein gleitendes Fenster: count(*) WHERE moment > now() - fenster
--   (b) Zaehler je Fenster: ein Schluessel aus Adresse und Fensternummer,
--       ein UPDATE ... SET treffer = treffer + 1
--
-- Gewaehlt ist (a). Die Gruende, in der Reihenfolge ihres Gewichts:
--
--   1. (b) hat eine harte Kante am Fensterrand. Bei 30 Aufrufen je Minute sind
--      im ungluecklichsten Fall 60 Aufrufe in zwei Sekunden erlaubt - 29 kurz
--      vor dem Fensterwechsel, 30 direkt danach. Genau dieses Verhalten ist der
--      uebliche Weg, eine Zaehler-Begrenzung zu umgehen. Das gleitende Fenster
--      aus (a) hat diese Kante nicht: zu jedem Zeitpunkt zaehlen die letzten
--      vollen AUTH_RATE_WINDOW_MS.
--   2. (a) braucht keine Zeitzonen- und Kalenderarithmetik. PostgreSQL rechnet
--      in timestamptz; bei (b) muesste die Fensternummer aus der Uhr gebildet
--      werden (date_trunc / floor(epoch / fenster)) und geprueft werden, ob die
--      Zeile noch zum aktuellen Fenster gehoert - mehr Code, mehr Annahmen.
--   3. (a) ist ehrlich zurueckstellbar: ein geloeschter Eintrag heisst "dieser
--      Aufruf hat nicht stattgefunden". Bei (b) ist ein Zaehler ein Zustand,
--      dessen Herkunft man nicht mehr sieht.
--
-- Der Preis von (a) ist die Zeilenmenge: eine Zeile je ERLAUBTEM Aufruf (bei
-- einer abgewiesenen Anfrage wird NICHT geschrieben - sonst waere die Tabelle
-- selbst der Schreibverstaerker, den sie verhindern soll). Bei der Grenze aus
-- src/env.ts (30 je Minute) sind das im Dauerbetrieb hoechstens 30 Zeilen je
-- Minute und Quelle. Alte Zeilen raeumt cleanupAuth() aus src/cleanup.ts weg
-- (Skript api/scripts/cleanup-auth.mjs, zusaetzlich beim Serverstart).
--
-- Kanonische Bezeichner (api/CONTRACT.md): snake_case, Zeitstempel timestamptz.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. auth_rate_events - eine Zeile je erlaubtem Aufruf
-- =============================================================================
CREATE TABLE auth_rate_events (
    -- Fortlaufende Nummer statt uuid: diese Zeilen sind keine Fachobjekte, auf
    -- die sich irgendetwas beruft - sie sind ein Messwert mit Verfallsdatum.
    -- bigint, weil hier im Dauerbetrieb die meisten Zeilen dieser Datenbank
    -- entstehen; ein int4 waere nach 2,1 Milliarden Aufrufen am Ende.
    id       bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Der Topf, in dem gezaehlt wird. Heute gibt es genau einen
    -- ('auth.challenge'); die Spalte steht trotzdem da, damit ein zweiter
    -- oeffentlicher Endpunkt nicht eine zweite Tabelle braucht - und damit
    -- sichtbar ist, WELCHE Grenze gegriffen hat, falls es je mehrere gibt.
    bucket   text        NOT NULL,

    -- Der Schluessel: die Client-Adresse (IPv4/IPv6 als Text) oder 'unknown',
    -- wenn keine Adresse feststellbar war (siehe src/rateLimit.ts,
    -- clientAddress()). Kein Netzwerktyp (inet/cidr), weil hier auch der
    -- Nicht-Wert 'unknown' stehen koennen muss und weil die Anwendung die
    -- Adresse bereits als Zeichenkette hat.
    --
    -- WICHTIG: Diese Spalte ist die Adresse der VERBINDUNG, nicht der Wert aus
    -- X-Forwarded-For - ausser die Verbindung kommt aus AUTH_TRUSTED_PROXIES.
    -- Ein faelschbarer Kopf darf die Begrenzung nicht aushebeln; die Grenze
    -- dieser Wahl steht in api/README.md ("Ratenbegrenzung", "Grenzen").
    key      text        NOT NULL,

    -- Der Zeitpunkt des Aufrufs. Gesetzt von der Anwendung (injizierbare Uhr,
    -- AuthConfig.now), nicht von now(): die Begrenzung soll mit derselben Uhr
    -- rechnen wie der Rest der Anmeldung - und pruefbar sein, ohne echte
    -- Wartezeiten abzuwarten.
    moment   timestamptz NOT NULL,

    CONSTRAINT auth_rate_events_bucket_check
        CHECK (bucket <> ''),
    CONSTRAINT auth_rate_events_key_check
        CHECK (key <> '')
);

-- Der EINZIGE Index, den diese Tabelle braucht: die Zaehlabfrage lautet
-- immer "bucket = $1 AND key = $2 AND moment > $3" und wird hier zur
-- Bereichssuche statt zum Filter ueber die ganze Tabelle. Reihenfolge der
-- Spalten: erst die beiden Gleichheiten, dann der Bereich - so liegt der
-- Bereich am Ende des Index und die Zeilen eines Schluessels beieinander.
--
-- Es gibt bewusst KEINEN Index auf moment allein: das Aufraeumen loescht nach
-- moment, und die Zeilen sind nach moment grob vorsortiert (die Nummer waechst
-- mit der Zeit). Ein zweiter Index kostete bei jedem Schreibvorgang mit, ohne
-- dass eine Abfrage ihn braucht.
CREATE INDEX auth_rate_events_bucket_key_moment_idx
    ON auth_rate_events (bucket, key, moment);


-- =============================================================================
-- 2. Einheiten und Absichten dokumentieren
-- =============================================================================
COMMENT ON TABLE auth_rate_events IS
    'Ratenbegrenzung der oeffentlichen Auth-Endpunkte: eine Zeile je ERLAUBTEM Aufruf, gezaehlt ueber ein gleitendes Fenster. Abgewiesene Aufrufe (429) werden NICHT geschrieben. Alte Zeilen entfernt cleanupAuth() aus src/cleanup.ts. In der Datenbank statt im Arbeitsspeicher, weil ein Zaehler im Speicher beim Neustart verloren geht und bei mehreren Instanzen (ADR-004) nur je Prozess gilt.';
COMMENT ON COLUMN auth_rate_events.bucket IS
    'Name der Grenze, heute auth.challenge. Mehrere Grenzen teilen sich diese Tabelle.';
COMMENT ON COLUMN auth_rate_events.key IS
    'Client-Adresse der Verbindung (IPv4/IPv6 als Text) oder unknown. NICHT der Wert aus X-Forwarded-For, ausser die Verbindung stammt aus AUTH_TRUSTED_PROXIES - der Kopf ist faelschbar.';
COMMENT ON COLUMN auth_rate_events.moment IS
    'Zeitpunkt des Aufrufs, gesetzt von der Anwendung (injizierbare Uhr). Gezaehlt wird count(*) WHERE moment > jetzt - Fenster.';

COMMIT;
