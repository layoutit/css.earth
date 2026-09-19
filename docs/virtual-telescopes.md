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

## Asking which observations might measure something

The ledgers say what each archive holds per object and per mode. They say nothing about a single exposure. The capability
query ([`tools/objects/telescopes/query.mts`](../tools/objects/telescopes/query.mts)) turns that into an answer to one
question: *which observing modes have ever pointed at this body, and could any of them, in principle, measure the thing I
care about?*

```
node tools/objects/telescopes/query.mts --target europa --wavelength 3.4,3.6 --kind cube \
  --range-km 630000000 --radius-km 1560.8 --min-elements 8
```

It returns one candidate per mode that observed the target, and each candidate answers three separate things:

1. **What the mode allows.** One answer per constraint (yes, no, partial or unknown) with its reason. Wavelength comes from
   the mode's recorded coverage. Sharpness is the best the mode can do at the requested wavelength, `1.22 lambda / D` floored
   at two pixels where a pixel scale is known, and is always phrased as *cannot be sharper than*. Time is unknown unless the
   ledger dates that object in that mode. Kilometres on the ground and elements across the disc need the range to the body,
   which only the caller knows.
2. **What the toolkit can do.** No toolkit, a tool with no checked program, or proven on checked receipts, and whether one of
   those programs is a program of this target.
3. **What supports it, and what is still unknown.** The ledger and the date the archive was read, receipts by name, body maps
   beside the object whose observations carry a measured resolution, investigation entries about that telescope, and a list of
   what nobody here knows until an observation is pinned and read.

The one authored input is [`modes.json`](../tools/objects/telescopes/modes.json): each mode's wavelength coverage, aperture,
pixel scale and product kind, with the handbook page each number was read from. JWST's cube modes take their coverage from
`jwst/imaging/bands.mts`, which already states it band by band. A mode nobody has sourced is left out, and the query says
"capabilities not recorded" for it rather than inventing numbers. Nineteen Hubble configurations (aggregates such as `STIS`
and `ACS`, and retired instruments such as the FOC, the FOS and the HSP) and nine NACO techniques whose own pages state no
wavelength range are in that position today.

### Europa between 3.4 and 3.6 micrometres

Asked for a cube, at Europa's typical range of 630 million kilometres, with at least eight resolution elements across the
disc, the query finds 23 modes that have observed Europa. In plain language:

- **JWST NIRSPEC/IFU**, 13 observations: covers the wavelengths, produces cubes, and the route is proven on `europa-1250`,
  a program of Europa itself. It cannot be sharper than 0.2 arcsec (two 0.1 arcsec pixels beat the 0.132 arcsec diffraction
  limit), which is about 5.1 elements across the disc, so the eight asked for are out of reach.
- **VLT/NACO spectroscopy**, 98 frames of the object: covers the wavelengths and is proven on `europa-088C0833`, but it
  produces spectra, not cubes. Its floor of 0.109 arcsec would allow about 9.4 elements, which is why that answer is
  *possible* rather than yes.
- **JWST NIRCAM/IMAGE**, 6 observations: covers the wavelengths, produces images rather than cubes, and its checked program is
  of another object.
- **Juno JUNOCAM**, 52 colour images, and the Hubble configurations: all proven or partly proven routes, none of which covers
  3.4 to 3.6 micrometres.

Chandra holds no record of Europa at all, and the query says so instead of leaving it out.

### What this does not establish

A candidate is a place to look, never a result. The query does not say that an observation exists at those exact wavelengths,
that it is public, that the target was resolved in it, or that it is usable: not whether an exposure saturates, not how much
of a mode's coverage a given setting used, not what resolution the observation reached, not where the body was pointed or lit.
Saturation is the plainest case: whether a grating saturates on a given body is learned by pinning an observation and reading
it, and it then belongs in that object's investigation ledger, which the query reports as evidence. No archive ledger knows it.
The sharpness figure is a bound on the instrument, not a measurement: an answer of *possible* means only that the mode is not
ruled out. Nothing becomes a fact here until an observation is pinned, re-run and compared, which is what the rest of this
page is about.
