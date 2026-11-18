#!/usr/bin/env node
/**
 * Събира събитията от всички източници → data/events.json
 *
 *   node scripts/build-events.mjs
 *
 * Пуска се автоматично всеки ден от GitHub Actions (.github/workflows/update-events.yml).
 * Ако events.json се промени, GitHub Action-ът го commit-ва и Netlify публикува наново.
 *
 * Всеки източник е отделен файл в scripts/sources/ и връща масив от „сурови“ събития.
 * Тук те се уеднаквяват, премахват се дубликати и стари събития.
 */
import { writeFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { normalize, dedupe } from "./lib/normalize.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "events.json");
const KEEP_AFTER_END_DAYS = 7;

const sourcesDir = path.join(ROOT, "scripts", "sources");
const files = (await readdir(sourcesDir)).filter((f) => f.endsWith(".mjs")).sort();

const all = [];
for (const file of files) {
  const mod = await import(pathToFileURL(path.join(sourcesDir, file)).href);
  if (mod.enabled === false) { console.log(`⏭  ${file} (изключен)`); continue; }
  try {
    const raw = await mod.default();
    const ok = raw.map((r) => normalize(r, mod.sourceName || file)).filter(Boolean);
    console.log(`✓  ${file}: ${ok.length} събития`);
    all.push(...ok);
  } catch (e) {
    // Един счупен източник не трябва да спира останалите
    console.warn(`✗  ${file}: ${e.message}`);
  }
}

const cutoff = Date.now() - KEEP_AFTER_END_DAYS * 86400000;
const events = dedupe(all)
  .filter((e) => new Date(e.end).getTime() >= cutoff)
  .sort((a, b) => a.start.localeCompare(b.start));

const out = {
  generatedAt: new Date().toISOString(),
  demo: events.some((e) => e.demo),
  count: events.length,
  events,
};
await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`\n→ data/events.json: ${events.length} събития`);
