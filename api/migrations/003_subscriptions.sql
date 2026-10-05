-- =============================================================================
-- Ideenschmiede - Migration 003_subscriptions
-- =============================================================================
-- BTCPay-Webhook (Roadmap Phase 3.3). Legt EINE Tabelle an, sonst nichts:
--
--   subscription_intents - die Absicht, ein Abonnement zu kaufen. Sie kennt den
--                          NUTZER; der Webhook kennt nur die RECHNUNG. Ueber
--                          invoice_id werden beide verbunden.
--
-- Voraussetzung: 001_init.sql und 002_auth.sql sind eingespielt (diese Datei
-- baut auf users auf). Einzeln einspielbar:
--     psql -d ideenschmiede -v ON_ERROR_STOP=1 -f 003_subscriptions.sql
-- 001_init.sql und 002_auth.sql werden NICHT angefasst.
--
-- -----------------------------------------------------------------------------
-- Warum eine eigene Tabelle und nicht eine Spalte in subscriptions
-- -----------------------------------------------------------------------------
-- Zwischen "ich will zahlen" und "es ist bezahlt" liegt Zeit - und in dieser
-- Zeit gibt es noch KEIN Abonnement. subscriptions ist das Abo MIT Historie und
-- traegt das Stimmrecht (ADR-003); eine Zeile dort ohne Zahlung waere ein
-- Stimmrecht ohne Deckung, und subscriptions_period_check verlangt ausserdem
-- schon beim INSERT ein expires_at, das niemand kennt, solange nicht bezahlt ist.
-- Die Absicht ist deshalb ein eigener Zustand VOR dem Abonnement, mit eigener
-- Lebensdauer und eigenem Status.
--
-- Was ohne diese Tabelle fehlte: der Webhook von BTCPay kennt ausschliesslich
-- die Rechnung (invoice_id) und die Zahlung - keinen Nutzer. Ohne eine Zeile,
-- die Rechnung und Nutzer verbindet, koennte er die Gutschrift niemandem
-- zuordnen. Die Absicht ist dieser Bezug; sie ist keine Bequemlichkeit, sondern
-- die Voraussetzung dafuer, dass eine Zahlung ueberhaupt ein Konto erreicht.
--
-- -----------------------------------------------------------------------------
-- Die drei Schutzschichten der Idempotenz und was davon hier steht
-- -----------------------------------------------------------------------------
-- BTCPay wiederholt Zustellungen planmaessig (Timeout, nicht-2xx-Antwort,
-- Neustart). Die Wiederholung darf NICHTS doppelt buchen. Drei Schichten, jede
-- an einer anderen Stelle - und die erste ist NICHT diese Tabelle:
--
--   1. schema  subscriptions.subscriptions_payment_txid_key (Migration 001):
--              CREATE UNIQUE INDEX ... (lower(payment_txid)) WHERE payment_txid
--              IS NOT NULL. Dieselbe Bitcoin-Transaktion kann nur einmal als
--              Abonnement verbucht werden - auch wenn zwei Rechnungen dieselbe
--              Zahlung tragen oder die Absicht geloescht und neu angelegt wurde.
--              Das ist die Schicht, die auch dann noch haelt, wenn die
--              Anwendungslogik falsch ist.
--   2. schema  invoice_id UNIQUE (unten): eine Rechnung ist EINE Absicht. Eine
--              doppelte Zustellung findet dieselbe Zeile wieder, statt eine
--              zweite anzulegen - und der Webhook-Lookup ist ein Indexzugriff.
--   3. anwendung  status: nur der Uebergang 'open' -> 'settled' ist erlaubt, und
--              zwar bedingt (WHERE status = 'open'). Wer keine Zeile zurueck
--              bekommt, hat nicht gebucht - dieselbe Haltung wie
--              consumeChallenge() in src/authStore.ts. Die Datenbank entscheidet,
--              wer von zwei gleichzeitigen Zustellungen gewinnt.
--
-- Das Payload-Feld is_redelivery ist ausdruecklich NICHT Teil der Absicherung:
-- es ist ein Hinweis des Absenders und kann fehlen. Eine Zusage, die von einem
-- optionalen Feld abhaengt, ist keine Zusage.
--
-- -----------------------------------------------------------------------------
-- Kanonische Bezeichner (api/CONTRACT.md)
-- -----------------------------------------------------------------------------
--   * Zeitstempel sind timestamptz (absolut, nie lokal).
--   * Aufzaehlungen sind text mit CHECK, kein CREATE TYPE (ALTER TYPE ... ADD
--     VALUE ist in derselben Transaktion nicht benutzbar).
--   * Belegspalten tragen eine Eindeutigkeitsregel in der DATABASE, nicht nur
--     einen Format-CHECK. invoice_id ist genau so ein Beleg: die Kennung einer
--     fremden Rechnung, mit der eine Zahlung nachgewiesen wird.
--   * Jeder Fremdschluessel hat eine ON DELETE-Regel und Indexabdeckung.
-- =============================================================================

BEGIN;

-- gen_random_uuid() fuer die Vorgabewerte. 001_init.sql legt die Erweiterung
-- ebenfalls an; der Aufruf ist idempotent und auf PG >= 13 wirkungslos.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- 1. subscription_intents
-- =============================================================================
CREATE TABLE subscription_intents (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- ON DELETE CASCADE, anders als bei den Geldbelegen: eine Absicht ist ein
    -- VORGANG, kein Beleg. Wird ein Konto geloescht, ist eine offene Absicht
    -- gegenstandslos (niemand kann mehr gutgeschrieben bekommen). Ein
    -- RESTRICT hier wuerde das Loeschen eines Kontos an einem nie bezahlten
    -- Vorgang scheitern lassen. Die BELEGE - subscriptions mit payment_txid,
    -- die beiden Ledger - bleiben davon unberuehrt und stehen weiterhin auf
    -- RESTRICT: Geldgeschichten ueberleben das Konto.
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    -- Der Zustand der Absicht. Vier Werte, weil es vier Ausgaenge gibt:
    --   open      angelegt, auf Zahlung wartend
    --   settled   bezahlt und als Abonnement verbucht (Endzustand)
    --   expired   die Rechnung ist abgelaufen (InvoiceExpired)
    --   invalid   die Rechnung ist ungueltig geworden (InvoiceInvalid)
    status      text        NOT NULL DEFAULT 'open',

    -- Die Kennung der Rechnung BEI BTCPAY. Sie ist der einzige Faden zwischen
    -- dem Nutzer (der hier steht) und der Zahlung (die der Webhook kennt).
    --
    -- UNIQUE nach dem Vertrag ("Belegspalten eindeutig"): eine Rechnung gehoert
    -- zu genau einer Absicht. Damit ist die doppelte Zustellung derselben
    -- Rechnung schon im Schema eine Suche nach derselben Zeile und nicht der
    -- Anfang einer zweiten. Vergleich und Eindeutigkeit laufen ueber die SPALTE,
    -- nicht ueber lower(invoice_id): eine Rechnungskennung ist keine
    -- Transaktionskennung, sie wird von BTCPay vergeben und unveraendert
    -- zurueckgeliefert. Normalisiert wird hier nichts - eine Kennung, die nur
    -- in anderer Schreibweise dieselbe waere, ist eine andere Rechnung.
    invoice_id  text        NOT NULL,

    created_at  timestamptz NOT NULL DEFAULT now(),

    -- Wie lange die Absicht offen bleiben darf. Danach wird sie nicht mehr
    -- bedient - ein Nutzer, der drei Wochen spaeter eine alte Rechnung bezahlt,
    -- bekommt kein Abonnement aus einem Vorgang, den niemand mehr erwartet.
    expires_at  timestamptz NOT NULL,

    -- Zeitpunkt der Gutschrift. NULL = noch nicht bezahlt. Der einzige Schreiber
    -- ist der Webhook, und er setzt die Spalte im selben Vorgang wie status.
    settled_at  timestamptz,

    CONSTRAINT subscription_intents_status_check
        CHECK (status IN ('open', 'settled', 'expired', 'invalid')),

    -- Eine leere Kennung ist keine Kennung.
    CONSTRAINT subscription_intents_invoice_id_check
        CHECK (length(btrim(invoice_id)) BETWEEN 1 AND 200),

    -- Die Absicht muss eine Frist haben, die nach ihrer Entstehung liegt -
    -- dieselbe Regel wie auth_challenges_expiry_check.
    CONSTRAINT subscription_intents_expiry_check
        CHECK (expires_at > created_at),

    -- settled_at und der Status 'settled' gehoeren zusammen: ohne diese Regel
    -- gibt es frueher oder spaeter eine Gutschrift ohne Zeitpunkt oder einen
    -- Zeitpunkt ohne Gutschrift. Beides waere ein Widerspruch in einer Zeile.
    CONSTRAINT subscription_intents_settled_at_check
        CHECK ((status = 'settled') = (settled_at IS NOT NULL)),

    -- settled_at kann nicht vor der Entstehung liegen. Ein versehentlich in die
    -- Vergangenheit gesetzter Wert waere sonst nicht als Fehler sichtbar.
    CONSTRAINT subscription_intents_settled_after_created_check
        CHECK (settled_at IS NULL OR settled_at >= created_at)
);

-- Der Webhook sucht die Absicht ueber invoice_id. Als UNIQUE-Constraint ist der
-- Index schon da (er traegt zugleich die Eindeutigkeitsregel) - ein zweiter
-- Index auf dieselbe Spalte waere reine Schreiblast. Gesucht wird mit
-- invoice_id = $1 (kein lower(), siehe oben).
CREATE INDEX subscription_intents_user_id_created_at_idx
    ON subscription_intents (user_id, created_at DESC);

-- Fuer das Aufraeumen abgelaufener Absichten und die Diagnose "wie viele
-- Absichten sind offen". Kein Mittel der Idempotenz - das sind die drei
-- Schichten oben.
CREATE INDEX subscription_intents_status_expires_at_idx
    ON subscription_intents (status, expires_at);


-- =============================================================================
-- 2. Einheiten und Absichten dokumentieren
-- =============================================================================
COMMENT ON TABLE subscription_intents IS
    'Absicht, ein Abonnement zu kaufen: verbindet den NUTZER (hier) mit der BTCPay-RECHNUNG (invoice_id), die der Webhook kennt. VOR dem Abonnement - solange nicht bezahlt ist, existiert keine Zeile in subscriptions (ADR-003: das Abo ist das Stimmrecht, ein Stimmrecht ohne Zahlung waere ungedeckt).';
COMMENT ON COLUMN subscription_intents.status IS
    'open = wartet auf Zahlung; settled = bezahlt und als Abonnement verbucht; expired = Rechnung abgelaufen; invalid = Rechnung ungueltig. Nur der Uebergang open -> settled bucht ein Abonnement, und zwar bedingt (WHERE status = ''open'').';
COMMENT ON COLUMN subscription_intents.invoice_id IS
    'Kennung der Rechnung bei BTCPay. UNIQUE: eine Rechnung gehoert zu genau einer Absicht. Der Webhook sucht ueber invoice_id = $1; die Kennung wird nicht in der Schreibweise normalisiert - sie ist keine Transaktionskennung, sondern eine von BTCPay vergebene Rechnungsnummer.';
COMMENT ON COLUMN subscription_intents.expires_at IS
    'Frist der Absicht. Danach wird sie nicht mehr bedient: eine verspaetete Zahlung auf eine alte Rechnung begruendet kein neues Abonnement.';
COMMENT ON COLUMN subscription_intents.settled_at IS
    'Zeitpunkt der Gutschrift (aus dem Zeitstempel der Zustellung, nicht aus der Uhr des Empfaengers). NULL = noch nicht bezahlt. Gesetzt genau dann, wenn status = ''settled''.';

COMMIT;
