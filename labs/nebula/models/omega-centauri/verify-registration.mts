/** Standalone real-registration check between eso1119b (reference) and eso0844a, bypassing the
 * prepare-observations CLI (whose dependency graph currently pulls in an unrelated JWST toolchain
 * module that throws on import when bundled). Reuses the exact shared detectStars/matchStars/
 * verifyRegistration algorithm; invents no matching logic of its own. Read-only: writes one receipt. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  detectStars, matchStars, verifyRegistration, publisherTransform,
  type SkyRaster, type SkyFrame,
} from '../../packages/reconstruction/src/registration/stellar.ts';

const root = process.cwd();
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

const frame: SkyFrame = { width: 1024, height: 1024, fieldArcminutes: [55, 55], centerIcrsDegrees: [201.696958, -47.479539], northUp: true };

const reference: SkyRaster & { path: string; sha256: string } = {
  path: '.local/nebula-lab/source-originals/eso1119b.tif', sha256: '8df2e2ad462b9dc5b7437320fb2c6fd247c11746b4b2ffd3da95846b9083cad6',
  width: 14540, height: 14540, fieldArcminutes: [50.88, 50.88], centerIcrsDegrees: [201.69695833333333, -47.47953888888889],
  northRightDegrees: 0,
  wcs: {
    projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [14540, 14540], referencePixel: [7270, 7270],
    referenceValueDeg: [201.69695833333333, -47.47953888888889], scaleDeg: [-5.832187070151307e-5, 5.832187070151307e-5], rotationDeg: 0,
  } as any,
};
const source: SkyRaster & { path: string; sha256: string } = {
  path: '.local/nebula-lab/source-originals/eso0844a.tif', sha256: '384d1cfc31e6a2b78e5c7018f9eaecfe49a1014630bcb1bd8dceb563d69e6429',
  width: 8040, height: 7560, fieldArcminutes: [31.88, 29.99], centerIcrsDegrees: [201.69716666666667, -47.479683333333334],
  northRightDegrees: 0,
  wcs: {
    projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [8040, 7560], referencePixel: [4020, 3780],
    referenceValueDeg: [201.69716666666667, -47.479683333333334], scaleDeg: [-6.608623548922056e-5, 6.611552028218695e-5], rotationDeg: 0,
  } as any,
};

async function loadBytes(row: { path: string; sha256: string }): Promise<Buffer> {
  const bytes = await readFile(resolve(root, row.path));
  if (sha256(bytes) !== row.sha256) throw new Error(`Source pin differs: ${row.path}`);
  return bytes;
}

console.log('Reading native rasters (this may take a while for 14540x14540)...');
const [referenceBytes, sourceBytes] = await Promise.all([loadBytes(reference), loadBytes(source)]);

console.log('Detecting stars (reference)...');
const referenceStars = await detectStars(referenceBytes, [reference.width, reference.height], 8000, 12000);
console.log(`Reference stars: ${referenceStars.length}`);

console.log('Detecting stars (source)...');
const sourceStars = await detectStars(sourceBytes, [source.width, source.height], 8000, 12000);
console.log(`Source stars: ${sourceStars.length}`);

const referenceInitial = publisherTransform(reference, frame);
const sourceInitial = publisherTransform(source, frame);

const pairs = matchStars(sourceStars, referenceStars, sourceInitial, referenceInitial);
console.log(`Matched pairs (pre-verify): ${pairs.length}`);

const result = verifyRegistration(pairs, source, frame, sourceInitial, { width: reference.width, height: reference.height, imageToFrame: referenceInitial });
console.log(JSON.stringify({ pass: result.pass, ...result.evidence, matches: undefined }, null, 2));

const receipt = {
  schema: 'cssearth-nebula-intake-registration-evidence@1', objectId: 'omega-centauri', checkedAt: new Date().toISOString().slice(0, 10),
  method: 'Direct field-star RANSAC affine + held-out residual check (@cssearth/nebula-reconstruction/registration/stellar verifyRegistration), run standalone against native pixels.',
  source: { id: 'eso0844a', sha256: source.sha256, width: source.width, height: source.height },
  reference: { id: 'eso1119b', sha256: reference.sha256, width: reference.width, height: reference.height },
  frame, matrix: result.matrix, pass: result.pass, evidence: result.evidence,
};
await writeFile(resolve(root, 'labs/nebula/models/omega-centauri/eso0844a-registration.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log('Wrote eso0844a-registration.json');
