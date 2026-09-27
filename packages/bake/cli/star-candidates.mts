#!/usr/bin/env node
/** Before reconstructing anything, find what the literature already published for a resolved-star candidate. The search
 * and its verdict are `starCandidates` in `@cssearth/bake/objects/candidates`.
 *
 *   node packages/bake/cli/star-candidates.mts "<SIMBAD identifier>" [--radius-arcsec 30] [--json]
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { starCandidates } from '@cssearth/bake/objects/candidates';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), radiusIndex = args.indexOf('--radius-arcsec');
  const identifier = args.find((argument, index) => !argument.startsWith('--') && (radiusIndex < 0 || index !== radiusIndex + 1));
  if (!identifier) throw new TypeError('Usage: star-candidates "<SIMBAD identifier>" [--radius-arcsec 30] [--json]');
  const result = await starCandidates(identifier, radiusIndex >= 0 ? Number(args[radiusIndex + 1]) : 30);
  if (args.includes('--json')) { console.log(JSON.stringify(result, null, 2)); process.exit(0); }
  const { star } = result;
  console.log(`${star.mainId}: RA ${star.rightAscensionDegrees.toFixed(5)}, Dec ${star.declinationDegrees.toFixed(5)}, parallax ${star.parallaxMas ?? 'none'} mas, ${star.spectralType ?? 'no spectral type'}; ${result.references} SIMBAD references`);
  console.log('\nOiDB granules (instrument, calibration level, data PI, bibcode, granules, MJD range):');
  for (const group of result.oidb) console.log(`  ${group.instrument}  level ${group.calibrationLevel}  ${group.dataPi || '-'}  ${group.bibcode ?? '-'}  ${group.granules}  ${group.firstMjd.toFixed(0)}-${group.lastMjd.toFixed(0)}`);
  const deposits = result.catalogues.filter(catalogue => catalogue.imageLines.length && catalogue.aboutStar);
  console.log(`\nVizieR: ${result.catalogues.length} catalogues from those references, ${deposits.length} with FITS images of this star:`);
  for (const catalogue of deposits) console.log(`  ${catalogue.name}  ${catalogue.title} (${catalogue.bibcode})${catalogue.interferometric ? '  interferometric' : '  not interferometric: context, not a surface'}\n    ${catalogue.imageLines.join(' | ')}`);
  const largest = result.diameters.largestMas;
  console.log(`\nMeasured diameter (JMDC): ${largest === null ? 'none catalogued, so no archive resolution is set against a disc' : `${largest} mas, largest of ${result.diameters.measurements.length} measurements`}`);
  console.log(`\nArchive leads (ALMA, ESO, MAST, DataCite): ${result.leads.length ? '' : 'none'}`);
  for (const lead of result.leads) console.log(`  ${lead}`);
  console.log(`\nVerdict: ${result.verdict.route}: ${result.verdict.reason}.`);
}
