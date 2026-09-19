# Virtual telescopes

A virtual telescope here is not a picture taken from an archive. It is an observation this repository runs again:

1. **Pin** the exact files the observatory holds: every input by name, byte count and sha256.
2. **Re-run the observatory's own software** on them, from a pinned toolchain, with the calibration the observatory used.
3. **Compare** the result with something outside this repository: the archive's own product, an author's published value,
   the geometry the mission's kernels state, or a second reduction of our own.
4. **Write a receipt** of that comparison, and a record of the run beside what it produced.

Nothing here is retouched by eye. When a re-run and the archive disagree, the receipt says so and the number stands.

## The product record

Every producing stage writes one `cssearth-telescope-product@1` record beside its output, named `<product>.product.json`
([`tools/objects/product-record.mts`](../tools/objects/product-record.mts)). It holds:

| Field | What it states |
| --- | --- |
| `telescope`, `stage` | Which instrument, and which step of the route made this file. |
| `inputs` | Every file that went in: its role, its identity in the archive, its byte count and its sha256. |
| `parameters` | Everything else that decided the product: pipeline settings, calibration context, the script's digest. |
| `software`, `toolchainDigest` | The versions that ran, and the digest of the pin they were installed from. |
| `outputs` | Every file that came out, by path, byte count and sha256, with its units and conventions. |
| `evidence` | What was checked afterwards, each entry naming its kind, its receipt and the exact product it checked. |

A record carries no clock time, so the same run writes the same bytes. The run that made the outputs writes the record, from
what it actually used; nothing later rewrites those facts. Evidence is the one thing added afterwards, by the stage that did
the checking, through `addProductEvidence`: it refuses unless the files on disk are still the ones the record pins.

## The four kinds of evidence

A receipt's existence establishes nothing. Each entry names what its check is worth:

- **`archive-agreement`**: our re-run matches the observatory's own published product, sample by sample or event by event.
  It establishes that we ran their software the way they ran it. It does **not** establish that the observatory's product is
  right, nor that anything downstream of it is.
- **`internal-consistency`**: two of our own reductions of the same data agree (two nod halves, two templates, two subsets).
  It establishes that the result does not depend on that choice. It does **not** establish agreement with anyone else, and a
  shared mistake stays invisible to it.
- **`geometric-registration`**: the product lands where the mission's kernels and ephemerides say it should, measured as a
  residual in pixels. It establishes placement. It does **not** establish that the brightness is calibrated.
- **`published-value`**: a number we measured matches one a paper published. It establishes agreement with that paper at that
  paper's precision. It does **not** establish that the pixels behind it are reproducible, and it inherits the paper's own
  limits.

A caller asks for the kind it needs (`evidenceFor(record, product, kind)`); evidence of another kind, or for another product,
does not answer.

## Reusing what is already on disk

An observatory reduction takes hours, so a stage may skip one, but only when `sameRun` says the record beside the product was
written by this very run: the same inputs at the same digests, the same parameters, the same software and toolchain pin, and
the outputs still byte for byte the files that run wrote. Anything else (no record, another run, a changed or missing output)
runs the stage again. That is what keeps a receipt from describing processing that did not make the file beside it.

The same rule holds for archives of checks: a mode, observation or product counts as *checked* in a ledger only when a receipt
exists that parses, validates, and names that exact observation and product. A receipt that cannot be read is reported as a
problem, never counted as a check.

## The telescopes

| Telescope and route | Guide | Producing stage | Checked by | Evidence kind |
| --- | --- | --- | --- | --- |
| JWST imaging (calwebb_image3, coron3) | [JWST imaging](jwst-imaging.md) | `jwst/imaging/image3.mts`, `jwst/imaging/coron3.mts` | `jwst/imaging/compare.mts` against MAST's level-3 product | `archive-agreement` |
| JWST cubes (calwebb_spec3) | [JWST imaging](jwst-imaging.md) | `jwst/cubes/spec3.mts` | `compareCubeWithMast` against MAST's cube | `archive-agreement` |
| Hubble (calacs, calwf3, calstis, AstroDrizzle) | [Hubble](hubble.md) | `hst/calibrate.mts`, `hst/drizzle.mts` | `hst/compare.mts` against MAST's own product | `archive-agreement` |
| Hubble STIS line stacks | [Hubble](hubble.md) | `hst/line-stack.mts` | its own subsets, and the paper's published brightness | `internal-consistency`, `published-value` |
| VLT/NACO (ESO pipeline) | [VLT/NACO](naco.md) | `naco/reduce.mts` | `naco/compare.mts`, two of our own reductions | `internal-consistency` |
| Chandra (CIAO `chandra_repro`) | [Chandra](chandra.md) | `chandra/reprocess.mts` | `chandra/compare.mts`, event by event against the archive | `archive-agreement` |
| JunoCam (push-frame casting) | [JunoCam](junocam.md) | `juno/measure.mts` | the limb fit against the Juno kernels | `geometric-registration` |
| ALMA (CASA restore and self-calibration) | [Interferometric imaging](interferometric-imaging.md) | `interferometry/alma-restore-manual.mts`, `alma-disc-selfcal.mts` | the archive's own delivered image | `archive-agreement` |
| VLTI (PIONIER, GRAVITY, MATISSE, AMBER) | [Interferometric imaging](interferometric-imaging.md) | `interferometry/calibrate-*.mts` | the authors' published visibilities and images | `published-value` |

The ledgers say how much of each archive these routes have been proved on:
[JWST](jwst-ledger.md), [Hubble](hubble-ledger.md), [NACO](naco-ledger.md), [Chandra](chandra-ledger.md) and
[JunoCam](junocam-ledger.md).
