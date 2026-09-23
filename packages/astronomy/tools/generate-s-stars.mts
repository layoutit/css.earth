#!/usr/bin/env node
/** Acquire the S-star orbits, radii and masses from their publications and write one hosted-orbit record per star. */
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { readBodyRecords, writeBodyRecord, prepareBodyRecords } from './body-records.mts';
import { gillessenOrbits, gravityOrbits, habibiStars, multiStarFitStars, parseVizierTsv, sStarRecords } from './lib/s-stars.mts';

const HOST = 'sgr-a-star';
const TABLE3 = 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv?-source=J/ApJ/837/30/table3&-out.all&-out.max=unlimited';

async function text(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} answered HTTP ${response.status}.`);
  return response.text();
}
/** The LaTeX of an arXiv e-print: every .tex file in its source archive, concatenated. */
async function arxivTex(id: string): Promise<string> {
  const response = await fetch(`https://arxiv.org/e-print/${id}`);
  if (!response.ok) throw new Error(`arXiv e-print ${id} answered HTTP ${response.status}.`);
  const directory = await mkdtemp(join(tmpdir(), `arxiv-${id}-`));
  try {
    await writeFile(join(directory, 'source.tgz'), Buffer.from(await response.arrayBuffer()));
    await promisify(execFile)('tar', ['-xzf', 'source.tgz'], { cwd: directory });
    const files = (await readdir(directory)).filter(name => name.endsWith('.tex')).sort();
    if (!files.length) throw new Error(`arXiv e-print ${id} holds no .tex file.`);
    return (await Promise.all(files.map(name => readFile(join(directory, name), 'utf8')))).join('\n');
  } finally { await rm(directory, { recursive: true, force: true }); }
}

const records = await readBodyRecords(), host = records.find(record => record.id === HOST), sun = records.find(record => record.id === 'sun');
if (!host?.star || !sun) throw new Error(`The ${HOST} and sun records are required.`);
const [table3, gillessenTex, gravityTex, habibiTex] = await Promise.all([text(TABLE3), arxivTex('1611.09144'), arxivTex('2112.07478'), arxivTex('1708.06353')]);
const orders = Object.fromEntries(records.filter(record => record.physical.parent === HOST && record.order !== undefined).map(record => [record.id, record.order!]));
const { records: stars, skipped } = sStarRecords({
  host: { id: HOST, distanceParsecs: host.star.distanceParsecs, radiusKm: host.physical.meanRadiusKm,
    massSolar: host.physical.gravitationalParameterKm3PerS2 / sun.physical.gravitationalParameterKm3PerS2 },
  solarGm: sun.physical.gravitationalParameterKm3PerS2,
  gillessen: gillessenOrbits(parseVizierTsv(table3)), multiStarFit: multiStarFitStars(gillessenTex),
  gravity: gravityOrbits(gravityTex), habibi: habibiStars(habibiTex),
  orders, firstOrder: Math.max(host.order ?? 0, ...Object.values(orders)) + 1 });
for (const record of stars) await writeBodyRecord(record);
await prepareBodyRecords();
console.log(`${stars.length} S-star records written; ${stars.filter(record => (record.hostedOrbit as { weaklyConstrained?: true }).weaklyConstrained).length} weakly constrained.`);
for (const { star, reason } of skipped) console.log(`${star} skipped: ${reason}`);
