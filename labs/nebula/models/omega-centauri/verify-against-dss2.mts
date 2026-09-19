/** Register each press-release Omega Centauri image against an exact-WCS hips2fits DSS2 cutout,
 * separately. Bypasses prepare-observations.ts only because its dependency graph currently pulls
 * in an unrelated JWST toolchain module that throws on import when bundled; reuses the exact
 * shared detectStars/matchStars/verifyRegistration algorithm, invents no matching logic. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { detectStars, matchStars, verifyRegistration, publisherTransform, type SkyRaster, type SkyFrame } from '../../packages/reconstruction/src/registration/stellar.ts';

const root = process.cwd();
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
async function loadBytes(path: string, expected: string): Promise<Buffer> {
  const bytes = await readFile(resolve(root, path));
  const got = sha256(bytes);
  if (got !== expected) throw new Error(`Pin differs for ${path}: expected ${expected}, got ${got}`);
  return bytes;
}

// hips2fits reference: WCS exact by construction from the request parameters (fov=1.0deg, width=3600, ra/dec, rotation 0).
const dss2: SkyRaster & { path: string; sha256: string } = {
  path: '.local/nebula-lab/source-originals/omega-centauri-dss2.jpg', sha256: 'e42fb97ed35ac675f4143d77d7aaba096948a96fceaad2e200b1f279a1cb7638',
  width: 3600, height: 3600, fieldArcminutes: [60, 60], centerIcrsDegrees: [201.696958, -47.479539], northRightDegrees: 0,
  wcs: { projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [3600, 3600], referencePixel: [1800, 1800],
    referenceValueDeg: [201.696958, -47.479539], scaleDeg: [-1 / 3600, 1 / 3600], rotationDeg: 0 } as any,
};

const candidates: (SkyRaster & { id: string; path: string; sha256: string })[] = [
  { id: 'eso1119b', path: '.local/nebula-lab/source-originals/eso1119b.tif', sha256: '8df2e2ad462b9dc5b7437320fb2c6fd247c11746b4b2ffd3da95846b9083cad6',
    width: 14540, height: 14540, fieldArcminutes: [50.88, 50.88], centerIcrsDegrees: [201.69695833333333, -47.47953888888889], northRightDegrees: 0.00051173061,
    wcs: { projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [14540, 14540], referencePixel: [7270, 7270],
      referenceValueDeg: [201.69695833333333, -47.47953888888889], scaleDeg: [-0.20995873452544705 / 3600, 0.20995873452544705 / 3600], rotationDeg: 0.00051173061 } as any },
  { id: 'eso0844a', path: '.local/nebula-lab/source-originals/eso0844a.tif', sha256: '384d1cfc31e6a2b78e5c7018f9eaecfe49a1014630bcb1bd8dceb563d69e6429',
    width: 8040, height: 7560, fieldArcminutes: [31.88, 29.99], centerIcrsDegrees: [201.69716666666667, -47.479683333333334], northRightDegrees: -0.00724264734,
    wcs: { projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [8040, 7560], referencePixel: [4020, 3780],
      referenceValueDeg: [201.69716666666667, -47.479683333333334], scaleDeg: [-0.23791044776119402 / 3600, 0.23801587301587301 / 3600], rotationDeg: -0.00724264734 } as any },
];

const frame: SkyFrame = { width: 8192, height: 8192, fieldArcminutes: [60, 60], centerIcrsDegrees: [201.696958, -47.479539], northUp: true };
console.log('frame arcsec/px', 60 * 60 / frame.width);

console.log('Reading DSS2 reference...');
const dss2Bytes = await loadBytes(dss2.path, dss2.sha256);
console.log('Detecting DSS2 stars...');
const dss2Stars = await detectStars(dss2Bytes, [dss2.width, dss2.height], 3600, 8000);
console.log(`DSS2 stars: ${dss2Stars.length}`);
const dss2Init = publisherTransform(dss2, frame);

const report: { schema: string; pass: boolean; catalogue: string; sources: unknown[] } = {
  schema: 'cssearth-image-alignment-report@1', pass: true, catalogue: 'labs/nebula/models/omega-centauri/observations.json', sources: [],
};

for (const candidate of candidates) {
  console.log(`--- ${candidate.id} vs DSS2 ---`);
  const bytes = await loadBytes(candidate.path, candidate.sha256);
  const stars = await detectStars(bytes, [candidate.width, candidate.height], 8000, 12000);
  console.log(`${candidate.id} stars: ${stars.length}`);
  const initial = publisherTransform(candidate, frame);
  const pairs = matchStars(stars, dss2Stars, initial, dss2Init);
  console.log(`${candidate.id} matched pairs (pre-verify): ${pairs.length}`);
  let outcome: { pass: boolean; matrix: unknown; evidence: Record<string, unknown> };
  if (pairs.length < 45) {
    outcome = { pass: false, matrix: initial, evidence: { status: 'publisher', matchedStars: pairs.length, interpretation: 'Fewer than 45 matched pairs against the DSS2 reference.' } };
    console.log(`${candidate.id}: IMPASSE, only ${pairs.length} matched pairs (need 45).`);
  } else {
    const result = verifyRegistration(pairs, candidate, frame, initial, { width: dss2.width, height: dss2.height, imageToFrame: dss2Init });
    outcome = { pass: result.pass, matrix: result.matrix, evidence: result.evidence };
    console.log(JSON.stringify({ id: candidate.id, pass: result.pass, rmsPixels: result.evidence.rmsPixels, maxResidualPixels: result.evidence.maxResidualPixels,
      residualArcseconds: result.evidence.residualArcseconds, matchedStars: result.evidence.matchedStars, trainingStars: result.evidence.trainingStars,
      heldOutStars: result.evidence.heldOutStars, spatialQuadrants: result.evidence.spatialQuadrants, coverageFraction: result.evidence.coverageFraction }, null, 2));
  }
  if (!outcome.pass) report.pass = false;
  report.sources.push({ id: candidate.id, pass: outcome.pass, sourcePath: candidate.path, sourceSha256: candidate.sha256,
    geometry: { kind: 'matched-star-homography', registration: outcome.pass ? { referenceWcs: dss2.wcs, referenceWidthPx: dss2.width, referenceHeightPx: dss2.height, imageToReferenceMatrix: outcome.matrix } : null },
    evidence: outcome.evidence });
}

await writeFile(resolve(root, 'labs/nebula/models/omega-centauri/dss2-registration-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('Wrote dss2-registration-report.json');
console.log('OVERALL PASS:', report.pass);
