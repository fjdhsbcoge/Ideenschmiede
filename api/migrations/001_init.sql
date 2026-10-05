-- =============================================================================
-- Ideenschmiede - Migration 001_init
-- =============================================================================
-- Bildet die vier Kernentitaeten aus ARCHITECTURE.md Anhang 5 ab:
--   users, ideas, teams, milestones
-- plus die Hilfstabellen, die aus den offenen Entscheidungen folgen:
--   subscriptions (Entscheidung 2), user_wallets (Entscheidung 1)
-- und die drei Belegtabellen, ohne die die Zaehler wertlos waeren:
--   idea_votes (Entscheidung 4), idea_investments (Ledger der Idea-Shares),
--   team_investments (Ledger der Team-Shares)
--
-- Verbindliche Leitplanken (api/CONTRACT.md ist der kanonische Datenvertrag):
--   * ADR-006 (non-custodial): jeder Geldbetrag ist Satoshi und damit eine
--     GANZE ZAHL. Jede Geldspalte ist BIGINT und endet auf _sat; in dieser
--     Datei kommt kein einziger Gleitkomma- oder Festkommatyp vor.
--   * Anteile sind Basispunkte (smallint/integer, 10000 = 100 Prozent),
--     niemals ein Bruch. Investorenanteile werden NICHT gespeichert, sondern
--     in den Views idea_investor_shares und team_investor_shares ganzzahlig
--     berechnet - je Anspruch eine View, weil Idea- und Team-Shares getrennte
--     Beteiligungen sind (CONTRACT.md, "Warum zwei Ledger, nicht eines").
--   * ADR-003: das Abonnement ist das Stimmrecht. Deshalb ist es eine eigene
--     Tabelle mit Historie (nicht eine Spalte), und deshalb setzt die
--     Datenbank selbst durch, dass nur Abonnenten stimmen koennen.
--   * Jeder Zaehler hat eine Quelltabelle und genau einen Schreiber (Trigger):
--       vote_up / vote_down         <- idea_votes
--       raised_sat / investor_count <- idea_investments  (in ideas)
--       raised_sat / investor_count <- team_investments  (in teams)
--       comment_count               <- idea_comments (Migration 002)
--     Ein Zaehler ohne Quelltabelle waere Datenverlust: der Wert ist spaeter
--     nicht rekonstruierbar.
--   * Alle Zeitstempel sind TIMESTAMPTZ (immer absolut, nie lokal).
--   * Jeder Fremdschluessel hat eine ON DELETE-Regel und Indexabdeckung.
--
-- Kanonische Bezeichner (ersetzt die frueheren Arbeitsnamen):
--   vote_up (nicht votes_up), vote_down (nicht votes_down),
--   comment_count (nicht comments), investor_count (nicht investors),
--   raised_sat (nicht raised), funding_goal_sat (nicht funding_goal),
--   skin_in_game_sat (nicht skin_in_game),
--   funding_release_sat (nicht funding_release),
--   payment_txid (nicht payment_tx_hash).
--
-- Konvention: SQL-Bezeichner in snake_case. Die API-Schicht mappt sie auf die
-- camelCase-Felder aus ARCHITECTURE.md Anhang 5 (siehe README.md).
--
-- Ausfuehren:  psql -d ideenschmiede -f 001_init.sql
-- =============================================================================

BEGIN;

-- gen_random_uuid() ist ab PostgreSQL 13 eingebaut; pgcrypto deckt aeltere
-- Versionen ab. Die Erweiterung ist idempotent und schadet auf PG >= 13 nicht.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- 1. users
-- =============================================================================
CREATE TABLE users (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    username      text        NOT NULL,
    display_name  text        NOT NULL,
    email         text        NOT NULL,
    avatar_url    text,
    language      text        NOT NULL DEFAULT 'de',
    role          text        NOT NULL DEFAULT 'visitor',
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    -- Entscheidung 5: text + CHECK statt ENUM-Typ.
    CONSTRAINT users_role_check
        CHECK (role IN ('visitor', 'user', 'subscriber')),
    CONSTRAINT users_language_check
        CHECK (language IN ('de', 'en')),

    -- @handle: kleingeschrieben, damit die Eindeutigkeit nicht von der
    -- Schreibweise abhaengt (siehe users_username_lower_key).
    CONSTRAINT users_username_format_check
        CHECK (username ~ '^[a-z0-9_]{3,30}$'),
    CONSTRAINT users_display_name_check
        CHECK (length(btrim(display_name)) BETWEEN 1 AND 80),
    CONSTRAINT users_email_format_check
        CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')
);

-- Eindeutigkeit ohne Beachtung der Gross-/Kleinschreibung: "Anna" und "anna"
-- sind fuer Menschen dieselbe Person, fuer UNIQUE aber zwei verschiedene Werte.
CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));
CREATE UNIQUE INDEX users_email_lower_key    ON users (lower(email));


-- =============================================================================
-- 2. subscriptions  (Entscheidung 2: eigene Tabelle MIT Historie)
-- =============================================================================
CREATE TABLE subscriptions (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    type               text        NOT NULL DEFAULT 'annual',
    active             boolean     NOT NULL DEFAULT true,
    started_at         timestamptz NOT NULL DEFAULT now(),
    expires_at         timestamptz NOT NULL,

    -- Belegkette fuer ADR-006: die Plattform haelt kein Geld, sie kennt nur die
    -- Transaktion, mit der jemand sein Stimmrecht bezahlt hat.
    -- Kanonisch ist payment_txid - nicht payment_tx_hash (CONTRACT.md).
    payment_txid       text,
    -- payment_amount traegt bewusst keinen _sat-Suffix: der Vertrag fuehrt
    -- diesen Beleg in seiner Ausnahmeliste. Die Einheit steht unten in
    -- COMMENT ON COLUMN, damit sie beim Schreiben einer Abfrage nicht geraten
    -- werden muss.
    payment_amount     bigint,

    created_at         timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT subscriptions_type_check
        CHECK (type IN ('annual')),
    CONSTRAINT subscriptions_period_check
        CHECK (expires_at > started_at),
    CONSTRAINT subscriptions_payment_amount_check
        CHECK (payment_amount IS NULL OR payment_amount > 0),
    -- Eine Transaktionskennung ist 64 Hexzeichen. Entweder liegt ein Beleg
    -- vor oder gar keiner - ein halber Beleg waere nicht nachpruefbar.
    CONSTRAINT subscriptions_payment_txid_check
        CHECK (payment_txid IS NULL OR payment_txid ~ '^[0-9a-fA-F]{64}$')
);

-- ADR-003: ein Stimmrecht, nicht zwei. Ein Nutzer kann hoechstens EIN aktives
-- Abonnement haben - abgelaufene und gekuendigte Reihen bleiben als Historie
-- erhalten und sind von dieser Regel nicht betroffen.
CREATE UNIQUE INDEX subscriptions_one_active_per_user
    ON subscriptions (user_id) WHERE active;

CREATE INDEX subscriptions_user_id_idx    ON subscriptions (user_id);
CREATE INDEX subscriptions_expires_at_idx ON subscriptions (expires_at);


-- =============================================================================
-- 3. user_wallets  (Entscheidung 1: eigene Tabelle statt JSONB)
-- =============================================================================
CREATE TABLE user_wallets (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    label           text,
    type            text        NOT NULL,

    -- ADR-006: hier steht ausschliesslich ein OEFFENTLICHER Schluessel.
    -- Ein xprv/private Key darf die Plattform nie erreichen.
    xpub            text        NOT NULL,
    derivation_path text,
    is_primary      boolean     NOT NULL DEFAULT false,
    verified_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT user_wallets_type_check
        CHECK (type IN ('native_segwit', 'taproot')),
    -- Erzwingt, dass wirklich ein Extended PUBLIC Key gespeichert wird:
    -- xpub/ypub/zpub (Mainnet) und tpub/upub/vpub (Testnet/Signet).
    CONSTRAINT user_wallets_public_key_check
        CHECK (xpub ~ '^(xpub|ypub|zpub|tpub|upub|vpub)[1-9A-HJ-NP-Za-km-z]{50,120}$'),
    -- CONTRACT.md: "Private Schluessel (WIF-, xprv-Praefixe) werden per CHECK
    -- abgewiesen - ADR-006 wird damit in der Datenbank durchgesetzt."
    -- Die Whitelist oben leistet das bereits; diese Regel benennt die
    -- verbotenen Praefixe ausdruecklich, damit die Absicht pruefbar bleibt.
    CONSTRAINT user_wallets_no_private_key_check
        CHECK (xpub !~* '^(xprv|yprv|zprv|tprv|uprv|vprv)')
);

CREATE UNIQUE INDEX user_wallets_user_xpub_key ON user_wallets (user_id, xpub);

-- Genau eine Haupt-Wallet pro Nutzer.
CREATE UNIQUE INDEX user_wallets_one_primary_per_user
    ON user_wallets (user_id) WHERE is_primary;

CREATE INDEX user_wallets_user_id_idx ON user_wallets (user_id);


-- =============================================================================
-- 4. ideas
-- =============================================================================
-- discussion und marketplace sind 1:1-Werteobjekte des Ideas (ARCHITECTURE
-- Anhang 5.2). Sie liegen deshalb als Spalten hier und nicht in eigenen
-- Tabellen; die Namen sind praefixiert, weil "opened_at" sonst zweimal
-- existieren wuerde. Die dokumentierten Namen liefern die Views am Dateiende.
CREATE TABLE ideas (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id             uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    title                 text        NOT NULL,
    description           text        NOT NULL DEFAULT '',
    tags                  text[]      NOT NULL DEFAULT '{}',
    language              text        NOT NULL DEFAULT 'de',
    stage                 text        NOT NULL DEFAULT 'discussion',

    -- discussion-Phase (nicht optional: entsteht mit dem Idea)
    discussion_opened_at  timestamptz NOT NULL DEFAULT now(),
    comment_count         integer     NOT NULL DEFAULT 0,
    vote_up               integer     NOT NULL DEFAULT 0,
    vote_down             integer     NOT NULL DEFAULT 0,

    -- marketplace-Phase (optional: erst ab stage 'marketplace' gefuellt)
    marketplace_opened_at timestamptz,
    marketplace_closes_at timestamptz,
    funding_goal_sat      bigint,
    raised_sat            bigint      NOT NULL DEFAULT 0,
    investor_count        integer     NOT NULL DEFAULT 0,

    -- 20/80-Aufteilung als Basispunkte (Vertrag: 10000 = 100 Prozent, nie ein
    -- Bruch). 2000 bp sind die 20 Prozent der Idee-Seite, die restlichen
    -- 8000 bp die Team-Seite. Der Wert ist eine Policy, kein Geldbetrag -
    -- deshalb kein _sat-Suffix und smallint statt bigint.
    creator_share_bp      smallint    NOT NULL DEFAULT 2000,

    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),

    -- Entscheidung 5: text + CHECK statt ENUM-Typ.
    CONSTRAINT ideas_stage_check
        CHECK (stage IN ('discussion', 'voting', 'marketplace', 'active', 'completed')),
    CONSTRAINT ideas_language_check
        CHECK (language IN ('de', 'en')),
    CONSTRAINT ideas_title_check
        CHECK (length(btrim(title)) BETWEEN 3 AND 200),

    -- Ein leeres Tag ist kein Tag, und eine Idee ist kein Schlagwort-Speicher.
    CONSTRAINT ideas_tags_check
        CHECK (array_position(tags, ''::text) IS NULL
               AND coalesce(array_length(tags, 1), 0) <= 10),

    -- Zaehler koennen nicht negativ werden - auch nicht durch einen Bug im
    -- Anwendungscode, der sie direkt schreibt.
    CONSTRAINT ideas_comment_count_check  CHECK (comment_count  >= 0),
    CONSTRAINT ideas_vote_up_check        CHECK (vote_up        >= 0),
    CONSTRAINT ideas_vote_down_check      CHECK (vote_down      >= 0),
    CONSTRAINT ideas_raised_sat_check     CHECK (raised_sat     >= 0),
    CONSTRAINT ideas_investor_count_check CHECK (investor_count >= 0),
    CONSTRAINT ideas_funding_goal_sat_check
        CHECK (funding_goal_sat IS NULL OR funding_goal_sat > 0),

    -- 10000 bp = 100 Prozent. Mehr waere keine Aufteilung mehr.
    CONSTRAINT ideas_creator_share_bp_check
        CHECK (creator_share_bp BETWEEN 0 AND 10000),

    CONSTRAINT ideas_marketplace_window_check
        CHECK (marketplace_closes_at IS NULL
               OR marketplace_opened_at IS NULL
               OR marketplace_closes_at > marketplace_opened_at),

    -- Die marketplace-Phase ist entweder ganz offen oder ganz zu. Ein Idea mit
    -- closes_at, aber ohne funding_goal_sat waere ein halb eroeffneter
    -- Marktplatz.
    CONSTRAINT ideas_marketplace_all_or_nothing_check
        CHECK ((marketplace_opened_at IS NULL
                AND marketplace_closes_at IS NULL
                AND funding_goal_sat IS NULL)
            OR (marketplace_opened_at IS NOT NULL
                AND marketplace_closes_at IS NOT NULL
                AND funding_goal_sat IS NOT NULL))
);

CREATE INDEX ideas_author_id_idx ON ideas (author_id);

-- Entscheidung 3: text[] mit GIN-Index.
CREATE INDEX ideas_tags_gin_idx ON ideas USING GIN (tags);

CREATE INDEX ideas_stage_created_at_idx ON ideas (stage, created_at DESC);

-- Fuer den Job, der ablaufende Marktphasen schliesst.
CREATE INDEX ideas_marketplace_closes_at_idx
    ON ideas (marketplace_closes_at) WHERE marketplace_closes_at IS NOT NULL;


-- =============================================================================
-- 5. idea_votes  (Entscheidung 4: Einzelstimmen als Wahrheit)
-- =============================================================================
CREATE TABLE idea_votes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id         uuid        NOT NULL REFERENCES ideas (id) ON DELETE CASCADE,
    user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    direction       text        NOT NULL,

    -- ADR-003 + Entscheidung 2: welches Abonnement dieses Stimmrecht verliehen
    -- hat. Weil subscriptions Historie behaelt, ist die Wahl auch dann noch
    -- nachpruefbar, wenn das Abonnement laengst abgelaufen ist.
    subscription_id uuid        REFERENCES subscriptions (id) ON DELETE SET NULL,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT idea_votes_direction_check
        CHECK (direction IN ('up', 'down')),

    -- Eine Stimme pro Nutzer und Idea. Das macht Doppelstimmen unmoeglich und
    -- nicht nur unwahrscheinlich.
    CONSTRAINT idea_votes_one_per_user_key UNIQUE (idea_id, user_id)
);

-- FK-Abdeckung: idea_id ist schon durch die UNIQUE-Constraint oben indiziert
-- (deren Btree-Index beginnt mit idea_id) - ein zweiter Index darauf waere
-- reine Schreiblast ohne Nutzen. Fuer user_id, subscription_id und die
-- Zeitsortierung braucht es eigene Indizes.
CREATE INDEX idea_votes_user_id_idx         ON idea_votes (user_id);
CREATE INDEX idea_votes_subscription_id_idx ON idea_votes (subscription_id);
CREATE INDEX idea_votes_created_at_idx      ON idea_votes (created_at DESC);


-- =============================================================================
-- 6. idea_investments  (Ledger der Direktzahlungen - Pflichtentitaet)
-- =============================================================================
-- CONTRACT.md nennt dieses Ledger unverzichtbar: "ohne dieses Ledger ist die
-- 20/80-Aufteilung nicht berechenbar. Ein Zaehler raised_sat ohne Quelle ist
-- wertlos." Deshalb steht jede Direktzahlung als eigene Zeile hier, und
-- ideas.raised_sat / ideas.investor_count sind nur noch die gepflegte
-- Abkuerzung davon - nicht die einzige Spur des Geldes.
CREATE TABLE idea_investments (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id     uuid        NOT NULL REFERENCES ideas (id) ON DELETE RESTRICT,
    investor_id uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    amount_sat  bigint      NOT NULL,
    txid        text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),

    -- Ein Geldeingang ist eine ganze Zahl Satoshi und positiv. 0 waere kein
    -- Geldeingang, negativ eine Auszahlung - und die gehoert nicht in dieses
    -- Ledger (ADR-006: die Plattform rechnet mit Betraegen, sie haelt sie
    -- nicht).
    CONSTRAINT idea_investments_amount_sat_check
        CHECK (amount_sat > 0),

    -- Eine Transaktionskennung ist 64 Hexzeichen. Die UNIQUE-Regel darunter ist
    -- die eigentliche Zusage: dieselbe Bitcoin-Transaktion kann nicht zweimal
    -- als Investition zaehlen, auch nicht bei einem Retry der API.
    CONSTRAINT idea_investments_txid_check
        CHECK (txid ~ '^[0-9a-fA-F]{64}$'),
    CONSTRAINT idea_investments_txid_key
        UNIQUE (txid)
);

-- ON DELETE RESTRICT ist hier bewusst gewaehlt, nicht gesetzt:
--   * idea_investments.idea_id -> ideas  RESTRICT: Geldbelege werden nicht
--     mitgeloescht. Eine finanzierte Idee ist nicht loeschbar, solange
--     Zahlungen auf sie zeigen - sonst verschwindet die Spur des Geldes.
--   * idea_investments.investor_id -> users RESTRICT: das Loeschen eines
--     Kontos darf keine Zahlungsgeschichte mitnehmen (wie ideas.author_id).
-- FK-Abdeckung: jede Fremdschluesselspalte ist erste Spalte eines Index.
-- Der Btree aus UNIQUE (txid) bedient die Belegsuche, keine FK-Pruefung.
--
-- idea_id braucht KEINEN eigenen Einzelindex: der Index unten beginnt mit
-- idea_id und bedient damit die FK-Pruefung vollstaendig (CONTRACT.md,
-- Abschnitt Indizes, Leading-Column-Regel). Gleiche Begruendung wie bei
-- team_investments. Der Index wird ausserdem vom Trigger
-- idea_investments_sync_counters genutzt, der je Idee aggregiert.
CREATE INDEX idea_investments_investor_id_idx ON idea_investments (investor_id);

-- Genau die Abfrage, aus der raised_sat, investor_count und die 20/80-
-- Aufteilung entstehen: alle Investitionen einer Idee in zeitlicher Folge.
CREATE INDEX idea_investments_idea_created_at_idx
    ON idea_investments (idea_id, created_at DESC);


-- =============================================================================
-- 7. teams
-- =============================================================================
CREATE TABLE teams (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id         uuid        NOT NULL REFERENCES ideas (id) ON DELETE CASCADE,
    leader_id       uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    name            text        NOT NULL,
    description     text        NOT NULL DEFAULT '',
    focus_area      text        NOT NULL DEFAULT '',

    -- proposal.timeline (Monate)
    timeline_months integer,

    funding_goal_sat bigint     NOT NULL DEFAULT 0,
    raised_sat       bigint     NOT NULL DEFAULT 0,
    investor_count   integer    NOT NULL DEFAULT 0,
    skin_in_game_sat bigint     NOT NULL DEFAULT 0,
    status           text       NOT NULL DEFAULT 'applying',

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT teams_status_check
        CHECK (status IN ('applying', 'funding', 'funded', 'building', 'completed')),
    CONSTRAINT teams_name_check
        CHECK (length(btrim(name)) BETWEEN 1 AND 120),
    CONSTRAINT teams_timeline_months_check
        CHECK (timeline_months IS NULL OR timeline_months > 0),
    CONSTRAINT teams_funding_goal_sat_check CHECK (funding_goal_sat >= 0),
    CONSTRAINT teams_raised_sat_check       CHECK (raised_sat       >= 0),
    CONSTRAINT teams_investor_count_check   CHECK (investor_count   >= 0),
    CONSTRAINT teams_skin_in_game_sat_check CHECK (skin_in_game_sat >= 0)
);

-- EHEMALS OFFENER PUNKT, jetzt geschlossen: fuer teams.raised_sat und
-- teams.investor_count gibt es seit dieser Migration eine Quelltabelle -
-- team_investments (Abschnitt 8). CONTRACT.md fuehrt sie unter den
-- Pflichtentitaeten ("Ledger der Team-Shares ... ohne eigenes Ledger ist die
-- Team-Seite der 80 Prozent nicht berechenbar"). Die Team-Seite der 20/80-
-- Aufteilung ist damit genauso beweisbar wie die Idea-Seite.
-- Geschrieben werden beide Spalten ausschliesslich von
-- team_investments_sync_counters (Abschnitt 10) und dort vollstaendig neu
-- gezaehlt - kein Anwendungspfad schreibt sie direkt.
--
-- Reihenfolge im Schema: teams steht VOR team_investments, weil das Ledger
-- einen Fremdschluessel auf teams traegt; das Ledger steht vor milestones,
-- damit die Abschnittsnummern der Abhaengigkeitsrichtung folgen.

CREATE INDEX teams_idea_id_idx   ON teams (idea_id);
CREATE INDEX teams_leader_id_idx ON teams (leader_id);
CREATE INDEX teams_status_idx    ON teams (status);


-- =============================================================================
-- 8. team_investments  (Ledger der Team-Shares - Pflichtentitaet)
-- =============================================================================
-- CONTRACT.md, Abschnitt "Warum zwei Ledger, nicht eines": Idea-Shares und
-- Team-Shares sind GETRENNT VERKAEUFLICHE BETEILIGUNGEN.
--   * Idea-Shares: Series-A-Runde der Idee, kaufbar waehrend der
--     Marktplatzphase, Ertrag aus ALLEN Teams der Idee (20 Prozent).
--   * Team-Shares: Beteiligung an EINEM Team, kaufbar jederzeit - auch
--     spaeter -, Ertrag aus genau diesem Team (80 Prozent).
-- Ein gemeinsames Ledger koennte diese beiden Ansprueche nicht trennen, und
-- keine Auszahlung waere mehr begruendbar. Deshalb steht jede Zahlung auf ein
-- Team als eigene Zeile hier; teams.raised_sat und teams.investor_count sind
-- nur die gepflegte Abkuerzung davon, nicht die einzige Spur des Geldes.
--
-- Aufbau bewusst deckungsgleich mit idea_investments: gleiche Spaltennamen,
-- gleiche Typen, gleiche Regeln - nur die Bezugstabelle ist das Team statt der
-- Idee. Zwei Ledger mit unterschiedlich benannten Feldern waeren genau die
-- Divergenz, die CONTRACT.md ausschliessen will.
CREATE TABLE team_investments (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     uuid        NOT NULL REFERENCES teams (id) ON DELETE RESTRICT,
    investor_id uuid        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    amount_sat  bigint      NOT NULL,
    txid        text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),

    -- Wie beim Idea-Ledger: ein Geldeingang ist eine ganze Zahl Satoshi und
    -- positiv. 0 waere kein Geldeingang, negativ eine Auszahlung - und die
    -- gehoert nicht in dieses Ledger (ADR-006: die Plattform rechnet mit
    -- Betraegen, sie haelt sie nicht).
    CONSTRAINT team_investments_amount_sat_check
        CHECK (amount_sat > 0),

    -- Eine Transaktionskennung ist 64 Hexzeichen. Die UNIQUE-Regel darunter
    -- ist die eigentliche Zusage: dieselbe Bitcoin-Transaktion kann nicht
    -- zweimal als Team-Investition zaehlen, auch nicht bei einem Retry der
    -- API. Sie gilt ueber das ganze Ledger - ein Beleg ist ein Beleg.
    CONSTRAINT team_investments_txid_check
        CHECK (txid ~ '^[0-9a-fA-F]{64}$'),
    CONSTRAINT team_investments_txid_key
        UNIQUE (txid)
);

-- ON DELETE RESTRICT ist hier gewaehlt, nicht gesetzt - dieselbe Begruendung
-- wie bei idea_investments, nur eine Ebene tiefer:
--   * team_investments.team_id -> teams RESTRICT: Geldbelege werden nicht
--     mitgeloescht. teams.idea_id -> ideas ist CASCADE (ein Team ohne Idee
--     hat keinen Auftrag); ohne das RESTRICT hier haette das Loeschen einer
--     Idee die Team-Shares-Belege mitgerissen und die Spur des Geldes waere
--     weg. RESTRICT auf dem Ledger schlaegt CASCADE auf der Elternzeile:
--     ein Team mit Belegen ist nicht loeschbar.
--   * team_investments.investor_id -> users RESTRICT: das Loeschen eines
--     Kontos darf keine Zahlungsgeschichte mitnehmen (wie ideas.author_id).
-- FK-Abdeckung: jede Fremdschluesselspalte ist erste Spalte eines Index.
-- Der Btree aus UNIQUE (txid) bedient die Belegsuche, keine FK-Pruefung.
--
-- team_id braucht KEINEN eigenen Einzelindex: der Index unten beginnt mit
-- team_id und bedient damit die FK-Pruefung vollstaendig (CONTRACT.md,
-- Abschnitt Indizes, Leading-Column-Regel). Am Planer geprueft - ein
-- EXPLAIN auf team_id = <uuid> waehlt team_investments_team_created_at_idx.
CREATE INDEX team_investments_investor_id_idx ON team_investments (investor_id);

-- Genau die Abfrage, aus der raised_sat, investor_count und die Team-Seite der
-- 20/80-Aufteilung entstehen: alle Belege eines Teams in zeitlicher Folge.
-- Deckt zugleich die Fremdschluesselpruefung auf team_id ab.
CREATE INDEX team_investments_team_created_at_idx
    ON team_investments (team_id, created_at DESC);


-- =============================================================================
-- 9. milestones
-- =============================================================================
CREATE TABLE milestones (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id             uuid        NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    title               text        NOT NULL,
    description         text        NOT NULL DEFAULT '',
    deliverables        text[]      NOT NULL DEFAULT '{}',
    funding_release_sat bigint      NOT NULL DEFAULT 0,
    status              text        NOT NULL DEFAULT 'pending',
    position            integer     NOT NULL DEFAULT 0,
    due_date            timestamptz,
    completed_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT milestones_status_check
        CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    CONSTRAINT milestones_title_check
        CHECK (length(btrim(title)) BETWEEN 1 AND 200),
    CONSTRAINT milestones_funding_release_sat_check
        CHECK (funding_release_sat >= 0),

    -- 'completed' und completed_at gehoeren zusammen. Ohne diese Regel gibt es
    -- frueher oder spaeter einen fertigen Meilenstein ohne Datum.
    CONSTRAINT milestones_completed_at_check
        CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

CREATE INDEX milestones_team_id_idx       ON milestones (team_id);
CREATE INDEX milestones_team_position_idx ON milestones (team_id, position);


-- =============================================================================
-- 10. Trigger-Funktionen
-- =============================================================================

-- Ein Schreiber fuer updated_at, statt die Spalte in jeder Query zu setzen.
CREATE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER ideas_set_updated_at
    BEFORE UPDATE ON ideas
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER teams_set_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER idea_votes_set_updated_at
    BEFORE UPDATE ON idea_votes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ADR-003 in der Datenbank: stimmen darf nur, wer ein aktives Abonnement hat.
-- Die BEFORE-Trigger-Funktion prueft das UND stempelt das verleihende
-- Abonnement in die Stimme. Kein API-Bug kann das umgehen.
-- Sie greift bei INSERT und bei UPDATE: eine umgedrehte Stimme ist eine neue
-- Stimmabgabe und braucht dasselbe Stimmrecht. Das Zurueckziehen (DELETE)
-- bleibt jederzeit moeglich - dafuer braucht es kein Abonnement.
CREATE FUNCTION idea_votes_assign_subscription() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_subscription_id uuid;
BEGIN
    SELECT s.id INTO v_subscription_id
      FROM subscriptions s
     WHERE s.user_id = NEW.user_id
       AND s.active
       AND s.expires_at > now()
     ORDER BY s.expires_at DESC
     LIMIT 1;

    IF v_subscription_id IS NULL THEN
        RAISE EXCEPTION
            'ADR-003: Stimmrecht erfordert ein aktives Abonnement (user_id=%)',
            NEW.user_id
            USING ERRCODE = 'check_violation';
    END IF;

    NEW.subscription_id := v_subscription_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER idea_votes_require_subscription
    BEFORE INSERT OR UPDATE ON idea_votes
    FOR EACH ROW EXECUTE FUNCTION idea_votes_assign_subscription();


-- Der einzige Schreiber der Zaehler vote_up/vote_down. Damit koennen die
-- Zaehler nicht von den Einzelstimmen abweichen - und die Einzelstimmen
-- bleiben trotzdem die Wahrheit (Entscheidung 4).
-- CONTRACT.md verlangt, dass "per Trigger vollstaendig neu gezaehlt" wird.
-- Die Neuberechnung ist idempotent und kann nicht driften; die frueher
-- inkrementelle Variante haette bei einer per UPDATE geaenderten idea_id die
-- verlassene Idee mit einem zu hohen Zaehler zurueckgelassen.
CREATE FUNCTION idea_votes_sync_counters() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_idea_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_idea_id := OLD.idea_id;
    ELSE
        v_idea_id := NEW.idea_id;
    END IF;

    UPDATE ideas i SET
        vote_up   = (SELECT count(*) FROM idea_votes v
                      WHERE v.idea_id = v_idea_id AND v.direction = 'up')::integer,
        vote_down = (SELECT count(*) FROM idea_votes v
                      WHERE v.idea_id = v_idea_id AND v.direction = 'down')::integer
     WHERE i.id = v_idea_id;

    -- Wandert eine Stimme per UPDATE zu einer anderen Idee, muss auch die
    -- verlassene Idee neu gezaehlt werden - sonst bliebe dort eine Geisterstimme.
    IF TG_OP = 'UPDATE' AND OLD.idea_id IS DISTINCT FROM NEW.idea_id THEN
        UPDATE ideas i SET
            vote_up   = (SELECT count(*) FROM idea_votes v
                          WHERE v.idea_id = OLD.idea_id AND v.direction = 'up')::integer,
            vote_down = (SELECT count(*) FROM idea_votes v
                          WHERE v.idea_id = OLD.idea_id AND v.direction = 'down')::integer
         WHERE i.id = OLD.idea_id;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER idea_votes_sync_counters_trg
    AFTER INSERT OR UPDATE OR DELETE ON idea_votes
    FOR EACH ROW EXECUTE FUNCTION idea_votes_sync_counters();


-- Der einzige Schreiber von ideas.raised_sat und ideas.investor_count.
-- Vollstaendige Neuberechnung aus dem Ledger - dieselbe Begruendung wie bei
-- den Stimmen: der Zaehler ist eine Abkuerzung, keine zweite Wahrheit. Der
-- Nachweis "Zaehler = Ledger" muss jederzeit 0 Abweichungen liefern.
-- investor_count zaehlt INVESTOREN, nicht Zahlungen: wer zweimal einzahlt,
-- ist ein Investor mit zwei Belegen.
CREATE FUNCTION idea_investments_sync_counters() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_idea_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_idea_id := OLD.idea_id;
    ELSE
        v_idea_id := NEW.idea_id;
    END IF;

    -- sum(bigint) liefert numeric; der ausdrueckliche Cast haelt die Spalte
    -- BIGINT (Vertrag: Geld ist bigint, niemals numeric/float).
    UPDATE ideas i SET
        raised_sat     = COALESCE((SELECT sum(x.amount_sat) FROM idea_investments x
                                    WHERE x.idea_id = v_idea_id), 0)::bigint,
        investor_count = (SELECT count(DISTINCT x.investor_id) FROM idea_investments x
                           WHERE x.idea_id = v_idea_id)::integer
     WHERE i.id = v_idea_id;

    -- Wandert eine Buchung per UPDATE zu einer anderen Idee, muss auch die
    -- verlassene Idee neu berechnet werden.
    IF TG_OP = 'UPDATE' AND OLD.idea_id IS DISTINCT FROM NEW.idea_id THEN
        UPDATE ideas i SET
            raised_sat     = COALESCE((SELECT sum(x.amount_sat) FROM idea_investments x
                                        WHERE x.idea_id = OLD.idea_id), 0)::bigint,
            investor_count = (SELECT count(DISTINCT x.investor_id) FROM idea_investments x
                               WHERE x.idea_id = OLD.idea_id)::integer
         WHERE i.id = OLD.idea_id;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER idea_investments_sync_counters_trg
    AFTER INSERT OR UPDATE OR DELETE ON idea_investments
    FOR EACH ROW EXECUTE FUNCTION idea_investments_sync_counters();


-- Der einzige Schreiber von teams.raised_sat und teams.investor_count -
-- dasselbe Muster wie idea_investments_sync_counters, eine Ebene tiefer.
-- Vollstaendige Neuberechnung aus dem Ledger, NICHT inkrementell: nur so
-- laesst ein per UPDATE auf ein anderes Team verschobener Beleg keinen
-- Geisterzaehler beim verlassenen Team zurueck. Der Zaehler ist eine
-- Abkuerzung, keine zweite Wahrheit; der Nachweis "Zaehler = Ledger" muss
-- jederzeit 0 Abweichungen liefern.
-- investor_count zaehlt INVESTOREN, nicht Zahlungen: wer zweimal auf dasselbe
-- Team einzahlt, ist ein Investor mit zwei Belegen.
CREATE FUNCTION team_investments_sync_counters() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_team_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_team_id := OLD.team_id;
    ELSE
        v_team_id := NEW.team_id;
    END IF;

    -- sum(bigint) liefert numeric; der ausdrueckliche Cast haelt die Spalte
    -- BIGINT (Vertrag: Geld ist bigint, niemals numeric/float).
    UPDATE teams t SET
        raised_sat     = COALESCE((SELECT sum(x.amount_sat) FROM team_investments x
                                    WHERE x.team_id = v_team_id), 0)::bigint,
        investor_count = (SELECT count(DISTINCT x.investor_id) FROM team_investments x
                           WHERE x.team_id = v_team_id)::integer
     WHERE t.id = v_team_id;

    -- Wechselt eine Buchung per UPDATE das Team, muss auch das verlassene Team
    -- vollstaendig neu gezaehlt werden - sonst bliebe dort ein Geisterzaehler
    -- stehen (genau der Fall, der die inkrementelle Variante widerlegt).
    IF TG_OP = 'UPDATE' AND OLD.team_id IS DISTINCT FROM NEW.team_id THEN
        UPDATE teams t SET
            raised_sat     = COALESCE((SELECT sum(x.amount_sat) FROM team_investments x
                                        WHERE x.team_id = OLD.team_id), 0)::bigint,
            investor_count = (SELECT count(DISTINCT x.investor_id) FROM team_investments x
                               WHERE x.team_id = OLD.team_id)::integer
         WHERE t.id = OLD.team_id;
    END IF;

    RETURN NULL;
END;
$$;

CREATE TRIGGER team_investments_sync_counters_trg
    AFTER INSERT OR UPDATE OR DELETE ON team_investments
    FOR EACH ROW EXECUTE FUNCTION team_investments_sync_counters();


-- users.role ist die Abkuerzung von "hat ein aktives Abonnement". Zwei
-- Wahrheiten fuer dieselbe Sache driften auseinander, sobald ein Abonnement
-- ablaeuft - also haelt dieser Trigger die Abkuerzung aktuell.
-- 'visitor' wird nie automatisch vergeben: das ist der Einstieg, keine
-- Herabstufung.
CREATE FUNCTION subscriptions_sync_user_role() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_user_id uuid;
    v_active  boolean;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_user_id := OLD.user_id;
    ELSE
        v_user_id := NEW.user_id;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM subscriptions s
         WHERE s.user_id = v_user_id
           AND s.active
           AND s.expires_at > now()
    ) INTO v_active;

    UPDATE users
       SET role = CASE
                      WHEN v_active           THEN 'subscriber'
                      WHEN users.role = 'subscriber' THEN 'user'
                      ELSE users.role
                  END
     WHERE id = v_user_id;

    RETURN NULL;
END;
$$;

CREATE TRIGGER subscriptions_sync_user_role_trg
    AFTER INSERT OR UPDATE OR DELETE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION subscriptions_sync_user_role();


-- =============================================================================
-- 11. Views
-- =============================================================================
-- Die API liest discussion, marketplace und die Anteile ueber diese Views und
-- bekommt genau die Felder, die der Vertrag nennt - unter den kanonischen
-- Namen, nicht unter den frueheren Arbeitsnamen.

CREATE VIEW idea_discussion AS
SELECT i.id                    AS idea_id,
       i.discussion_opened_at  AS opened_at,
       i.comment_count         AS comment_count,
       i.vote_up               AS vote_up,
       i.vote_down             AS vote_down
  FROM ideas i;

CREATE VIEW idea_marketplace AS
SELECT i.id                    AS idea_id,
       i.marketplace_opened_at AS opened_at,
       i.marketplace_closes_at AS closes_at,
       i.funding_goal_sat      AS funding_goal_sat,
       i.raised_sat            AS raised_sat,
       i.investor_count        AS investor_count,
       i.creator_share_bp      AS creator_share_bp
  FROM ideas i
 WHERE i.marketplace_opened_at IS NOT NULL;

-- Der Vertrag: "Anteile werden nicht gespeichert, sondern berechnet. View
-- idea_investor_shares rechnet investierte_sat / gesamte_sat ganzzahlig."
-- share_bp ist der Anteil des Investors am Idea-Pool in Basispunkten
-- (10000 = 100 Prozent). Ganzzahlige Division schneidet ab; die Summe der
-- Anteile kann deshalb bis unter 10000 bp liegen. Wer auszahlen will, rechnet
-- mit invested_sat (exakt) und nutzt share_bp nur zur Anzeige - so entsteht
-- aus Rundung kein verlorenes Satoshi.
CREATE VIEW idea_investor_shares AS
WITH per_investor AS (
    SELECT x.idea_id,
           x.investor_id,
           sum(x.amount_sat)::bigint AS invested_sat
      FROM idea_investments x
     GROUP BY x.idea_id, x.investor_id
),
totals AS (
    SELECT p.idea_id,
           sum(p.invested_sat)::bigint AS total_sat
      FROM per_investor p
     GROUP BY p.idea_id
)
SELECT p.idea_id                          AS idea_id,
       p.investor_id                      AS investor_id,
       p.invested_sat                     AS invested_sat,
       t.total_sat                        AS total_sat,
       CASE WHEN t.total_sat > 0
            THEN ((p.invested_sat * 10000) / t.total_sat)::integer
            ELSE 0
       END                                AS share_bp
  FROM per_investor p
  JOIN totals t ON t.idea_id = p.idea_id;


-- Dieselbe Rechnung wie idea_investor_shares, eine Ebene tiefer: der Anteil
-- eines Investors am TEAM-Pool in Basispunkten (10000 = 100 Prozent).
-- CONTRACT.md fuehrt nur die Idea-View namentlich; weil Idea-Shares und
-- Team-Shares aber getrennte Ansprueche sind ("Warum zwei Ledger, nicht
-- eines"), braucht jeder Anspruch seine eigene View - eine gemeinsame waere
-- keine Auszahlungsgrundlage, sondern eine Behauptung.
-- Gerechnet wird ganzzahlig: invested_sat * 10000 / total_sat. Die Division
-- schneidet ab, die Summe der Anteile kann deshalb knapp unter 10000 bp
-- liegen. Ausgezahlt wird nach invested_sat (exakt), share_bp ist die Anzeige.
CREATE VIEW team_investor_shares AS
WITH per_investor AS (
    SELECT x.team_id,
           x.investor_id,
           sum(x.amount_sat)::bigint AS invested_sat
      FROM team_investments x
     GROUP BY x.team_id, x.investor_id
),
totals AS (
    SELECT p.team_id,
           sum(p.invested_sat)::bigint AS total_sat
      FROM per_investor p
     GROUP BY p.team_id
)
SELECT p.team_id                           AS team_id,
       p.investor_id                       AS investor_id,
       p.invested_sat                      AS invested_sat,
       t.total_sat                         AS total_sat,
       CASE WHEN t.total_sat > 0
            THEN ((p.invested_sat * 10000) / t.total_sat)::integer
            ELSE 0
       END                                 AS share_bp
  FROM per_investor p
  JOIN totals t ON t.team_id = p.team_id;


-- =============================================================================
-- 12. Einheiten dokumentieren (ADR-006: Satoshi, ganzzahlig)
-- =============================================================================
COMMENT ON TABLE  users            IS 'Konten. role ist die Abkuerzung von "hat aktives Abonnement" (ADR-003).';
COMMENT ON TABLE  subscriptions    IS 'Abonnement-Historie. Das aktive Abonnement ist das Stimmrecht (ADR-003).';
COMMENT ON TABLE  user_wallets     IS 'Oeffentliche Schluessel. Die Plattform sieht nie einen privaten Schluessel (ADR-006).';
COMMENT ON TABLE  ideas            IS 'Ideen mit discussion- und marketplace-Phase (ARCHITECTURE 5.2).';
COMMENT ON TABLE  idea_votes       IS 'Einzelstimmen - die Wahrheit hinter vote_up/vote_down.';
COMMENT ON TABLE  idea_investments IS 'Ledger der Direktzahlungen - die Quelle von raised_sat und investor_count und die Grundlage der 20/80-Aufteilung.';
COMMENT ON TABLE  teams            IS 'Teams je Idea (ARCHITECTURE 5.4).';
COMMENT ON TABLE  team_investments IS 'Ledger der Team-Shares - die Quelle von teams.raised_sat und teams.investor_count und die Grundlage der Team-Seite der 20/80-Aufteilung.';
COMMENT ON TABLE  milestones       IS 'Meilensteine je Team (ARCHITECTURE 5.5).';

COMMENT ON COLUMN ideas.funding_goal_sat      IS 'Satoshi (BIGINT, ganzzahlig)';
COMMENT ON COLUMN ideas.raised_sat            IS 'Satoshi (BIGINT, ganzzahlig). Zaehler aus idea_investments, per Trigger gepflegt.';
COMMENT ON COLUMN ideas.creator_share_bp      IS 'Basispunkte, 10000 = 100 Prozent. 2000 bp = die 20 Prozent der Idee-Seite.';
COMMENT ON COLUMN teams.funding_goal_sat      IS 'Satoshi (BIGINT, ganzzahlig)';
COMMENT ON COLUMN teams.raised_sat            IS 'Satoshi (BIGINT, ganzzahlig). Zaehler aus team_investments, per Trigger vollstaendig neu gezaehlt.';
COMMENT ON COLUMN teams.investor_count        IS 'Zaehler. Anzahl verschiedener Investoren mit Belegen in team_investments, per Trigger gepflegt.';
COMMENT ON COLUMN teams.skin_in_game_sat      IS 'Satoshi (BIGINT, ganzzahlig)';
COMMENT ON COLUMN milestones.funding_release_sat IS 'Satoshi (BIGINT, ganzzahlig)';
COMMENT ON COLUMN subscriptions.payment_amount IS 'Satoshi (BIGINT, ganzzahlig)';

COMMENT ON COLUMN idea_votes.subscription_id  IS 'Das Abonnement, das dieses Stimmrecht verliehen hat (ADR-003).';
COMMENT ON COLUMN ideas.comment_count         IS 'Zaehler. Wird von der idea_comments-Tabelle (Migration 002) gepflegt.';
COMMENT ON COLUMN idea_investments.amount_sat IS 'Satoshi (BIGINT, ganzzahlig), immer > 0.';
COMMENT ON COLUMN idea_investments.txid       IS 'Transaktionskennung (64 Hexzeichen), UNIQUE - derselbe Beleg zaehlt nur einmal.';
COMMENT ON COLUMN team_investments.amount_sat IS 'Satoshi (BIGINT, ganzzahlig), immer > 0.';
COMMENT ON COLUMN team_investments.txid       IS 'Transaktionskennung (64 Hexzeichen), UNIQUE - derselbe Beleg zaehlt nur einmal.';

COMMIT;
