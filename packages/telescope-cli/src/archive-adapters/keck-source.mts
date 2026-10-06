/** Retrieve one saved KOA lead as pinned, uncalibrated native source bytes. */
import { lstat, mkdir, mkdtemp, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { writeProductRecord, parseLimits } from '@cssearth/telescope/node';
import { VERSION } from '../help.mts';
import { INSTRUMENT_TABLES, koaDownload, koaQuery, lev0Url, TAP_SYNC } from '../archives/keck/koa.mts';
import { EXPLORATION_SCHEMA } from '../exploration.mts';
import { FITS_SOURCE_SCHEMA } from './fits-source.mts';
import type { KeckSourceLead } from './archive-leads.mts';

const limitations = [
  'KOA identifies this as a public object frame; its free-form target name does not prove the intended target was detected.',
  'This is a raw Keck source file. Acquisition verifies origin and bytes, not calibration, units, WCS or scientific fitness.',
];
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const filehand = (value: string) => /^\/[A-Za-z0-9._/-]+\.fits$/u.test(value) && !value.includes('..');

function savedLead(value: unknown): KeckSourceLead {
  const row = requireRecord(value, 'saved Keck source');
  const table = requireString(row.table, 'KOA table'), instrument = requireString(row.instrument, 'KOA instrument');
  const koaid = requireString(row.koaid, 'KOA file id'), targetName = requireString(row.targetName, 'KOA target name');
  const handle = requireString(row.filehand, 'KOA filehand'), dateObs = requireString(row.dateObs, 'KOA date');
  const evidence = requireString(row.evidence, 'KOA discovery evidence name');
  if (!(INSTRUMENT_TABLES as readonly string[]).includes(table) || instrument !== table.slice(4).toUpperCase() ||
      !/^[A-Za-z0-9._-]+\.fits$/u.test(koaid) || basename(handle) !== koaid || !filehand(handle) ||
      !/^[A-Za-z0-9._-]+$/u.test(evidence)) throw new TypeError(`Saved Keck source ${koaid} (${table}) has an invalid identity or evidence name ${evidence}.`);
  return { table, instrument, koaid, targetName, filehand: handle, dateObs, evidence };
}

export async function fetchKeckSource(explorationPath: string, pick: number, outputDirectory: string,
  query: typeof koaQuery = koaQuery, download: typeof koaDownload = koaDownload) {
  if (!Number.isSafeInteger(pick) || pick < 1) throw new TypeError('--pick must be a positive Keck source number.');
  const explorationBytes = await readFile(explorationPath), session = requireRecord(JSON.parse(explorationBytes.toString('utf8')), 'saved exploration');
  if (session.schema !== EXPLORATION_SCHEMA) throw new TypeError('Expected a saved Telescope exploration.');
  const answer = requireRecord(session.answer, 'saved exploration answer'), request = requireRecord(answer.request, 'saved request');
  const target = requireString(session.target, 'saved target');
  if (target !== answer.target || request.target !== target) throw new TypeError('Saved exploration target identity disagrees.');
  const services = requireArray(answer.services, 'saved services');
  const keck = services.map(service => requireRecord(service, 'saved service')).filter(service => service.service === TAP_SYNC);
  if (keck.length !== 1) throw new TypeError('Saved exploration has no unique KOA service.');
  const sources = requireArray(keck[0]!.sources, 'saved Keck sources').map(savedLead);
  if (pick > sources.length) throw new TypeError(`--pick must be between 1 and ${sources.length}.`);
  const selected = sources[pick - 1]!;
  const evidenceFile = resolve(dirname(explorationPath), 'archive-source-evidence', `${selected.evidence}.json`);
  const evidenceBytes = await readFile(evidenceFile).catch(() => readFile(resolve(dirname(explorationPath), 'keck-source-evidence', `${selected.evidence}.json`)));
  const evidence = requireRecord(JSON.parse(evidenceBytes.toString('utf8')), 'saved KOA response');
  if (evidence.source !== TAP_SYNC ||
      !requireArray(evidence.rows, 'saved KOA rows').some(value => {
        const row = requireRecord(value, 'saved KOA row');
        return row.koaid === selected.koaid && row.targname === selected.targetName && row.koaimtyp === 'object' &&
          row.filehand === selected.filehand && row.date_obs === selected.dateObs;
      })) throw new Error(`The saved KOA source ${selected.koaid} is not in its discovery response ${selected.evidence}. Explore again.`);
  const adql = `SELECT koaid,targname,koaimtyp,filehand,date_obs FROM ${selected.table} WHERE koaid=${quote(selected.koaid)}`;
  const rows = await query(adql);
  if (rows.length !== 1) throw new Error('KOA no longer has one public row for this exact source. Explore again.');
  const current = rows[0]!;
  if (current.koaid !== selected.koaid || current.targname !== selected.targetName || current.koaimtyp !== 'object' ||
      current.filehand !== selected.filehand || current.date_obs !== selected.dateObs)
    throw new Error('KOA changed this source identity or metadata. Explore again.');
  const maximum = parseLimits(request.transferLimits).scienceBytes, destination = resolve(outputDirectory);
  try { await lstat(destination); throw new TypeError('Output directory already exists; choose a new --out directory.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  await mkdir(dirname(destination), { recursive: true });
  const staging = await mkdtemp(resolve(dirname(destination), '.keck-source-'));
  try {
    const source = resolve(staging, selected.koaid), url = lev0Url(selected.filehand);
    const pin = await download(url, source, undefined, maximum);
    if (pin.bytes > maximum) throw new RangeError('KOA file exceeds the transfer bound.');
    const actual = (await stat(source)).size;
    if (actual !== pin.bytes) throw new Error(`Downloaded KOA file ${selected.koaid} is ${actual} bytes; the transfer reported ${pin.bytes}.`);
    const handle = await open(source, 'r');
    let prefix: string;
    try { const header = Buffer.alloc(80); await handle.read(header, 0, 80, 0); prefix = header.toString('ascii'); }
    finally { await handle.close(); }
    if (!prefix.startsWith('SIMPLE  =')) throw new TypeError('KOA returned a file without a FITS primary header.');
    const metadata = Buffer.from(`${JSON.stringify({ service: TAP_SYNC, query: adql, rows }, null, 2)}\n`);
    const report = { schema: 'cssearth-keck-source@1', status: 'unresolved', target, selected,
      acquisition: { url, bytes: pin.bytes, limitBytes: maximum }, limitations };
    await writeFile(resolve(staging, 'explore.json'), explorationBytes);
    await writeFile(resolve(staging, 'discovery.json'), evidenceBytes);
    await writeFile(resolve(staging, 'current-metadata.json'), metadata);
    await writeFile(resolve(staging, 'source.json'), `${JSON.stringify(report, null, 2)}\n`);
    await writeProductRecord(resolve(staging, 'output.product.json'), {
      telescope: 'Keck Observatory Archive', stage: 'telescope-keck-source',
      inputs: [{ role: 'saved exploration', identity: resolve(explorationPath), bytes: explorationBytes.length },
        { role: 'KOA discovery response', identity: `${TAP_SYNC}#${selected.evidence}`, bytes: evidenceBytes.length },
        { role: 'KOA current exact-file response', identity: TAP_SYNC, bytes: metadata.length },
        { role: 'KOA raw FITS', identity: url, bytes: pin.bytes }],
      parameters: { target, koaid: selected.koaid, instrument: selected.instrument, status: 'unresolved', limitations,
        fitsSource: { schema: FITS_SOURCE_SCHEMA, path: selected.koaid, label: selected.koaid, limitations } },
      software: [{ name: 'cssEarth Telescope Keck source', version: VERSION }, { name: 'PyVO', version: '1.9.1' }],
    }, [{ path: selected.koaid, file: source }, ...['explore.json', 'discovery.json', 'current-metadata.json', 'source.json']
      .map(path => ({ path, file: resolve(staging, path) }))]);
    await rename(staging, destination);
    return { file: resolve(destination, selected.koaid), receipt: resolve(destination, 'output.product.json'), source: resolve(destination, 'source.json'), status: 'unresolved' as const };
  } finally { await rm(staging, { recursive: true, force: true }); }
}
