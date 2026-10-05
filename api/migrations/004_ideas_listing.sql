-- =============================================================================
-- Ideenschmiede - Migration 004
-- =============================================================================
-- Zwei Nachträge, beide am laufenden System gemessen. Keine Struktur-Aenderung,
-- kein Datenverlust: die Migration fuegt einen Index hinzu und verschaerft eine
-- Pruefung, die bisher gar nicht existierte.
--
-- Ausfuehren:  psql -d ideenschmiede -f 004_ideas_listing.sql
-- =============================================================================

BEGIN;


-- =============================================================================
-- 1. Sortierindex fuer den Standardabruf
-- =============================================================================
-- Die API listet Ideen mit:
--     ORDER BY i.created_at DESC, i.id DESC
-- (api/src/app.ts). Der zweite Schluessel macht die Reihenfolge bei gleichem
-- Zeitstempel eindeutig - ohne ihn koennten Eintraege beim Blaettern doppelt
-- erscheinen oder fehlen.
--
-- Dafuer gab es keinen Index. Vorhanden waren: (author_id), (tags GIN),
-- (stage, created_at) und (marketplace_closes_at). Der zusammengesetzte
-- Stufenindex greift nur, wenn nach stage gefiltert wird; der ungefilterte
-- Abruf - der Standardfall - hatte keinen.
--
-- Am Planer gemessen (PostgreSQL 16.15, EXPLAIN SELECT id FROM ideas ORDER BY
-- created_at DESC, id DESC LIMIT 20):
--     ohne Index:  Limit -> Sort (Sort Key: created_at DESC, id DESC)
--                  -> Seq Scan on ideas, cost 10000000019.88
--     mit Index :  Limit -> Index Only Scan using ideas_created_at_idx,
--                  cost 0.15   (kein Sortierschritt)
--
-- Die Spaltenreihenfolge muss zur Sortierung passen und beide Schluessel
-- enthalten. DESC auf beiden, weil die Sortierung durchgehend absteigend ist;
-- PostgreSQL kann einen Index mit umgekehrter Richtung lesen, aber die
-- Richtungsangabe macht die Uebereinstimmung unmittelbar sichtbar.
CREATE INDEX ideas_created_at_idx ON ideas (created_at DESC, id DESC);

-- Die beiden Einzelindizes auf created_at bzw. id sind damit unnoetig:
-- ein Index, der mit created_at beginnt, bedient auch eine reine
-- created_at-Abfrage (Leading-Column-Regel, CONTRACT.md). id ist ohnehin
-- Primaerschluessel und hat seinen eigenen Btree.


-- =============================================================================
-- 2. Eine Idee ohne Beschreibung ist keine Idee
-- =============================================================================
-- ideas.description war NOT NULL DEFAULT '' - also eine leere Zeichenkette
-- erlaubt, und ohne jede Laengenpruefung. Titel und Beschreibung sind die
-- einzigen Felder, aus denen ein Leser entscheidet, ob ihn eine Idee
-- interessiert; eine leere Beschreibung macht die Idee unbrauchbar, ohne dass
-- irgendetwas fehlschlaegt. Das ist derselbe Fehlertyp wie eine leere Anzeige:
-- formal gueltig, praktisch wertlos.
--
-- Dieselbe Form wie ideas_title_check (3..200 Zeichen, mit btrim gegen
-- reine Leerzeichen). Ein Mindestmass von 20 Zeichen laesst kurze, aber
-- vollstaendige Saetze zu und schliesst Platzhalter aus.
--
-- Hinweis zur Wirkung: Die Pruefung greift ab dem Einspielen. Bestehende
-- Zeilen mit kuerzerer Beschreibung liessen die Migration scheitern - das ist
-- beabsichtigt, weil ein stiller Bestandsverstoss spaeter schwerer zu finden
-- ist als ein Abbruch beim Einspielen. Vor dem Einspielen pruefen:
--     SELECT count(*) FROM ideas WHERE length(btrim(description)) < 20;
-- Ergebnis muss 0 sein.
ALTER TABLE ideas
    ADD CONSTRAINT ideas_description_check
    CHECK (length(btrim(description)) >= 20);

-- Der Standardwert '' widerspricht der neuen Pruefung: ein INSERT ohne
-- Beschreibung wuerde jetzt abgewiesen, aber die Fehlermeldung spraeche von
-- einer zu kurzen Zeichenkette, nicht von einer fehlenden Angabe. Den
-- Standard entfernen macht daraus eine ehrliche NOT-NULL-Pflicht.
ALTER TABLE ideas
    ALTER COLUMN description DROP DEFAULT;

COMMENT ON CONSTRAINT ideas_description_check ON ideas IS
    'Eine Idee braucht eine Beschreibung von mindestens 20 Zeichen (btrim). Ohne sie ist die Idee fuer Leser nicht beurteilbar - siehe Migration 004.';

COMMIT;