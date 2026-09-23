/** Pin one selected Chandra archive event file without claiming a reprocessed observation. */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { cxcQuery, chandraObservation, obsidDirectory, TAP } from '../chandra/archive.mts';
import { deliverSource, rawHttpsFetch, readSavedSource } from './archive-source.mts';

export async function fetchChandraSource(explorationPath: string, pick: number, outputDirectory: string,
  query: typeof cxcQuery = cxcQuery, observe: typeof chandraObservation = chandraObservation, fetcher: typeof fetch = rawHttpsFetch,
  fileName?: string) {
  const saved = await readSavedSource(explorationPath, TAP, pick), selected = saved.selected;
  const obsid = requireFiniteNumber(selected.obsid, 'Chandra ObsID'), targetName = requireString(selected.targetName, 'archive target');
  if (!Number.isSafeInteger(obsid) || obsid < 1) throw new TypeError('Saved Chandra ObsID is invalid.');
  const evidence = requireRecord(JSON.parse(saved.evidence.toString('utf8')), 'Chandra discovery response');
  if (evidence.source !== TAP || !requireArray(evidence.rows, 'Chandra discovery rows').some(value => {
    const row = requireRecord(value, 'Chandra discovery row');
    return row.obsid === obsid && row.targetName === targetName && row.instrument === selected.instrument &&
      row.grating === selected.grating && row.startDate === selected.startDate;
  })) throw new Error('The saved Chandra source differs from its pinned discovery response. Explore again.');
  const adql = `SELECT obsid,target_name,instrument,grating,start_date,status FROM cxc.observation WHERE obsid=${obsid}`;
  const rows = await query(adql);
  if (rows.length !== 1 || rows[0]!.status !== 'archived' || Number(rows[0]!.obsid) !== obsid ||
      rows[0]!.target_name !== targetName || rows[0]!.instrument !== selected.instrument ||
      rows[0]!.grating !== selected.grating || rows[0]!.start_date !== selected.startDate)
    throw new Error('Chandra changed the selected ObsID or its archive metadata. Explore again.');
  const observation = await observe(obsid);
  if (observation.obsid !== obsid || observation.targetName !== targetName || observation.instrument !== selected.instrument ||
      observation.grating !== selected.grating) throw new Error('Chandra event headers disagree with the selected ObsID.');
  const events = observation.products.filter(file => /_evt2\.fits(?:\.gz)?$/u.test(file.path));
  const choices = events.map(file => file.path.slice(file.path.lastIndexOf('/') + 1));
  if (fileName !== undefined && !/^[A-Za-z0-9._-]+\.fits(?:\.gz)?$/u.test(fileName)) throw new TypeError('Invalid Chandra --file name.');
  if (fileName === undefined && events.length > 1) throw new Error(`Chandra lists several level-2 event files. Repeat with --file NAME: ${choices.join(', ')}`);
  const matches = fileName === undefined ? events : events.filter(file => file.path.endsWith(`/${fileName}`));
  if (matches.length !== 1) throw new Error(`Chandra has no unique level-2 event file ${fileName ?? ''}. Available: ${choices.join(', ')}`);
  const event = matches[0];
  if (!event || !/^primary\/[A-Za-z0-9._-]+\.fits(?:\.gz)?$/u.test(event.path) && !/^secondary\/[A-Za-z0-9._-]+\.fits(?:\.gz)?$/u.test(event.path) ||
      event.url !== `${obsidDirectory(obsid)}/${event.path}` || !Number.isSafeInteger(event.bytes) || event.bytes < 1)
    throw new Error('Chandra lists no valid exact level-2 event source for this ObsID.');
  const name = event.path.slice(event.path.lastIndexOf('/') + 1);
  return deliverSource(explorationPath, outputDirectory, saved, {
    archive: TAP, telescope: 'Chandra', identity: String(obsid), target: saved.target,
    discovery: selected, current: { query: adql, rows, observation },
    limitations: ['The archive target name or sky position does not prove target detection.',
      'The original level-2 event list is preserved; no independent reprocessing or fitness qualification is claimed.'],
    files: [{ url: event.url, name, bytes: event.bytes, ...(/\.gz$/u.test(name) ? { archiveEncoding: 'gzip' as const } : {}) }],
  }, fetcher);
}
