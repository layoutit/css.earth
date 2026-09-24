/** Selected Gemini raw FITS through the existing CADC archive owner. */
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { CADC_TAP, downloadUrl, query as cadcQuery } from '../gemini/cadc.mts';
import { cadcFrame, FRAME_COLUMNS, FRAME_JOIN } from '../gemini/archive.mts';
import { deliverSource, readSavedSource } from './archive-source.mts';

const exact = (name: string, uri: string, bytes: number, md5: string, observation: string) =>
  /^[NS]\d{8}S\d{4}\.fits$/u.test(name) && uri === `gemini:GEMINI/${name}` && Number.isSafeInteger(bytes) && bytes > 0 && /^[a-f0-9]{32}$/u.test(md5) && Boolean(observation);

export async function fetchGeminiSource(explorationPath: string, pick: number, outputDirectory: string,
  query: typeof cadcQuery = cadcQuery, fetcher: typeof fetch = fetch, resume = false) {
  const saved = await readSavedSource(explorationPath, CADC_TAP, pick), selected = saved.selected;
  const name = requireString(selected.name, 'Gemini file name'), uri = requireString(selected.uri, 'Gemini artifact URI');
  const bytes = Number(selected.bytes), md5 = requireString(selected.md5, 'Gemini archive MD5');
  const observation = requireString(selected.observation, 'Gemini observation'), targetName = requireString(selected.targetName, 'Gemini archive target');
  if (!exact(name, uri, bytes, md5, observation)) throw new TypeError('Saved Gemini source identity is invalid.');
  const evidence = requireRecord(JSON.parse(saved.evidence.toString('utf8')), 'CADC discovery response');
  if (evidence.source !== CADC_TAP || !requireArray(evidence.rows, 'CADC discovery rows').some(value => {
    const row = requireRecord(value, 'CADC discovery row');
    return row.uri === uri && row.target_name === targetName && row.observationID === observation &&
      Number(row.contentLength) === bytes && String(row.contentChecksum).replace(/^md5:/u, '') === md5;
  })) throw new Error('The saved Gemini source differs from its pinned discovery response. Explore again.');
  const adql = `SELECT ${FRAME_COLUMNS} FROM ${FRAME_JOIN} WHERE o.collection='GEMINI' AND a.uri='${uri}'`;
  const rows = await query(adql);
  if (rows.length !== 1) throw new Error('CADC no longer has one exact Gemini artifact. Explore again.');
  const current = cadcFrame(rows[0]!);
  if (current.name !== name || current.uri !== uri || current.bytes !== bytes || current.md5 !== md5 ||
      current.observation !== observation || rows[0]!.target_name !== targetName ||
      rows[0]!.instrument_name !== selected.instrument || current.dataRelease !== selected.dataRelease)
    throw new Error('CADC changed the Gemini source identity or metadata. Explore again.');
  return deliverSource(explorationPath, outputDirectory, saved, {
    archive: CADC_TAP, telescope: String(selected.telescope), identity: uri, target: saved.target,
    discovery: selected, current: { query: adql, rows },
    limitations: ['Archive target names do not confirm target detection.', 'Raw Gemini FITS has not been calibrated or qualified for the requested science.'],
    files: [{ url: downloadUrl(uri), name, bytes, md5 }],
  }, fetcher, resume);
}
