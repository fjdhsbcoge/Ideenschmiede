-- =============================================================================
-- Ideenschmiede - Migration 006_team_applications
-- =============================================================================
-- Team-Bewerbungen. Legt EINE Tabelle an, sonst nichts:
--
--   team_applications - die Bewerbung eines Nutzers auf ein Team.
--
-- Voraussetzung: 001_init.sql bis 005_ratelimit.sql sind eingespielt (diese
-- Datei baut auf users und teams auf). Einzeln einspielbar:
--     psql -d ideenschmiede -v ON_ERROR_STOP=1 -f 006_team_applications.sql
-- 001 bis 005 werden NICHT angefasst.
--
-- -----------------------------------------------------------------------------
-- Warum diese Tabelle existiert
-- -----------------------------------------------------------------------------
-- Bewerbungen lagen bis hierher AUSSCHLIESSLICH im localStorage des Browsers
-- (webapp/src/lib/store.tsx, Schluessel 'ideenschmiede_applications'). Das ist
-- kein Speicher, sondern ein Zwischenspeicher: faellt er weg (anderer Rechner,
-- geloeschter Verlauf, privates Fenster), sind die Bewerbungen weg - und der
-- Teamleiter hat sie nie gesehen, weil sie seinen Browser nie erreicht haben.
-- Eine Bewerbung ist eine Aussage eines Nutzers ueber sich selbst; sie gehoert
-- dorthin, wo sie den Empfaenger erreicht: in die Datenbank.
--
-- -----------------------------------------------------------------------------
-- Statuswerte: die drei Werte des Frontends, nicht mehr und nicht weniger
-- -----------------------------------------------------------------------------
-- webapp/src/lib/store.tsx fuehrt
--     status: 'offen' | 'angenommen' | 'abgelehnt'
-- und webapp/src/lib/i18n/de.ts (pages.common.applicationStatus) hat genau
-- diese drei Schluessel. Der CHECK unten uebernimmt sie WOERTLICH.
--
-- Deutsch statt englisch ist hier Absicht und eine Ausnahme von teams.status
-- ('applying', 'funding', ...): der Wertebereich steht bereits im Frontend und
-- wird dort angezeigt. Ein zweiter Wertebereich ('open'/'accepted'/'rejected')
-- waere eine Uebersetzungsschicht mehr, die genau an der Stelle auseinander-
-- laufen wuerde, an der sie gebraucht wird.
--
-- Ein vierter Wert ('zurueckgezogen') steht NICHT zur Verfuegung: das Frontend
-- kennt ihn nicht (siehe Entscheidung C unten) - und ein Status, den die
-- Anzeige nicht kennt, waere eine leere Zeile in der Oberflaeche.
--
-- -----------------------------------------------------------------------------
-- Entscheidung A: 'angenommen' macht NIEMANDEN zum Teammitglied
-- -----------------------------------------------------------------------------
-- Es gibt keine Mitgliedertabelle - und das ist keine Luecke, sondern eine
-- Festlegung: api/migrations/README.md fuehrt 'team_members' ausdruecklich
-- unter "Was diese Migration bewusst nicht enthaelt": "5.4 kennt nur leaderId.
-- Mitgliedschaft ist ein eigenes Thema (Rollen, Austritt, Reputation) und wird
-- nicht mitgeraten."
--
-- Diese Migration haelt sich daran. Die einzige Mitgliedschaft, die das Schema
-- BELEGT, ist teams.leader_id (RESTRICT, NOT NULL): der Leiter ist der eine
-- namentlich bekannte Mensch eines Teams. Eine zweite, hier schnell
-- mitgelieferte Mitgliedertabelle waere genau die zweite Wahrheit, die
-- api/CONTRACT.md ausschliesst - und sie waere geraten: Rollen, Austritt und
-- Reputation eines Mitglieds sind nicht entschieden.
--
-- Folge fuer den Endpunkt PATCH /api/applications/:id: 'angenommen' ist die
-- ENTSCHEIDUNG des Teamleiters ueber eine Bewerbung - sie ist KEIN Beleg fuer
-- eine Mitgliedschaft. Es gibt deshalb auch keine Transaktion, in der "Status"
-- und "Mitgliedschaft" gemeinsam geschrieben werden muessten: es gibt nur eine
-- der beiden Zeilen. Wer die Mitgliedschaft anlegt, ist damit eine offene
-- Produktentscheidung, nicht diese Migration (siehe api/README.md der
-- Anwendung und den Bericht zu dieser Aufgabe).
--
-- -----------------------------------------------------------------------------
-- Entscheidung B: eine Bewerbung je Nutzer und Team
-- -----------------------------------------------------------------------------
-- team_applications_one_per_user_key UNIQUE (team_id, user_id) laesst genau
-- EINE Zeile zu. Eine zweite Bewerbung auf dasselbe Team ist damit strukturell
-- unmoeglich und nicht nur unwahrscheinlich - dieselbe Haltung wie
-- idea_votes_one_per_user_key (eine Stimme je Nutzer und Idea).
--
-- Der Endpunkt antwortet auf den zweiten Versuch mit 409 (code
-- 'application_exists'), und zwar mit Absicht: das Frontend deaktiviert den
-- Knopf, sobald eine Bewerbung existiert (TeamDetail.tsx: disabled={!!myApp}),
-- unabhaengig vom Status. Ein stilles Zuruecksetzen auf 'offen' waere eine
-- Entscheidung, die niemand getroffen hat: sie loescht die Ablehnung des
-- Teamleiters, waehrend die Bewerbung liegen bleibt.
--
-- Wer wieder bewerben will, nimmt die bestehende Bewerbung zurueck
-- (Entscheidung C); danach ist der Platz frei, weil die Zeile wirklich weg ist.
--
-- -----------------------------------------------------------------------------
-- Entscheidung C: Zuruecknehmen darf nur der Bewerber - und nur solange offen
-- -----------------------------------------------------------------------------
-- Das Frontend bietet den Zuruecknehmen-Knopf ausschliesslich bei status
-- 'offen' an (Teams.tsx: a.status === 'offen' && ...), und er entfernt die
-- Bewerbung ganz (store.tsx, withdrawApplication: prev.filter(a => a.id !== id)).
-- Genau das tut DELETE /api/applications/:id: die Zeile verschwindet.
--
-- Eine bereits entschiedene Bewerbung ('angenommen'/'abgelehnt') ist NICHT
-- zuruecknehmbar (409). Sie ist das Ergebnis einer Entscheidung des
-- Teamleiters, und dieses Ergebnis dem Bewerber zum Loeschen zu ueberlassen
-- hiesse, den Beleg der Entscheidung zu vernichten. Der Bewerber kann sie
-- sehen (GET /api/users/me/applications) - veraendern kann er sie nicht.
--
-- -----------------------------------------------------------------------------
-- Leitplanken (api/CONTRACT.md ist der kanonische Datenvertrag)
-- -----------------------------------------------------------------------------
--   * Aufzaehlungen sind text mit CHECK, kein CREATE TYPE.
--   * Alle Zeitstempel sind timestamptz (immer absolut, nie lokal).
--   * Jeder Fremdschluessel hat eine ON DELETE-Regel und Indexabdeckung.
--   * Kein Geldbetrag, kein Beleg, kein Zaehler: diese Tabelle traegt keine
--     _sat-Spalte, keine txid und keinen abgeleiteten Wert.
--   * Namensform: Datenbank snake_case, die API liefert camelCase verschachtelt
--     (src/applications.ts).
--
-- Was diese Migration bewusst NICHT enthaelt (gemeldet, nicht geraten):
--   * team_members            - siehe Entscheidung A.
--   * skills / hours          - das Formular im Frontend erhebt sie
--     (JoinTeamModal: skills, hours, message) und die Leader-Ansicht zeigt sie
--     an; die Aufgabe nennt fuer den Rumpf aber ausschliesslich { "message" }.
--     Eine Spalte auf Verdacht waere geraten - die Luecke steht im Bericht.
--   * einen Zaehler "offene Bewerbungen" in teams - ein Zaehler ohne
--     Quelltabelle ist Datenverlust (CONTRACT.md); die Zahl ist eine
--     count(*)-Abfrage auf genau diese Tabelle.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. team_applications
-- =============================================================================
CREATE TABLE team_applications (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Ein Team ohne Bewerbungen ist der Normalfall; ein Team MIT Bewerbungen
    -- ist das Ziel dieser Aufgabe.
    --
    -- ON DELETE CASCADE, wie milestones -> teams und idea_votes -> ideas: eine
    -- Bewerbung ist eine Absichtserklaerung, kein Geldbeleg. Verschwindet das
    -- Team (ideas -> teams ist CASCADE, ein Team ohne Idee hat keinen Auftrag),
    -- hat die Bewerbung keinen Gegenstand mehr. team_investments steht hier auf
    -- RESTRICT - dort haengt Geld an der Zeile, hier nicht.
    team_id    uuid        NOT NULL REFERENCES teams (id) ON DELETE CASCADE,

    -- ON DELETE CASCADE, wie idea_votes.user_id: das Loeschen eines Kontos
    -- nimmt seine eigenen Erklaerungen mit. Der Bewerber IST die Bewerbung -
    -- ohne ihn bliebe eine Zeile stehen, die niemand mehr erklaeren kann.
    -- (ideas.author_id und die Ledger stehen auf RESTRICT, weil dort ein Werk
    -- bzw. eine Zahlung des Nutzers haengt.)
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,

    -- Der Bewerbungstext. NOT NULL: eine Bewerbung ohne Text ist keine - der
    -- Teamleiter entscheidet ueber genau diesen Text.
    --
    -- Die Laengengrenzen sind nicht erfunden, sondern die Regel des Formulars:
    -- JoinTeamModal prueft message.trim().length >= 20, bevor der Knopf
    -- ueberhaupt aktiv wird. Die Untergrenze steht deshalb auch hier; sonst
    -- nimmt die API per curl eine Bewerbung an, die die Oberflaeche nie
    -- abgeschickt haette. Die Obergrenze 2000 ist eine Hausregel wie
    -- users_display_name_check (80) und ideas_title_check (200): eine
    -- Bewerbung ist ein Text, kein Dateianhang.
    message    text        NOT NULL,

    -- Die drei Werte des Frontends, woertlich (siehe Kopf). 'offen' ist der
    -- Einstieg: jede Bewerbung beginnt unbeantwortet.
    status     text        NOT NULL DEFAULT 'offen',

    -- WANN entschieden wurde. Ohne diese Spalte waere nach der Entscheidung
    -- nicht mehr feststellbar, wann sie gefallen ist - und der Status waere die
    -- einzige Spur davon. Dieselbe Paarung wie milestones.completed_at.
    --
    -- WARUM HIER KEIN decided_by STEHT: wer entschieden hat, ist der Teamleiter
    -- (teams.leader_id) - und zwar der einzige, der es nach der Zugriffsregel
    -- der API ueberhaupt darf. Eine zweite Spalte mit demselben Inhalt waere
    -- eine zweite Wahrheit: sie koennte nach einem Leiterwechsel etwas anderes
    -- sagen als teams.leader_id, ohne dass eine der beiden Stellen falsch
    -- aussieht.
    decided_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Entscheidung 5 / CONTRACT.md: text + CHECK statt ENUM-Typ.
    CONSTRAINT team_applications_status_check
        CHECK (status IN ('offen', 'angenommen', 'abgelehnt')),

    -- Dieselbe Regel wie das Formular (siehe message oben) plus Hausobergrenze.
    CONSTRAINT team_applications_message_check
        CHECK (length(btrim(message)) BETWEEN 20 AND 2000),

    -- Status und Zeitpunkt gehoeren zusammen - in beide Richtungen. Eine offene
    -- Bewerbung mit Entscheidungsdatum waere so widerspruechlich wie ein
    -- entschiedener Meilenstein ohne completed_at (milestones_completed_at_check).
    CONSTRAINT team_applications_decided_at_check
        CHECK ((status = 'offen') = (decided_at IS NULL)),

    -- Entscheidung B: eine Bewerbung je Nutzer und Team. Der Index dieser
    -- Constraint beginnt mit team_id und deckt damit die Fremdschluesselpruefung
    -- auf team_id vollstaendig ab (CONTRACT.md, Leading-Column-Regel) - ein
    -- eigener Einzelindex auf team_id waere reine Schreiblast.
    CONSTRAINT team_applications_one_per_user_key UNIQUE (team_id, user_id)
);

-- Die Abfrage hinter GET /api/users/me/applications: die eigenen Bewerbungen,
-- die neueste zuerst. Deckt zugleich die Fremdschluesselpruefung auf user_id ab
-- (die UNIQUE-Constraint oben beginnt mit team_id und leistet das nicht).
CREATE INDEX team_applications_user_created_at_idx
    ON team_applications (user_id, created_at DESC);

-- Die Abfrage hinter GET /api/teams/:id/applications: alle Bewerbungen eines
-- Teams, die neueste zuerst. Deckungsgleich mit
-- team_investments_team_created_at_idx - die FK-Abdeckung auf team_id leistet
-- bereits die UNIQUE-Constraint; dieser Index existiert fuer die SORTIERUNG,
-- nicht fuer die Fremdschluesselpruefung.
CREATE INDEX team_applications_team_created_at_idx
    ON team_applications (team_id, created_at DESC);

-- Ein Schreiber fuer updated_at, statt die Spalte in jeder Abfrage zu setzen -
-- dieselbe Funktion wie fuer users, ideas, teams und idea_votes (001_init.sql).
CREATE TRIGGER team_applications_set_updated_at
    BEFORE UPDATE ON team_applications
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE team_applications IS
    'Bewerbung eines Nutzers auf ein Team. Genau eine Zeile je (team_id, user_id). Statuswerte sind die des Frontends: offen, angenommen, abgelehnt.';

COMMENT ON COLUMN team_applications.status IS
    'offen | angenommen | abgelehnt - die Werte aus webapp (pages.common.applicationStatus). Nur der Teamleiter (teams.leader_id) aendert sie, und nur von offen aus.';

COMMENT ON COLUMN team_applications.decided_at IS
    'Zeitpunkt der Entscheidung des Teamleiters. NULL genau dann, wenn status = offen ist (team_applications_decided_at_check).';

COMMENT ON COLUMN team_applications.message IS
    'Bewerbungstext, 20 bis 2000 Zeichen (btrim). Die Untergrenze ist die Regel des Formulars (JoinTeamModal).';

COMMIT;
