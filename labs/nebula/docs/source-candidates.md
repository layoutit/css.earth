# Process Pleiades, Crab and Lagoon sources

These objects now have selected processing recipes and the shared Alignment and
Reconstruction workspaces. Completion does not imply visual or physical acceptance.
Each object retains its broader source intake and primary-paper records. The right
sidebar exposes source, wavelength, footprint, resolution limits, credits and
papers. Switching images retains the camera. **Fit image** frames the selected
source; **Earth view · fit all** shows every complete selected footprint.
The source dossier's selection limits the dropdown and image requests. Selection
can include unprocessed comparisons; each compiler retains its separate processing recipe. Historical candidates remain in the source records.
Publisher-only comparisons remain inspectable with their status visible;
curation never changes the source transform or upgrades registration evidence.

| Workspace | Source dossier | Current registration evidence |
| --- | --- | --- |
| [Pleiades](http://127.0.0.1:4331/alignment?subject=m45) | [M45 sources](../models/m45/README.md) | Six Alignment views; four baked lenses. The original optical, two Spitzer composites and WISE are relatively star-verified; their completed diffuse and residual layers are reused from the pinned processing cache. Usama/IAU and Andreo add wider optical comparison footprints with explicitly unverified bright-star seeds. 2MASS is mostly stars; coarse IRIS supplies little usable cloud detail. Both are hidden. |
| [Crab](http://127.0.0.1:4331/alignment?subject=m1) | [M1 sources](../models/m1/README.md) | Six views: Hubble, two Webb treatments, Spitzer, VLA and Chandra. Stellar correspondence, a documented common-grid bridge and an explicit Webb scale calibration are separate evidence paths. Keep epoch/expansion and absolute-astrometry limits explicit. |
| [Lagoon](http://127.0.0.1:4331/alignment?subject=m8) | [M8 sources](../models/m8/README.md) | Three selected: ESO optical/VISTA and Spitzer, with held-out RMS approximately 0.76″ and 1.00″ respectively. Hubble close-ups remain hidden; Herschel is zero-filled over the central nebula and is rejected for this comparison. |

Checks are relative to the configured optical image, not an independent absolute
catalogue solution. TAN and ordinary, zero-slant SIN WCS preserve each source's
native pixel conventions. The browser uses an affine approximation to the common
tangent plane; residual gates are unchanged. Unverified comparisons can be
inspected but cannot pass the existing processing gate. Spectral morphology and exposure stretches
need not agree; do not fit nebular knots as stars or erase Crab expansion.

## Recreate the selected processing set

Requires Node 22, pnpm 10.33.0 and Python 3.9–3.12 with `venv`/`pip`; run from
the repository root of this branch. The environment command restores only the
pinned Python packages and NOX model, without processing other objects.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
node --experimental-strip-types labs/nebula/run.mts prepare-processing-environment
node --experimental-strip-types labs/nebula/run.mts compile-candidates labs/nebula/models/messier/processing-candidates.json
pnpm lab:nebula
```

The batch restores pinned downloads, checks registration, prepares native
separation/preservation and structure evidence, and bakes the object-owned model.
It checks completed artifacts before installing local preview pointers. Success
requires `CANDIDATE_BATCH_COMPLETE 3/3`; failure of one object remains explicit.
Use `--object=m45`, `--object=m1` or `--object=m8` to select one. Add
`--alignment-only` to the same batch command to prepare inspection images without
running removal or reconstruction. The originals, PDFs, native outputs, grids,
slabs and browser captures remain ignored; recipes, source/evidence identities and
numerical qualification records are tracked.

| Object | Prepared model | Remaining interpretation/visual limits |
| --- | --- | --- |
| Pleiades · four lenses | Positive display emission on an authored dust surface, with locally scoped literature constraints; 450 conditional field lights. | Saturated optical cores/halos survive NOX; fine fibres blur and the surface reads as a thin sheet from the side. Reflection/scattering and global dust depth are not recovered. |
| Lagoon · three lenses | A curved emission front with local Her 36 constraints; VISTA contributes less to geometric fitting; 650 conditional field lights. | Residual blobs, oblique banding and hard infrared footprint boundaries remain. Local velocities are retained as evidence, not converted into a global depth law. |
| Crab · six lenses | Qualified released 3D line-emission points plus separate torus/jet wind terms and a named pulsar. | Conditional expansion-law depth, mixed epochs, authored wind terms and spectral weights. No recovered gas density or full radiative transfer. |

Pleiades and Lagoon preserve identical geometry and alpha across their RGB lenses.
Crab uses [explicit emitting components](sampled-volumes.md): the same coordinate
frame, with different tracer emission weights. Its X-ray lens must not become a
recoloured optical shell. Each README and `processing-evidence.json` owns the
actual tested result, source receipts, camera checks and unresolved limitations.

## Historical intake checks

The original source-intake revision `47c459707` passed native source pins/dimensions, strict
lab TypeScript, 15 affected unit tests, and real-browser decoding/switching of all
18 images. Browser checks also cover source/paper display, unchanged camera,
alignment-only routing and absence of processing requests. Ordinary SIN rays
match independent Astropy 6.0.1/WCSLIB fixtures. The curation follow-up changes no
source bytes or accepted transform, so those numerical checks still apply.
The historical curation revision `6096f65da` checked a 4/1/3 selection.
The subsequent correction restored all six Crab views (4/6/3 overall). Strict lab
TypeScript, six affected unit tests and the source-candidate browser flow passed:
registration evidence and per-image status are preserved, excluded images are
not fetched, camera switching is stable and no processing starts. Receipts and screenshots are local
under `.local/nebula-lab/source-candidates-browser/`.

During intake, higher-resolution (4096px) detection was tried for the unresolved comparisons:
Crab Hubble/Webb supplied 14 pattern-confirmed matches against the unchanged
45-match gate; the tiny Lagoon core did not supply a trustworthy shared stellar
pattern against the wide-field inputs. These failed attempts do not change the
publisher placements or justify fitting nebular structure. For stellar images,
compare suitable local high-resolution astrometric fields.
For nonstellar maps, qualify publisher registration against calibrated source
products and their astrometric uncertainties; do not force spectral structures
to coincide. Failed stellar matching alone does not prove misalignment.

The user subsequently authorized full processing of the selected source sets.
New unselected candidates still require registration qualification and explicit
processing scope. Scientific separate-band FITS/uncertainty masks remain
necessary for calibrated flux or physical inference; the current RGB outreach
and survey previews do not supply those measurements.
