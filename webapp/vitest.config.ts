/**
 * Pruefwerkzeug des Frontends.
 *
 * Warum eine eigene Datei: die Pruefungen laufen mit jsdom und brauchen den
 * Pfadalias '@', den vite.config.ts setzt. Eine zweite Konfiguration waere
 * eine zweite Wahrheit ueber denselben Alias - deshalb wird sie hier aus
 * derselben Quelle gesetzt.
 *
 * environment 'node' und NICHT 'jsdom': die Datenschicht liest weder window
 * noch document, und jsdom kostet beim Start ein Vielfaches - gemessen 30
 * Sekunden fuer 18 Pruefungen, davon 99 Prozent Aufbau der Umgebung. Wer
 * spaeter Seiten rendern will, setzt jsdom in GENAU der Datei, die es
 * braucht (// @vitest-environment jsdom), statt es allen aufzuzwingen.
 */
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
