# Ideenschmiede – Roadmap (technische Umsetzung)

**Stand: Juli 2026 · Aktuelle Version: v1.2 (Frontend-Demo, live auf GitHub Pages)**

Aufwandsschätzungen gehen von KI-gestützter Entwicklung (Mensch + KI-Agent,
Teilzeit) aus. Siehe auch ARCHITECTURE.md Teil 2 (Zielarchitektur) und
Teil 3 (ADRs).

---

## Phase 1 – Demo ausbauen (v1.3) ⏳ läuft

*Ziel: Die Demo ist rund, bevor Infrastruktur entsteht.*

| # | Aufgabe | Aufwand | Status |
|---|---|---|---|
| 1.1 | i18n-Migration restlicher Seiten (Dashboard, Profil, Teams, Discussion …) auf `de.ts` | ~½ Tag | ✅ erledigt (v1.3) |
| 1.2 | Settings-Seite (Profil, Wallet/xpub-Anbindung, Benachrichtigungen) | ~½ Tag | ✅ erledigt (v1.3) |
| 1.3 | Kommentar-Threads (Antworten statt flacher Liste) | ~½ Tag | ✅ erledigt (v1.3) |
| 1.4 | Whitepaper-PDF über Live-URL erreichbar (`webapp/public/`) | ~10 Min | ✅ erledigt (v1.3) |
| 1.5 | Teilen-Funktion für Ideen (Social + Link kopieren) | ~1 h | ✅ erledigt (v1.3) |

**Definition of Done:** `npm run build` grün, alle UI-Texte aus `de.ts`,
Deployment per Push.

---

## Phase 2 – Online-Stellung & Domain (v1.4)

*Ziel: Die Demo unter eigener Domain zeigbar.*

| # | Aufgabe | Aufwand | Status |
|---|---|---|---|
| 2.1 | Pages-Quelle auf „GitHub Actions" umstellen (einmalig, manuell) | 5 Min | ✅ erledigt – live: https://fjdhsbcoge.github.io/Ideenschmiede/ |
| 2.2 | Custom Domain in Pages eintragen + DNS (CNAME/A-Records) | ~1 h + DNS-Propagation | offen |
| 2.3 | HTTPS erzwingen (Let's Encrypt via GitHub) | automatisch | offen |
| 2.4 | Impressum + Datenschutzerklärung (Pflicht in DE) | ~1 h + juristische Prüfung | offen |

---

## Phase 3 – MVP-Backend (v2.0)

*Ziel: Echte Nutzer, echte Subscription, echte Daten. Kein Share-Handel
vor rechtlicher Klärung (siehe 3.6).*

| # | Aufgabe | Aufwand | Anmerkung |
|---|---|---|---|
| 3.1 | Backend-Grundgerüst: Hono + PostgreSQL, Docker Compose | 4–6 Tage | Datenmodelle: ARCHITECTURE.md Anhang §5 |
| 3.2 | Auth: LNURL-auth (Lightning-Login) + Session-JWT | 2–3 Tage | Fallback E-Mail/Passwort abwägen (ADR-offen) |
| 3.3 | BTCPay-Server: Subscription-Invoices, Webhook → Rolle „Subscriber" | 2–4 Tage | non-custodial, BTC + Lightning |
| 3.4 | Frontend-Umbau: Store von localStorage auf API | 3–4 Tage | einzige Umstell-Stelle, siehe ARCHITECTURE.md §1.4 |
| 3.5 | Härtung: Backups, Monitoring, Rate-Limits, Impressum | 2–3 Tage | |
| 3.6 | **Rechtliche Prüfung Investments** (VermAnlG/WpHG, Fachanwalt) | 1–2 Termine | **Gate für alles, was echte Gewinnbeteiligung abbildet** |

**Geschätzte Gesamtdauer:** 2–4 Wochen Teilzeit.

---

## Phase 4 – Echtes Geld, echte Teams (v2.5)

*Voraussetzung: 3.6 abgeschlossen.*

- Idea-/Team-Shares als reale Zahlungsflüsse (BTCPay-Invoices pro Empfänger)
- Milestone-Tranchen mit Investor-Vote (soziale Verträge; Multisig-Escrow als Streit-Fallback prüfen)
- Revenue-Reports: Teams reichen Berichte ein, 20/80-Ausschüttung dokumentiert on-chain
- Chain-of-Thought-Scoring: Punkte → anteilige Auszahlung aus dem 5 %-Pool

---

## Phase 5 – Föderation (v3.0)

*Ziel: Tausend Schmieden statt einer Plattform (ADR-004).*

| Baustein | Inhalt |
|---|---|
| Identität | Schlüsselpaar-Login als Standard (Nostr-Stil), Export/Import |
| Attest-Protokoll | Signierte Reputations-Events (append-only), instanzübergreifend verifizierbar |
| Instanz-Kit | Docker-Compose-Paket „eigene Schmiede in 30 Minuten" (eigene Sprache, Subscription, Regeln) |
| Relay | Ideen-Referenzen + Atteste zwischen Instanzen; Moderation bleibt lokal |
| Deutschland-Instanz | Ideenschmiede.de als erste Referenz-Instanz |

**Geschätzte Gesamtdauer:** 3–6 Monate, abhängig vom MVP-Feedback.

---

## Prinzipien der Umsetzung

1. **Geld zuletzt:** Erst UX, dann Infrastruktur, dann echte Zahlungen – nie andersherum.
2. **Recht vor Revenue:** Kein Share-Handel vor anwaltlicher Klärung (3.6).
3. **Jede Stufe deploybar:** Kein Big-Bang-Rewrite; die Plattform ist zu jedem Zeitpunkt lauffähig.
4. **Exit-to-Federation by design:** Identität als Schlüssel, Daten exportierbar, Atteste signiert – von Anfang an.
