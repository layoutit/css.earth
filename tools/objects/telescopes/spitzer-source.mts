/** Pin one selected native Spitzer FITS file by AORKEY through the archive's existing SHA client. */
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { archiveUrl, mosaicCompanions, SEARCH, shaSearch } from '../spitzer/archive.mts';
import { deliverSource, readSavedSource } from './archive-source.mts';

const sourceName = (row: Readonly<Record<string, string>>): string | null => {
  const path = row.externalname;
  if (!row.heritagefilename || !path || !/^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.fits$/iu.test(path) ||
      path.split('/').some(part => part === '.' || part === '..')) return null;
  return path.slice(path.lastIndexOf('/') + 1);
};

export async function fetchSpitzerSource(explorationPath: string, pick: number, outputDirectory: string,
  query: typeof shaSearch = shaSearch, fetcher: typeof fetch = fetch, companions: typeof mosaicCompanions = mosaicCompanions,
  fileName?: string) {
  const saved = await readSavedSource(explorationPath, SEARCH, pick), selected = saved.selected;
  const aorKey = requireFiniteNumber(selected.aorKey, 'Spitzer AORKEY'), targetName = requireString(selected.targetName, 'Spitzer target name');
  if (!Number.isSafeInteger(aorKey) || aorKey < 1) throw new TypeError('Saved Spitzer AORKEY is invalid.');
  const evidence = requireRecord(JSON.parse(saved.evidence.toString('utf8')), 'Spitzer discovery response');
  if (evidence.source !== SEARCH || !requireArray(evidence.rows, 'Spitzer discovery rows').some(value => {
    const row = requireRecord(value, 'Spitzer discovery row');
    return Number(row.reqkey) === aorKey && row.targetname === targetName && row.modedisplayname === selected.mode;
  })) throw new Error('The saved Spitzer source differs from its pinned discovery response. Explore again.');
  const request = { id: 'aorByRequestID', aorKey: String(aorKey) };
  const aors = await query(request, { timeoutMs: 20_000, attempts: 1 });
  if (aors.length !== 1 || Number(aors[0]!.reqkey) !== aorKey || aors[0]!.targetname !== targetName ||
      aors[0]!.modedisplayname !== selected.mode)
    throw new Error('Spitzer changed the selected AOR or its archive metadata. Explore again.');
  const products = await query({ id: 'pbcdByRequestID', aorKey: String(aorKey) }, { timeoutMs: 20_000, attempts: 1 });
  const primary = products.filter(row => sourceName(row) !== null);
  const basic = primary.length ? [] : await query({ id: 'bcdByRequestID', aorKey: String(aorKey) }, { timeoutMs: 20_000, attempts: 1 });
  const candidates = (primary.length ? primary : basic.filter(row => sourceName(row) !== null))
    .filter(row => !/_m(?:unc|cov)\.fits$/iu.test(sourceName(row) ?? ''))
    .sort((a, b) => (sourceName(a) ?? '').localeCompare(sourceName(b) ?? ''));
  const choices = candidates.map(row => sourceName(row)!);
  if (fileName !== undefined && !/^[A-Za-z0-9._-]+\.fits$/iu.test(fileName)) throw new TypeError('Invalid Spitzer --file name.');
  if (fileName === undefined && candidates.length > 1) throw new Error(`Spitzer AOR ${aorKey} lists several source FITS files. Repeat with --file NAME: ${choices.join(', ')}`);
  const matches = fileName === undefined ? candidates : candidates.filter(row => sourceName(row) === fileName);
  if (matches.length !== 1) throw new Error(`Spitzer AOR ${aorKey} has no unique source FITS file ${fileName ?? ''}. Available: ${choices.join(', ')}`);
  const file = matches[0]!;
  const name = sourceName(file)!, url = archiveUrl(requireString(file.heritagefilename, 'Spitzer archive path'));
  if (!url.endsWith(`/${name}`)) throw new Error('Spitzer file name and archive path disagree.');
  const md5 = file.checksum?.trim() || undefined;
  if (md5 !== undefined && !/^[a-f0-9]{32}$/iu.test(md5)) throw new TypeError('Spitzer archive MD5 is invalid.');
  const accompanying = name.endsWith('_maic.fits') ? await companions(url, aorKey, Number(file.channum)) : [];
  const files = [{ url, name, ...(md5 ? { md5: md5.toLowerCase() } : {}) }, ...accompanying.map(url => ({ url, name: url.slice(url.lastIndexOf('/') + 1) }))];
  return deliverSource(explorationPath, outputDirectory, saved, {
    archive: SEARCH, telescope: 'Spitzer Space Telescope', identity: `${aorKey}/${name}`, target: saved.target,
    discovery: selected, current: { aor: aors[0], product: file },
    limitations: ['The archive target name or sky position does not prove target detection.',
      'This archive FITS file is preserved as supplied; its processing level, calibration and fitness remain unresolved.'],
    files, primaryFits: name,
    ...(accompanying.length === 2 ? { fitsCompanions: {
      uncertainty: accompanying[0]!.slice(accompanying[0]!.lastIndexOf('/') + 1),
      coverage: accompanying[1]!.slice(accompanying[1]!.lastIndexOf('/') + 1),
    } } : {}),
  }, fetcher);
}
