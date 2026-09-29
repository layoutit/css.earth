/** Selected Gemini raw FITS through the existing CADC archive owner. */
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { CADC_TAP, downloadUrl, query as cadcQuery } from './archives/gemini/cadc.mts';
import { cadcFrame, FRAME_COLUMNS, FRAME_JOIN } from './archives/gemini/archive.mts';
import { deliverSource, readSavedSource } from './archive-source.mts';

const exact = (name: string, uri: string, bytes: number, observation: string) =>
  /^[NS]\d{8}S\d{4}\.fits$/u.test(name) && uri === `gemini:GEMINI/${name}` && Number.isSafeInteger(bytes) && bytes > 0 && Boolean(observation);

export async function fetchGeminiSource(explorationPath: string, pick: number, outputDirectory: string,
  query: typeof cadcQuery = cadcQuery, fetcher: typeof fetch = fetch, resume = false) {
  const saved = await readSavedSource(explorationPath, CADC_TAP, pick), selected = saved.selected;
  const name = requireString(selected.name, 'Gemini file name'), uri = requireString(selected.uri, 'Gemini artifact URI');
  const bytes = Number(selected.bytes);
  const observation = requireString(selected.observation, 'Gemini observation'), targetName = requireString(selected.targetName, 'Gemini archive target');
  if (!exact(name, uri, bytes, observation)) throw new TypeError(`Saved Gemini source ${name} (${uri}, ${bytes} bytes, observation ${observation}) has an invalid identity.`);
  const evidence = requireRecord(JSON.parse(saved.evidence.toString('utf8')), 'CADC discovery response');
  if (evidence.source !== CADC_TAP || !requireArray(evidence.rows, 'CADC discovery rows').some(value => {
    const row = requireRecord(value, 'CADC discovery row');
    return row.uri === uri && row.target_name === targetName && row.observationID === observation &&
      Number(row.contentLength) === bytes;
  })) throw new Error(`The saved Gemini source ${uri} is not in its discovery response. Explore again.`);
  const adql = `SELECT ${FRAME_COLUMNS} FROM ${FRAME_JOIN} WHERE o.collection='GEMINI' AND a.uri='${uri}'`;
  const rows = await query(adql);
  if (rows.length !== 1) throw new Error('CADC no longer has one exact Gemini artifact. Explore again.');
  const current = cadcFrame(rows[0]!);
  if (current.name !== name || current.uri !== uri || current.bytes !== bytes ||
      current.observation !== observation || rows[0]!.target_name !== targetName ||
      rows[0]!.instrument_name !== selected.instrument || current.dataRelease !== selected.dataRelease)
    throw new Error('CADC changed the Gemini source identity or metadata. Explore again.');
  return deliverSource(explorationPath, outputDirectory, saved, {
    archive: CADC_TAP, telescope: String(selected.telescope), identity: uri, target: saved.target,
    discovery: selected, current: { query: adql, rows },
    limitations: ['Archive target names do not confirm target detection.', 'Raw Gemini FITS has not been calibrated or qualified for the requested science.'],
    files: [{ url: downloadUrl(uri), name, bytes }],
  }, fetcher, resume);
}
