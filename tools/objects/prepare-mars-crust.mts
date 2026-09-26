/** Reorder the deposited Figure 2 node grid into the existing Tecplot map format; no inversion or new model.
 * node tools/objects/prepare-mars-crust.mts <Mars-thick-Khan2022-39-2900-2900.dat> <output.dat>
 * Archive Readme.txt: 721 north-to-south rows, 1441 east-longitude columns, 0.25 degrees, kilometres. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function convertCrustGrid(text: string) {
  const rows = text.trim().split(/\r?\n/u).map(row => row.trim().split(/\s+/u).map(Number));
  if (rows.length !== 721 || rows.some(row => row.length !== 1441 || row.some(value => !Number.isFinite(value) || value < 0))) {
    throw new Error('Expected the published 721 by 1441 crust thickness grid in kilometres.');
  }
  for (const row of rows) if (Math.abs(row[0]! - row[1440]!) > 1e-6) throw new Error('Crust grid seam differs.');
  const lines = ['VARIABLES = "Longitude" "Latitude" "Thickness (km)"', 'ZONE I=1441, J=721', 'DATAPACKING=POINT'];
  let minimum = Infinity, maximum = -Infinity;
  for (let y = 0; y < 721; y++) for (let x = 0; x < 1441; x++) {
    const value = rows[720 - y]![x]!;
    minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
    lines.push(`${x / 4} ${-90 + y / 4} ${value}`);
  }
  return { text: lines.join('\n') + '\n', minimum, maximum };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: prepare-mars-crust.mts <published-grid.dat> <output.dat>');
  const result = convertCrustGrid(await readFile(input, 'utf8'));
  await writeFile(output, result.text);
  console.log(JSON.stringify({ minimumKm: result.minimum, maximumKm: result.maximum, columns: 1441, rows: 721 }));
}
