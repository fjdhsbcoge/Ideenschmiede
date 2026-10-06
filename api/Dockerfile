# =============================================================================
# Ideenschmiede-API - Abbild fuer den Betrieb
# =============================================================================
# Zwei Stufen: gebaut wird mit den Abhaengigkeiten der Entwicklung, ausgeliefert
# wird nur, was zum Laufen noetig ist. Der Bauabschnitt enthaelt den
# TypeScript-Compiler, der Laufabschnitt nur die uebersetzten Dateien und die
# Laufzeitabhaengigkeiten - nicht die Werkzeuge, die niemand zur Laufzeit braucht.

FROM node:22-alpine AS build
WORKDIR /app

# Zuerst nur die Abhaengigkeitslisten: solange die sich nicht aendern, bleibt
# diese Schicht im Zwischenspeicher, auch wenn sich der Quelltext aendert.
COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# --- Laufabschnitt -----------------------------------------------------------
FROM node:22-alpine AS lauf
WORKDIR /app
ENV NODE_ENV=production

# Nur die Laufzeitabhaengigkeiten - ohne vitest, tsx und den Compiler.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Nicht als root. Der Nutzer 'node' ist im amtlichen Abbild schon vorhanden.
USER node

# Der Port ist nur eine Angabe fuer Leser. Gebunden wird an HOST:PORT aus der
# Umgebung; im Behaelter muss HOST=0.0.0.0 gesetzt sein, sonst hoert der
# Dienst nur auf der Schleife INNERHALB des Behaelters und ist von aussen
# unerreichbar - der haeufigste Fehler beim ersten Behaelterstart.
EXPOSE 3000

# Die Pruefung fragt den Dienst selbst. /health meldet auch, ob die Datenbank
# erreichbar ist; ein Behaelter, der laeuft aber nichts kann, gilt hier als
# ungesund.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
