import { readBodyRecords, writeBodyRecord, prepareBodyRecords } from './body-records.mts';
import { elementsUrl, vectorsUrl, horizons, parseElements, parseVectors } from './lib/horizons.mts';

/** Acquire one-epoch elements and independent vector samples for selected bodies. */
export async function generateHeliocentric(model: 'asteroid' | 'comet', args = process.argv.slice(2)) {
  const formatOnly = args.includes('--format-only');
  const selected = new Set(args.filter(arg => arg !== '--format-only').flatMap(arg => {
    if (!/^--object=[a-z][a-z0-9-]*(?:,[a-z][a-z0-9-]*)*$/.test(arg)) throw new Error('Use --object=id[,id].');
    return arg.slice(9).split(',');
  }));
  if (formatOnly && selected.size) throw new Error('--format-only cannot select or fetch bodies.');
  const bodies = (await readBodyRecords()).filter(record => record.acquisition?.heliocentric?.model === model);
  for (const id of selected) if (!bodies.some(body => body.id === id)) throw new Error(`Unknown ${model}: ${id}.`);
  const epochJdTt = 2461286.5;
  for (const record of bodies.filter(body => !formatOnly && (!selected.size || selected.has(body.id)))) {
    const id = record.id, command = record.acquisition?.heliocentric?.target;
    if (!command) throw new TypeError(`Missing acquisition target: ${id}.`);
    const query = elementsUrl({ command, center: '500@10', startJd: epochJdTt, stopJd: epochJdTt + 1, stepDays: 1 });
    const row = parseElements(await horizons(query, `${model}-elements-${id}`), id)[0];
    const rad = Math.PI / 180;
    record[model] = { query, elements: { epochJdTt,
      semiMajorAxisKm: row.semiMajorAxisKm, eccentricity: row.eccentricity,
      inclinationRad: row.inclinationDeg * rad, ascendingNodeRad: row.nodeDeg * rad,
      argumentOfPeriapsisRad: row.periapsisDeg * rad, meanAnomalyAtEpochRad: row.meanAnomalyDeg * rad,
      meanMotionRadPerDay: row.meanMotionDegPerDay * rad } };
    const vectorQuery = vectorsUrl({ command, center: '500@10', epochsJdTdb: [epochJdTt - 30, epochJdTt, epochJdTt + 30], outUnits: 'KM-D' });
    record[`${model}Fixture`] = { query: vectorQuery, rows: parseVectors(await horizons(vectorQuery, `${model}-vectors-${id}`), id) };
    await writeBodyRecord(record);
  }
  await prepareBodyRecords();
}
