/** IHW's native image indexes, including the full near-encounter clear-filter sequence. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const archive = 'https://pdssbn.astro.umd.edu/holdings/gio-c-hmc-3-rdr-halley-v1.0/';
export function parseGiottoIndex(text: string, mode: 'sdm' | 'mdm') {
  return text.trim().split(/\r?\n/u).map(line => {
    const fields = line.trim().split(/\s+/u);
    assert.equal(fields.length, mode === 'mdm' ? 11 : 8);
    const [id, w, h, n, seconds, sensor, filter, ...spf] = fields;
    const width = Number(w), height = Number(h), imageId = Number(n), timeToEncounterSeconds = Number(seconds);
    assert.match(id, /^hmc\d{5}$/u); assert.match(sensor, /^[BCDE]$/u);
    assert.match(filter, /^(CLEAR|CONT\.[12]|OH|RED|C-[23]|ORANGE|BLUE|PII|P-)$/u);
    assert.ok([width, height, imageId].every(v => Number.isSafeInteger(v) && v > 0));
    assert.ok(Number.isFinite(timeToEncounterSeconds) && spf.every(v => /^[0-5]$/u.test(v)));
    return { id, width, height, imageId, timeToEncounterSeconds, sensor, filter, superpixels: spf.map(Number), mode };
  });
}
export async function surveyGiottoIndex(directory: string, download = false) {
  await mkdir(directory, { recursive: true });
  const files = [];
  for (const [name, mode] of [['imghsigi.idx', 'sdm'], ['imghmigi.idx', 'mdm']] as const) {
    const path = resolve(directory, name), url = `${archive}index/${name}`;
    let bytes: Buffer;
    try { bytes = await readFile(path); } catch (error) {
      if (!download || !(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer()); await writeFile(path, bytes);
    }
    files.push({ name, url, bytes: bytes.length, rows: parseGiottoIndex(bytes.toString('ascii'), mode) });
  }
  const rows = files.flatMap(file => file.rows);
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'Duplicate archive image');
  const counts: Record<string, number> = {};
  for (const row of rows) { const key = `${row.mode}/${row.sensor}/${row.filter}`; counts[key] = (counts[key] ?? 0) + 1; }
  const selected = rows.filter(row => row.mode === 'mdm' && row.sensor === 'C' && row.filter === 'CLEAR');
  const frames = selected.map(row => {
    const file = (extension: string, bytes: number) => ({ file: `${row.id}.${extension}`, url: `${archive}data/mdm/sensor_c/${row.id}.${extension}`, bytes });
    return { id: row.id, imageId: row.imageId, sensor: row.sensor, filter: row.filter,
      header: file('hdr', 5760), image: file('img', Math.ceil(row.width * row.height * 2 / 2880) * 2880), label: file('lbl', 1920) };
  });
  const report = { schema: 'cssearth-halley-giotto-index-survey@1', files: files.map(({ rows: records, ...file }) => ({ ...file, records: records.length })),
    totalImages: rows.length, counts,
    selection: 'All sensor C CLEAR multi-detector images, without thinning. Other filters and earlier single-detector observations are counted, not claimed as inspected rasters.',
    selectedFrames: selected,
    limitation: 'Archive completeness and detector sampling do not establish nucleus coverage or the attitude of the Stooke shape.' };
  await writeFile(resolve(directory, 'archive-survey.json'), JSON.stringify(report, null, 2) + '\n');
  return { frames, report };
}
