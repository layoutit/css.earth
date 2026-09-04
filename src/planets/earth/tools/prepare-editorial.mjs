#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validatePlanetInformationSnapshot } from "../../../../tools/planet-information-sources.mjs";

const sourcePath = resolve(import.meta.dirname, "../source/editorial/nasa-earth-record.json");
const outputPath = resolve(import.meta.dirname, "../../../../data/planets/earth.json");
const record = JSON.parse(await readFile(sourcePath, "utf8"));
if (record.id !== 48583 || record.title?.rendered !== "Facts About Earth" ||
    record.link !== "https://science.nasa.gov/earth/facts/" ||
    typeof record.modified !== "string") {
  throw new Error("NASA Earth editorial record identity drifted.");
}

const selected = new Set([
  "Namesake",
  "Potential for Life",
  "Size and Distance",
  "Orbit and Rotation",
  "Moons",
  "Rings",
  "Formation",
  "Structure",
  "Surface",
  "Atmosphere",
  "Magnetosphere",
]);
const entries = [];
for (const match of record.content.rendered.matchAll(/<(h2|p)\b[^>]*>([\s\S]*?)<\/\1>/giu)) {
  const text = clean(match[2]);
  if (text) entries.push({ tag: match[1].toLowerCase(), text });
}
const firstHeading = entries.findIndex(({ tag, text }) => tag === "h2" && text === "Namesake");
if (firstHeading < 2) throw new Error("NASA Earth introduction shape drifted.");
const introductionParagraphs = entries.slice(0, firstHeading)
  .filter(({ tag }) => tag === "p")
  .map(({ text }) => text);
const sections = [{ heading: "Introduction", paragraphs: introductionParagraphs }];
let current = null;
for (const entry of entries.slice(firstHeading)) {
  if (entry.tag === "h2") {
    current = selected.has(entry.text)
      ? { heading: entry.text, paragraphs: [] }
      : null;
    if (current) sections.push(current);
    continue;
  }
  if (current) current.paragraphs.push(entry.text);
}
if (sections.length !== 12 || sections.some(({ paragraphs }) => paragraphs.length === 0)) {
  throw new Error(`NASA Earth selected editorial sections drifted: ${sections.length}.`);
}
const snapshot = {
  schemaVersion: 1,
  id: "earth",
  planet: "Earth",
  title: "Facts About Earth",
  introduction: introductionParagraphs[0],
  sections,
  sourceUrl: record.link,
  sourceId: record.id,
  modified: record.modified,
  retrievedAt: "2026-08-30",
  credit: "NASA Science",
  recordApiUrl: "https://science.nasa.gov/wp-json/wp/v2/topic/48583",
  blocksApiUrl: "https://science.nasa.gov/wp-json/vip-block-data-api/v1/posts/48583/blocks",
};
validatePlanetInformationSnapshot(snapshot);
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Prepared NASA Science Earth information -> ${outputPath}`);

function clean(value) {
  return value
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/<[^>]+>/gu, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, decodeEntity)
    .replace(/\u00a0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function decodeEntity(entity, name) {
  const lower = name.toLowerCase();
  if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
  if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
  return ({ amp: "&", apos: "'", gt: ">", hellip: "…", ldquo: "“", lsquo: "‘", lt: "<", mdash: "—", nbsp: " ", ndash: "–", quot: '"', rdquo: "”", rsquo: "’" })[lower] ?? entity;
}
