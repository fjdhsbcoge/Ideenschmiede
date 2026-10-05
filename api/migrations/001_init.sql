-- =============================================================================
-- Ideenschmiede - Migration 001_init
-- =============================================================================
-- Bildet die vier Kernentitaeten aus ARCHITECTURE.md Anhang 5 ab:
--   users, ideas, teams, milestones
-- plus die beiden Hilfstabellen, die aus den offenen Entscheidungen folgen:
--   subscriptions (Entscheidung 2), user_wallets (Entscheidung 1)
-- und idea_votes (Entscheidung 4).
--
-- Verbindliche Leitplanken:
--   * ADR-006 (non-custodial): jeder Geldbetrag ist Satoshi und damit eine
--     GANZE ZAHL. Jede Geldspalte ist BIGINT; in dieser Datei kommt kein
--     einziger Gleitkomma- oder Festkommatyp vor.
--   * ADR-003: das Abonnement ist das Stimmrecht. Deshalb ist es eine eigene
--     Tabelle mit Historie (nicht eine Spalte), und deshalb setzt die
--     Datenbank selbst durch, dass nur Abonnenten stimmen koennen.
--   * Alle Zeitstempel sind TIMESTAMPTZ (immer absolut, nie lokal).
--   * Jeder Fremdschluessel hat eine ON DELETE-Regel und einen Index.
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
    payment_tx_hash    text,
    payment_amount     bigint,

    created_at         timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT subscriptions_type_check
        CHECK (type IN ('annual')),
    CONSTRAINT subscriptions_period_check
        CHECK (expires_at > started_at),
    CONSTRAINT subscriptions_payment_amount_check
        CHECK (payment_amount IS NULL OR payment_amount > 0)
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
        CHECK (xpub ~ '^(xpub|ypub|zpub|tpub|upub|vpub)[1-9A-HJ-NP-Za-km-z]{50,120}$')
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
    comments              bigint      NOT NULL DEFAULT 0,
    votes_up              bigint      NOT NULL DEFAULT 0,
    votes_down            bigint      NOT NULL DEFAULT 0,

    -- marketplace-Phase (optional: erst ab stage 'marketplace' gefuellt)
    marketplace_opened_at timestamptz,
    marketplace_closes_at timestamptz,
    funding_goal          bigint,
    raised                bigint      NOT NULL DEFAULT 0,
    investors             bigint      NOT NULL DEFAULT 0,

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
    CONSTRAINT ideas_comments_check     CHECK (comments >= 0),
    CONSTRAINT ideas_votes_up_check     CHECK (votes_up >= 0),
    CONSTRAINT ideas_votes_down_check   CHECK (votes_down >= 0),
    CONSTRAINT ideas_raised_check       CHECK (raised >= 0),
    CONSTRAINT ideas_investors_check    CHECK (investors >= 0),
    CONSTRAINT ideas_funding_goal_check CHECK (funding_goal IS NULL OR funding_goal > 0),

    CONSTRAINT ideas_marketplace_window_check
        CHECK (marketplace_closes_at IS NULL
               OR marketplace_opened_at IS NULL
               OR marketplace_closes_at > marketplace_opened_at),

    -- Die marketplace-Phase ist entweder ganz offen oder ganz zu. Ein Idea mit
    -- closes_at, aber ohne funding_goal waere ein halb eroeffneter Marktplatz.
    CONSTRAINT ideas_marketplace_all_or_nothing_check
        CHECK ((marketplace_opened_at IS NULL
                AND marketplace_closes_at IS NULL
                AND funding_goal IS NULL)
            OR (marketplace_opened_at IS NOT NULL
                AND marketplace_closes_at IS NOT NULL
                AND funding_goal IS NOT NULL))
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
-- 6. teams
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

    funding_goal    bigint      NOT NULL DEFAULT 0,
    raised          bigint      NOT NULL DEFAULT 0,
    skin_in_game    bigint      NOT NULL DEFAULT 0,
    status          text        NOT NULL DEFAULT 'applying',

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT teams_status_check
        CHECK (status IN ('applying', 'funding', 'funded', 'building', 'completed')),
    CONSTRAINT teams_name_check
        CHECK (length(btrim(name)) BETWEEN 1 AND 120),
    CONSTRAINT teams_timeline_months_check
        CHECK (timeline_months IS NULL OR timeline_months > 0),
    CONSTRAINT teams_funding_goal_check CHECK (funding_goal >= 0),
    CONSTRAINT teams_raised_check       CHECK (raised >= 0),
    CONSTRAINT teams_skin_in_game_check CHECK (skin_in_game >= 0)
);

CREATE INDEX teams_idea_id_idx   ON teams (idea_id);
CREATE INDEX teams_leader_id_idx ON teams (leader_id);
CREATE INDEX teams_status_idx    ON teams (status);


-- =============================================================================
-- 7. milestones
-- =============================================================================
CREATE TABLE milestones (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id        uuid        NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    title          text        NOT NULL,
    description    text        NOT NULL DEFAULT '',
    deliverables   text[]      NOT NULL DEFAULT '{}',
    funding_release bigint      NOT NULL DEFAULT 0,
    status         text        NOT NULL DEFAULT 'pending',
    position       integer     NOT NULL DEFAULT 0,
    due_date       timestamptz,
    completed_at   timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT milestones_status_check
        CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
    CONSTRAINT milestones_title_check
        CHECK (length(btrim(title)) BETWEEN 1 AND 200),
    CONSTRAINT milestones_funding_release_check CHECK (funding_release >= 0),

    -- 'completed' und completed_at gehoeren zusammen. Ohne diese Regel gibt es
    -- frueher oder spaeter einen fertigen Meilenstein ohne Datum.
    CONSTRAINT milestones_completed_at_check
        CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

CREATE INDEX milestones_team_id_idx       ON milestones (team_id);
CREATE INDEX milestones_team_position_idx ON milestones (team_id, position);


-- =============================================================================
-- 8. Trigger-Funktionen
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


-- Der einzige Schreiber der Zaehler votes_up/votes_down. Damit koennen die
-- Zaehler nicht von den Einzelstimmen abweichen - und die Einzelstimmen
-- bleiben trotzdem die Wahrheit (Entscheidung 4).
CREATE FUNCTION idea_votes_sync_counters() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE ideas SET
            votes_up   = votes_up   + CASE WHEN NEW.direction = 'up'   THEN 1 ELSE 0 END,
            votes_down = votes_down + CASE WHEN NEW.direction = 'down' THEN 1 ELSE 0 END
         WHERE id = NEW.idea_id;
        RETURN NULL;

    ELSIF TG_OP = 'DELETE' THEN
        UPDATE ideas SET
            votes_up   = votes_up   - CASE WHEN OLD.direction = 'up'   THEN 1 ELSE 0 END,
            votes_down = votes_down - CASE WHEN OLD.direction = 'down' THEN 1 ELSE 0 END
         WHERE id = OLD.idea_id;
        RETURN NULL;

    ELSE  -- UPDATE: Richtung geaendert, beide Zaehler nachziehen.
        UPDATE ideas SET
            votes_up   = votes_up
                       + CASE WHEN NEW.direction = 'up'   THEN 1 ELSE 0 END
                       - CASE WHEN OLD.direction = 'up'   THEN 1 ELSE 0 END,
            votes_down = votes_down
                       + CASE WHEN NEW.direction = 'down' THEN 1 ELSE 0 END
                       - CASE WHEN OLD.direction = 'down' THEN 1 ELSE 0 END
         WHERE id = NEW.idea_id;
        RETURN NULL;
    END IF;
END;
$$;

CREATE TRIGGER idea_votes_sync_counters_trg
    AFTER INSERT OR UPDATE OR DELETE ON idea_votes
    FOR EACH ROW EXECUTE FUNCTION idea_votes_sync_counters();


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
-- 9. Views: die in ARCHITECTURE.md 5.2 dokumentierten Namen
-- =============================================================================
-- Die API liest discussion und marketplace ueber diese Views und bekommt
-- genau die Felder, die der Vertrag nennt.

CREATE VIEW idea_discussion AS
SELECT i.id                    AS idea_id,
       i.discussion_opened_at  AS opened_at,
       i.comments              AS comments,
       i.votes_up              AS votes_up,
       i.votes_down            AS votes_down
  FROM ideas i;

CREATE VIEW idea_marketplace AS
SELECT i.id                    AS idea_id,
       i.marketplace_opened_at AS opened_at,
       i.marketplace_closes_at AS closes_at,
       i.funding_goal          AS funding_goal,
       i.raised                AS raised,
       i.investors             AS investors
  FROM ideas i
 WHERE i.marketplace_opened_at IS NOT NULL;


-- =============================================================================
-- 10. Einheiten dokumentieren (ADR-006: Satoshi, ganzzahlig)
-- =============================================================================
COMMENT ON TABLE  users            IS 'Konten. role ist die Abkuerzung von "hat aktives Abonnement" (ADR-003).';
COMMENT ON TABLE  subscriptions    IS 'Abonnement-Historie. Das aktive Abonnement ist das Stimmrecht (ADR-003).';
COMMENT ON TABLE  user_wallets     IS 'Oeffentliche Schluessel. Die Plattform sieht nie einen privaten Schluessel (ADR-006).';
COMMENT ON TABLE  ideas            IS 'Ideen mit discussion- und marketplace-Phase (ARCHITECTURE 5.2).';
COMMENT ON TABLE  idea_votes       IS 'Einzelstimmen - die Wahrheit hinter votes_up/votes_down.';
COMMENT ON TABLE  teams            IS 'Teams je Idea (ARCHITECTURE 5.4).';
COMMENT ON TABLE  milestones       IS 'Meilensteine je Team (ARCHITECTURE 5.5).';

COMMENT ON COLUMN ideas.funding_goal        IS 'Satoshi (BIGINT, ganzzahlig)';
COMMENT ON COLUMN ideas.raised              IS 'Satoshi (BIGINT, ganzzahlig)';
COMMENT ON COLUMN teams.funding_goal        IS 'Satoshi (BIGINT, ganzzahlig)';
COMMENT ON COLUMN teams.raised              IS 'Satoshi (BIGINT, ganzzahlig)';
COMMENT ON COLUMN teams.skin_in_game        IS 'Satoshi (BIGINT, ganzzahlig)';
COMMENT ON COLUMN milestones.funding_release IS 'Satoshi (BIGINT, ganzzahlig)';
COMMENT ON COLUMN subscriptions.payment_amount IS 'Satoshi (BIGINT, ganzzahlig)';

COMMENT ON COLUMN idea_votes.subscription_id IS 'Das Abonnement, das dieses Stimmrecht verliehen hat (ADR-003).';
COMMENT ON COLUMN ideas.comments            IS 'Zaehler. Wird von der comments-Tabelle (Migration 002) gepflegt.';

COMMIT;
