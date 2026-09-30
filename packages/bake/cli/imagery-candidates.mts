#!/usr/bin/env node
/** Before wiring or re-registering a photograph dataset, find whether a public archive holds finer frames than the body ships.
 * The searches and verdicts are `imageryCandidates` and `archiveCandidates` in `@cssearth/bake/objects/candidates`.
 *
 *   node packages/bake/cli/imagery-candidates.mts [<object-id> ...] [--minimum-pixels 50] [--json]
 *   node packages/bake/cli/imagery-candidates.mts --archives <object-id> ... [--json]
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { archiveCandidates, imageryCandidates } from '@cssearth/bake/objects/candidates';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href && process.argv.includes('--archives')) {
  const results = await archiveCandidates(process.argv.slice(2).filter(argument => !argument.startsWith('--')));
  if (process.argv.includes('--json')) { console.log(JSON.stringify(results, null, 2)); process.exit(0); }
  for (const result of results) {
    console.log(`${result.id}: searched as ${result.names.map(name => `"${name}"`).join(', ')}; ${result.citedDois.length} cited DOIs checked for deposits`);
    for (const group of result.archives.alma) console.log(`  ALMA targets matched in ${group.proposal}: ${group.targets.join(', ')}`);
    for (const lead of result.leads) console.log(`  ${lead}`);
    if (!result.leads.length) console.log('  no archive leads');
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), minimumIndex = args.indexOf('--minimum-pixels');
  const ids = args.filter((argument, index) => !argument.startsWith('--') && (minimumIndex < 0 || index !== minimumIndex + 1));
  const { results, skipped } = await imageryCandidates(ids, { minimumPixels: minimumIndex >= 0 ? Number(args[minimumIndex + 1]) : 50 });
  if (args.includes('--json')) { console.log(JSON.stringify({ results, skipped }, null, 2)); process.exit(0); }
  const km = (value: number | null | undefined) => value === null || value === undefined ? '—' : value < 1 ? `${(value * 1000).toFixed(0)} m` : `${value.toFixed(2)} km`;
  for (const result of results) {
    const shipped = result.verdict === 'shipped-unknown' ? 'unknown (no surfaces report, or imagery without a stated scale)'
      : result.shipped?.meters ? `${km(result.shipped.meters / 1000)} (${result.shipped.kind} ${result.shipped.dataset})` : 'no imagery dataset';
    const best = result.opusBest ? `${km(result.opusBest.centerKmPerPixel)} ${result.opusBest.instrument} ${result.opusBest.opusId}${result.opusBest.phaseDegrees === null ? '' : ` at ${result.opusBest.phaseDegrees.toFixed(0)}°`}` : '—';
    console.log(`${result.verdict.padEnd(12)} ${result.id.padEnd(12)} shipped ${shipped}; OPUS best ${best}; ${result.pixelsAcross === null ? '' : `diameter ${result.pixelsAcross.toFixed(0)} px; `}${result.factor === null ? '' : `${result.factor.toFixed(1)}× finer; `}${result.opusImages} images`);
  }
  if (skipped.length) console.log(`skipped (no mean radius in packages/astronomy/data/bodies): ${skipped.join(', ')}`);
}
