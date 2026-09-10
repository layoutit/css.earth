import { readFile } from 'node:fs/promises';
import { requireRecord, requireArray, requireString, requireFiniteNumber } from '../../source-values.mts';
export async function readIntake(path = 'output/celestia-comets/intake.json') {
  return requireArray(JSON.parse(await readFile(path, 'utf8'))).map(value => {
    const row = requireRecord(value, 'Comet intake');
    return {...row, record:row.record, fixture:row.fixture, id:requireString(row.id), designation:requireString(row.designation), name:requireString(row.name),
      mesh:requireString(row.mesh), excerpt:requireString(row.excerpt), command:requireString(row.command),
      radiusKm:requireFiniteNumber(row.radiusKm), distanceAu:requireFiniteNumber(row.distanceAu), perihelionAu:requireFiniteNumber(row.perihelionAu)};
  });
}
