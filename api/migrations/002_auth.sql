-- =============================================================================
-- Ideenschmiede - Migration 002_auth
-- =============================================================================
-- LNURL-auth (Roadmap Phase 3.2). Legt zwei Tabellen an, sonst nichts:
--
--   auth_identities  - welcher secp256k1-Punkt (linkingKey) gehoert zu welchem
--                      Nutzer; die IDENTITAET.
--   auth_challenges  - die k1-Herausforderungen; EINMAL verwendbar.
--
-- Voraussetzung: 001_init.sql ist eingespielt (diese Datei baut auf users auf).
-- Einzeln einspielbar:
--     psql -d ideenschmiede -v ON_ERROR_STOP=1 -f 002_auth.sql
-- 001_init.sql wird NICHT angefasst.
--
-- -----------------------------------------------------------------------------
-- Warum eine EIGENE Tabelle und nicht user_wallets
-- -----------------------------------------------------------------------------
-- user_wallets traegt xpub - einen ERWEITERTEN oeffentlichen Schluessel fuer
-- ZAHLUNGEN an den Nutzer (ADR-006). Der linkingKey des LNURL-auth ist dagegen
-- ein einfacher secp256k1-Punkt (33 Byte, compressed) und dient der IDENTITAET.
-- Das sind zwei verschiedene Dinge mit zwei verschiedenen Lebensdauern:
--
--   * Ein xpub ist eine Zahlungsadresse-Fabrik; er wird ausgetauscht, wenn der
--     Nutzer eine andere Wallet zum Empfangen benutzt.
--   * Der linkingKey ist der Login. Er wird aus dem Domainnamen abgeleitet
--     ("if auth.site.com was initially chosen then changing it to
--     login.site.com will result in different account for each user because
--     full domain name is used by wallets as material for key derivation") und
--     ist damit an DIESE Instanz gebunden. Ihn zu wechseln hiesse, das Konto zu
--     wechseln.
--
-- Beides in eine Tabelle zu legen haette ausserdem einen linkingKey an
-- user_wallets_public_key_check scheitern lassen: der CHECK verlangt ein
-- xpub/ypub/zpub/tpub/upub/vpub-Praefix, ein linkingKey beginnt mit 02 oder 03.
-- Der CHECK ist richtig - er beschreibt Zahlungsschluessel. Deshalb eine eigene
-- Tabelle statt einer Aufweichung von 001.
--
-- -----------------------------------------------------------------------------
-- Warum die k1-Herausforderung in der Datenbank liegt und nicht im Speicher
-- -----------------------------------------------------------------------------
-- Die Spezifikation verlangt: "it is strongly advised to have a cache of unused
-- k1s, only proceed with verification of k1s present in that cache and REMOVE
-- USED k1s on successful auth attempts."
--
-- Ein Cache im Arbeitsspeicher erfuellt das nur, solange EIN Prozess laeuft:
-- bei zwei Instanzen hinter einem Lastverteiler sieht die zweite die k1 der
-- ersten nicht (Login schlaegt zufaellig fehl), und ein Neustart vergisst alle
-- offenen Herausforderungen. Schlimmer: ein Neustart vergisst auch die
-- VERBRAUCHTEN - eine bereits benutzte k1 waere danach wieder gueltig, der
-- Login also wiederholbar.
--
-- Die Tabelle macht daraus eine Eigenschaft des Schemas: auth_challenges_k1_key
-- laesst eine k1 nur einmal entstehen, und used_at wird beim erfolgreichen
-- Login gesetzt. Verbraucht heisst danach: used_at IS NOT NULL - ein Zustand,
-- den kein Neustart zuruecknimmt.
--
-- Kanonische Bezeichner (api/CONTRACT.md): snake_case, Zeitstempel timestamptz,
-- Aufzaehlungen als text mit CHECK, Belegspalten mit Eindeutigkeitsregel.
-- =============================================================================

BEGIN;

-- gen_random_uuid() fuer die Vorgabewerte der beiden id-Spalten. Der Aufruf ist
-- idempotent; 001_init.sql legt die Erweiterung ebenfalls an (PG >= 13 hat sie
-- eingebaut).
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- 1. auth_identities - der linkingKey ist die Identitaet
-- =============================================================================
CREATE TABLE auth_identities (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    -- Der linkingKey des LNURL-auth: ein secp256k1-Punkt, hex, 33 Byte
    -- compressed. Der CHECK haelt genau das fest - 66 Hexzeichen, erstes Byte
    -- 02 oder 03 (SEC1-compressed). Ein xpub kann hier nicht landen, und ein
    -- uncompressed Punkt (04 + 64 Byte) auch nicht: LNURL-auth verwendet
    -- compressed, und eine zweite Schreibweise desselben Schluessels waere ein
    -- zweites Konto.
    linking_key   text        NOT NULL,

    created_at    timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz,

    CONSTRAINT auth_identities_linking_key_hex_check
        CHECK (linking_key ~ '^0[23][0-9a-fA-F]{64}$')
);

-- Der Schluessel ist hex, also Text - und damit gilt die Vertragsregel fuer
-- Belegspalten: Eindeutigkeit ueber lower(spalte), NICHT ueber die blosse
-- Spalte. In der C-Kollation sind 'A' und 'a' verschiedene Zeichen; dieselbe
-- Identitaet einmal gross und einmal klein geschrieben kaeme sonst zweimal
-- durch und haette zwei Konten.
--
-- CREATE UNIQUE INDEX statt UNIQUE-Constraint, weil eine Tabellen-Constraint
-- keine Ausdruecke listen kann. Name und Fehlercode 23505 bleiben gleich.
--
-- Folge fuer Abfragen (CONTRACT.md, "Folge fuer Abfragen"): die Suche lautet
-- lower(linking_key) = lower($1) - nur so wird der Index als Suche benutzt und
-- nicht bloss als Filter. Die Anwendung normalisiert zusaetzlich beim Schreiben
-- auf Kleinschreibung; der Ausdrucksindex greift unabhaengig davon.
CREATE UNIQUE INDEX auth_identities_linking_key_lower_key
    ON auth_identities (lower(linking_key));

-- Jeder Fremdschluessel hat Indexabdeckung. Der Ausdrucksindex oben beginnt mit
-- lower(linking_key) und deckt eine FK-Pruefung auf user_id NICHT ab.
CREATE INDEX auth_identities_user_id_idx ON auth_identities (user_id);


-- =============================================================================
-- 2. auth_challenges - eine Herausforderung, einmal verwendbar
-- =============================================================================
CREATE TABLE auth_challenges (
    -- "a k1 query parameter consisting of randomly generated 32 bytes of data",
    -- als Hex geschrieben: 64 Zeichen. Erzeugt wird er in der Anwendung mit
    -- einem CSPRNG, nicht in SQL - die Datenbank prueft nur die Form und die
    -- Einmaligkeit.
    k1         text        NOT NULL PRIMARY KEY,

    -- "action-Enum: register | login | link | auth". Die Vorgabe ist 'login':
    -- wer nichts sagt, will sich anmelden - nicht stillschweigend ein Konto
    -- anlegen.
    action     text        NOT NULL DEFAULT 'login',

    created_at timestamptz NOT NULL DEFAULT now(),
    -- Abgelaufene Herausforderungen werden abgewiesen. Die Frist ist kurz (die
    -- Anwendung setzt sie); sie begrenzt das Zeitfenster, in dem eine
    -- abgefangene k1 noch brauchbar waere.
    expires_at timestamptz NOT NULL,
    -- NULL = noch nicht verbraucht. Der EINZIGE Schreiber dieser Spalte ist der
    -- Callback, und er setzt sie im selben Vorgang wie den Login.
    used_at    timestamptz,

    CONSTRAINT auth_challenges_k1_hex_check
        CHECK (k1 ~ '^[0-9a-fA-F]{64}$'),
    CONSTRAINT auth_challenges_action_check
        CHECK (action IN ('register', 'login', 'link', 'auth')),
    CONSTRAINT auth_challenges_expiry_check
        CHECK (expires_at > created_at),
    -- used_at kann nicht vor der Erzeugung liegen. Ein versehentlich in die
    -- Vergangenheit gesetzter Wert waere sonst nicht als Fehler sichtbar.
    CONSTRAINT auth_challenges_used_check
        CHECK (used_at IS NULL OR used_at >= created_at)
);

-- Die Einmaligkeit selbst ist der PRIMARY KEY auf k1: eine k1 kann nur einmal
-- entstehen. Verbraucht wird sie ueber used_at, und der Callback setzt das
-- bedingt (WHERE used_at IS NULL) - dadurch entscheidet die Datenbank, wer von
-- zwei gleichzeitigen Aufrufen gewinnt, nicht die Anwendung.
--
-- Dieser Index dient dem Aufraeumen alter Herausforderungen (Loeschen nach
-- expires_at) und der Diagnose; er ist NICHT das Mittel zur Einmaligkeit.
CREATE INDEX auth_challenges_expires_at_idx ON auth_challenges (expires_at);


-- =============================================================================
-- 3. Einheiten und Absichten dokumentieren
-- =============================================================================
COMMENT ON TABLE auth_identities IS
    'LNURL-auth-Identitaeten: ein secp256k1-linkingKey (33 Byte, compressed, hex) je Konto. NICHT user_wallets - dort steht ein xpub fuer ZAHLUNGEN (ADR-006), hier steht der LOGIN.';
COMMENT ON COLUMN auth_identities.linking_key IS
    'secp256k1-Punkt, hex, 33 Byte compressed (02/03-Praefix). Wird vom Wallet aus dem vollen Domainnamen abgeleitet - dieselbe Wallet ergibt auf einer anderen Domain einen anderen Schluessel und damit ein anderes Konto. Eindeutig ueber lower(linking_key): Abfragen lauten lower(linking_key) = lower($1).';
COMMENT ON COLUMN auth_identities.last_login_at IS
    'Zeitpunkt der letzten erfolgreichen Anmeldung mit diesem Schluessel. NULL = noch nie.';
COMMENT ON TABLE auth_challenges IS
    'Offene LNURL-auth-Herausforderungen (k1). EINMAL verwendbar: used_at wird beim erfolgreichen Login gesetzt, ab da wird die k1 abgewiesen - auch nach einem Neustart der API.';
COMMENT ON COLUMN auth_challenges.k1 IS
    '32 zufaellige Byte als Hex (64 Zeichen), vom CSPRNG der Anwendung erzeugt. Der PRIMARY KEY macht die Einmaligkeit der Herausforderung zu einer Eigenschaft des Schemas.';
COMMENT ON COLUMN auth_challenges.action IS
    'register | login | link | auth. register legt einen unbekannten Schluessel an, login weist ihn ab, auth verhaelt sich wie register (der uebliche LNURL-auth-Fall), link verlangt eine bestehende Sitzung.';
COMMENT ON COLUMN auth_challenges.used_at IS
    'NULL = unverbraucht. Gesetzt = verbraucht; die Herausforderung ist danach nicht mehr verwendbar (Replay-Schutz).';
COMMENT ON COLUMN auth_challenges.expires_at IS
    'Ablaufzeitpunkt der Herausforderung. Danach wird sie abgewiesen, auch wenn used_at NULL ist.';

COMMIT;
