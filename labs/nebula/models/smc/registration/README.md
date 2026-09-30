# SMC relative image registration

The native SMASH TIFF anchors the common sky plane through its publisher AVM. VISTA and DSS2 have independent shared-star fits into that raster. A reciprocal SMASH-to-VISTA fit checks relative direction; it is the same image pair, not an independent absolute catalogue solution.

| Source | Pattern-confirmed stars | Held-out P90 | Matched source hull | Result |
|---|---:|---:|---:|---|
| VISTA | 35,154 | 0.571 SMASH pixels / 2.853 arcsec | 71.85% | Pass |
| SMASH, reciprocal VISTA reference | 35,156 | 0.544 VISTA pixels / 2.894 arcsec | 93.14% | Pass |
| DSS2 | 32,486 | 0.753 SMASH pixels / 3.764 arcsec | 95.45% | Pass |
| WISE, VISTA reference | 40,410 | 0.778 VISTA pixels | 99.45% | Fail: wrong-scale control median 94.99 pixels, below fixed 100-pixel requirement |
| WISE, SMASH reference | — | — | — | Fail: descriptor seed supplied no eligible source pairs |
| Spitzer, SMASH and VISTA references | — | — | — | Fail: no coherent descriptor seed |
| AllWISE, SMASH and VISTA references | — | — | — | Fail: no coherent descriptor seed |

All accepted runs use the registration routine pinned in `runs.json`. It discovers surrounding-star patterns independently of publisher WCS, holds out every third spatially ordered correspondence, and fits a homography only on training points. Shared descriptor discovery means this is fit holdout, not blind catalogue validation. All three accepted runs produce zero scrambled-shift pattern matches.

`recipe.json` records the exact numeric inputs, and exact publisher metadata is in `../candidate-intake.json`. The WISE diagnostic uses a locally tangent approximation for the publisher SIN projection, and the Spitzer diagnostic uses approximate webpage footprint metadata; neither is an accepted runtime transform. `alignment-report.json` binds only accepted relative registrations to the processing catalogue. SMASH's absolute astrometry remains publisher metadata. Outer-image extrapolation, simulation alignment, stellar membership and physical depth are unverified.

## Reproduction

Run from the repository root. This sequence restores the two exact publisher inputs and reproduces VISTA; the other receipt files record their own source/reference pair.

```sh
mkdir -p .local/nebula-lab/smc-intake .local/nebula-lab/source-originals
curl --fail --location https://cdn.eso.org/images/publicationjpg/eso1714a.jpg --output .local/nebula-lab/smc-intake/eso1714a.jpg
curl --fail --location https://storage.noirlab.edu/media/archives/images/original/noirlab2030b.tif --output .local/nebula-lab/source-originals/noirlab2030b.tif
/usr/bin/python3 -m venv .local/nebula-lab/registration/venv
.local/nebula-lab/registration/venv/bin/python -m pip install -r labs/nebula/models/lmc/candidates/source/wise-registration/requirements.txt
.local/nebula-lab/registration/venv/bin/python labs/nebula/packages/reconstruction/src/registration/validate-image-registration.py --source .local/nebula-lab/smc-intake/eso1714a.jpg --reference .local/nebula-lab/source-originals/noirlab2030b.tif --recipe labs/nebula/models/smc/registration/recipe.json --source-id eso1714a --reference-id noirlab2030b --output .local/nebula-lab/smc-registration/vista --max-dimension 5000
```

The output must contain `DIRECTION_GATE pass`, and `direction-gate.json` must independently report `pass: true` with matching source hashes. Process completion alone does not establish qualification.

## Independent AllWISE catalogue check

A separate compatible-band catalogue check qualifies AllWISE: 7,172 unique W1 catalogue matches, reserved median 0.233 and P90 0.384 native display pixels (2.106 and 3.467 arcseconds), hull 98.75%, all quadrants populated. No transform was fitted. Catalogue and image share the same mission, so this does not imply independent observations or native detector resolution. The same test on the original WISE SIN image fails.

`allwise-query.json` pins the exact IRSA AllWISE query (8 ≤ W1 ≤ 11, SNR > 30, point sources with clean W1 flags), and `allwise-catalogue-direction-gate.json` pins the catalogue and the matched-coordinate table. The operator is the strict TypeScript `fixed-catalogue.ts`.

The following sequence recreates the AllWISE receipt. Install dependencies from the checked-in lockfile first.

```sh
pnpm install --frozen-lockfile --ignore-scripts
mkdir -p .local/nebula-lab/smc-registration/catalogue .local/nebula-lab/smc-intake
node --input-type=module <<'NODE'
import fs from 'node:fs/promises';
import { verifyFixedCatalogue } from './labs/nebula/packages/reconstruction/src/registration/fixed-catalogue.ts';
const intake = JSON.parse(await fs.readFile('labs/nebula/models/smc/candidate-intake.json', 'utf8'));
const source = intake.candidates.find(source => source.id === 'smc-allwise-wide');
const query = JSON.parse(await fs.readFile('labs/nebula/models/smc/registration/allwise-query.json', 'utf8'));
const cataloguePath = '.local/nebula-lab/smc-registration/catalogue/allwise-bright.csv';
for (const [url, path] of [[source.url, source.path], [query.url, cataloguePath]]) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  await fs.writeFile(path, Buffer.from(await response.arrayBuffer()));
}
const result = await verifyFixedCatalogue(source.path, source.wcs, cataloguePath);
await fs.writeFile('.local/nebula-lab/smc-registration/catalogue/replayed-gate.json', JSON.stringify(result.receipt, null, 2));
await fs.writeFile('.local/nebula-lab/smc-registration/catalogue/replayed-matches.json', JSON.stringify(result.matches));
if (!result.receipt.pass) throw new Error('Fixed WCS catalogue gate failed');
console.log('FIXED_WCS_CATALOGUE_PASS', result.receipt.uniqueMatchedStars);
NODE
node --test labs/nebula/packages/reconstruction/src/registration/fixed-catalogue.test.ts
```

## Density-aware chance control

The fixed-WCS catalogue gate compares an image's own stars with the AllWISE catalogue and fits nothing. Its chance control is an excess over the chance rate at the image's own density, because a deeply stretched raster detects several times more real sources than a publisher JPEG. Inside the 0.75-pixel chance radius, the real close matches must be at least five times the largest chance estimate: the larger of every shifted and wrong-transform control count in that radius and the analytic rate `N_catalogue · (1 − exp(−N_detections · π r² / A))`. The gate also requires at least 100 unique matches, all four quadrants, half the image inside the matched hull, and held-out median ≤ 0.75 and P90 ≤ 1.5 native pixels.

`node labs/nebula/run.mts register-sky-bands sky-band-registration.json` runs the whole set in one pass: the four composed survey-band images, the qualified AllWISE image, and three known-bad controls. It fails if any check fails or any control qualifies. The measured numbers are tabulated in [the composite intake](../README-candidates.md#survey-band-composites) and locked in `fixed-catalogue.test.ts`.
