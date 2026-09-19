# Virtual telescopes

A virtual telescope here is not a picture taken from an archive. It is an observation this repository runs again:

1. **Pin** the exact files the observatory holds: every input by name, byte count and sha256.
2. **Re-run the observatory's own software** on them, from a pinned toolchain, with the calibration the observatory used.
3. **Compare** the result with something outside this repository: the archive's own product, an author's published value,
   the geometry the mission's kernels state, or a second reduction of our own.
4. **Write a receipt** of that comparison, and a record of the run beside what it produced.

Nothing here is retouched by eye. When a re-run and the archive disagree, the receipt says so and the number stands.

One route does none of that on purpose. Where an observatory has retired a pipeline and frozen a calibration, there is nothing
to run again, and the archive's own final product is all there is. That product is pinned and read whole rather than re-made,
and the difference is kept visible everywhere: see [two capabilities, never one](#two-capabilities-never-one).

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

## Two capabilities, never one

What a repository can do with an instrument is two questions, and they have different answers:

1. **Can it be re-calibrated here?** Is the observatory's own pipeline in our pinned toolchain, and has an observation been
   re-run through it and compared with the archive's product?
2. **Does the archive hold a final calibrated product, and have we read one?** Is there a complete product to pin (science
   values, wavelengths or a world coordinate system, uncertainty, quality flags), and has one been downloaded, checked against
   the archive's own catalogue and measured here?

An instrument that is retired loses the first and keeps the second. Its pipeline stops being distributed and its calibration is
frozen, but every observation it took is still in the archive, still calibrated, still usable. Reporting the two as one
capability would make thousands of real observations vanish from a ledger because a piece of software is no longer installed,
which is not what happened to them. So the ledgers carry both, and what is only the second is never reported as the first.
Hubble's retired instruments under that rule are in
[Hubble](hubble.md#archive-final-products-of-retired-instruments).

## The five kinds of evidence

A receipt's existence establishes nothing. Each entry names what its check is worth:

- **`archive-agreement`**: our re-run matches the observatory's own published product, sample by sample or event by event.
  It establishes that we ran their software the way they ran it. It does **not** establish that the observatory's product is
  right, nor that anything downstream of it is.
- **`archive-origin`**: the bytes we hold are the observatory's own final product, retrieved from its archive and pinned by
  size and sha256, with the archive's catalogue and the file's own headers agreeing on which observation it is. It establishes
  origin and integrity. It does **not** establish that anything here reproduces that calibration, because nothing was re-run
  and nothing was compared: it is not `archive-agreement`, and a caller asking whether a route reproduces an observatory's
  pipeline is never answered with it.
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
| Hubble retired instruments (WFPC2, FOS, GHRS) | [Hubble](hubble.md#archive-final-products-of-retired-instruments) | nothing of ours: `hst/archive-final.mts` pins and reads the archive's own final product | the catalogue against the files' own headers, by digest | `archive-origin` |
| IHW/PDS Halley near-nucleus images | [IHW Halley](ihw-halley.md) | nothing of ours: the archive's edited relative-intensity image is pinned and read | the IHW index, PDS label and FITS header, by digest | `archive-origin` |
| Hubble STIS line stacks | [Hubble](hubble.md) | `hst/line-stack.mts` | its own subsets, and the paper's published brightness | `internal-consistency`, `published-value` |
| VLT/NACO (ESO pipeline) | [VLT/NACO](naco.md) | `naco/reduce.mts` | `naco/compare.mts`, two of our own reductions | `internal-consistency` |
| Chandra (CIAO `chandra_repro`) | [Chandra](chandra.md) | `chandra/reprocess.mts` | `chandra/compare.mts`, event by event against the archive | `archive-agreement` |
| JunoCam (push-frame casting) | [JunoCam](junocam.md) | `juno/measure.mts` | the limb fit against the Juno kernels | `geometric-registration` |
| ALMA (CASA restore and self-calibration) | [Interferometric imaging](interferometric-imaging.md) | `interferometry/alma-restore-manual.mts`, `alma-disc-selfcal.mts` | the archive's own delivered image | `archive-agreement` |
| VLTI (PIONIER, GRAVITY, MATISSE, AMBER) | [Interferometric imaging](interferometric-imaging.md) | `interferometry/calibrate-*.mts` | the authors' published visibilities and images | `published-value` |

The ledgers say how much of each archive these routes have been proved on:
[JWST](jwst-ledger.md), [Hubble](hubble-ledger.md), [NACO](naco-ledger.md), [Chandra](chandra-ledger.md),
[JunoCam](junocam-ledger.md), [Spitzer](spitzer-ledger.md), [Gemini](gemini-ledger.md), [Keck](keck-ledger.md) and [IHW Halley](ihw-halley.md).

## Asking which observations might measure something

The ledgers say what each archive holds per object and per mode. Where an archive exposes a stable observation identity, a
ledger can also retain the complete observation index; Spitzer records every AORKEY, programme and observing interval. The capability
query ([`tools/objects/telescopes/query.mts`](../tools/objects/telescopes/query.mts)) turns that into an answer to one
question: *which observing modes have ever pointed at this body, and could any of them, in principle, measure the thing I
care about?* These commands require Node 22.18.x or Node 24+. When the shell's Node is older, the package launcher uses the
newest compatible Node already installed under NVM, or `CSSEARTH_NODE`; it reports a concrete recovery only when neither exists.

```
pnpm telescope:query --target europa --wavelength 3.4,3.6 --kind cube \
  --any-time --range-km 630000000 --radius-km 1560.8 --min-elements 8 --result body-map
```

`pnpm telescope:query --help` prints the complete grammar. A minimum-resolution option is the largest acceptable scale, so a
smaller `--min-arcsec` or `--min-km` asks for sharper data. For machine input, `pnpm --silent telescope:query ... --json`
writes JSON alone; ordinary `pnpm` prints its script banner before the program's stdout.

The target is resolved through the source object descriptors that generate the shipped catalogue. An id, display name or
catalogue alias resolves to one canonical id. A near spelling is never silently substituted: it returns the distinct
`unknown-target` endpoint with ranked suggestions and no archive negatives. This matters because "the target is not shipped"
and "the archives contain no observation of a shipped target" are different scientific results.

Every ledger also returns a target-coverage state: `observed`, `searched-empty`, `not-searched` or `unanswered`. Only
`searched-empty` is an archive negative. A query with no candidates and any incomplete coverage ends at `index-incomplete`
with `target-index-unavailable` or `archive-query-unanswered`; it cannot silently turn an unattempted lookup into “no data.”

It returns one candidate per mode that observed the target, the ones that cover the requested wavelengths first, and each
candidate answers four separate things:

1. **What the mode allows.** One answer per constraint (yes, no, partial or unknown) with its reason.
   - *Wavelength* comes from the mode's recorded intervals, one per documented window, filter or channel. A mode is never
     given an enclosing minimum and maximum, because the gap between two windows is not coverage: NIRCam coronagraphy
     observes 1.8 to 2.2 and 2.8 to 5.0 micrometres, so a request for HD 181327 at 2.4 to 2.6 is answered no.
   - *Sharpness* is two different facts, kept apart. What the **optics** resolve is the diffraction limit of the aperture, or
     a point spread function the documentation states where diffraction says nothing useful, as for Chandra's grazing
     incidence mirrors. How finely the **detector** samples that image is two pixels. Only the optics can support a definite
     no. Coarse pixels make the answer unknown, never no, because dithering, subpixel positioning and event centroiding
     recover part of what pixels lose and no ledger says whether an observation did. Where only sampling is recorded, the
     answer is unknown as well.
   - *Time* is unknown unless the ledger dates that object in that mode. A complete observation index can answer yes or no;
     a partial date sample can answer yes when it finds an overlap, but remains partial when it does not.
   - *Kilometres on the ground* and *elements across the disc* are the same two facts converted, and they need the range to
     the body, which only the caller knows.
2. **What the toolkit can do.** One of four answers, and whether one of those programs is a program of this target: no toolkit;
   a tool with no checked program; *archive-final products qualified, not re-made here*, which is the archive's own final
   product pinned and read whole for a mode nothing here re-calibrates; or *recalibrated here and checked*. The third is never
   reported as the fourth: a retired instrument can reach it and can never reach re-calibration.
3. **Whether it can end as a body map.** This is separate from reduction: a proven reducer may correctly end at detector
   pixels. The query names the registered author for modes that reach the shared body-map contract and says no where none is
   registered.
4. **What supports it, and what is still unknown.** The ledger and the date the archive was read, receipts by name, body maps
   beside the object whose observations carry a measured resolution, investigation entries, and a list of what nobody here
   knows until an observation is pinned and read.

Each candidate also carries a `selectionAssessment` derived from these same facts: `selectable`, stable blocker codes, and a
structured next action for every target-qualified program only when the explicit selection command can run. If qualification
is the only blocker and a registered telescope route can cover the entire requested wavelength window, `qualificationActions`
instead names the indexed archive observation, its detector channel or instrument band, the resulting program id and an executable `telescope:qualify`
command. That command validates the target, mode and observation against the index, then hands the work to the telescope-owned
reducer; it is a small dispatcher, not a second reduction framework. The top-level `endpoint` is `unknown-target`,
`request-incomplete`, `no-selectable-candidate`, or `selectable-candidates`; it reports the number that can proceed and the
blocker codes present across the answer. Consumers do not need to reverse-engineer workflow state from prose.

Evidence reaches a candidate only by naming it. A body map's observation states the telescope, the exact ledger mode and the
pinned program separately from its instrument setting; an investigation entry must contain that mode key in its own words. Anything
that resolves to several modes, or to none, is listed separately as unassigned evidence with what it could have meant. A
Hubble STIS/CCD map says nothing about STIS/FUV-MAMA, which sees other wavelengths through another detector, so it is never
carried there.

The one authored input is [`modes.json`](../tools/objects/telescopes/modes.json): each mode's wavelength intervals, aperture,
pixel scale, documented point spread function where there is one, and product kind, with the handbook page every number was
read from. JWST's cube modes take their intervals from `jwst/imaging/bands.mts`, which already states them band by band. A
mode nobody has sourced is left out, and the query says "capabilities not recorded" for it rather than inventing numbers. A
mode may still have a sourced product kind while wavelength and sharpness remain unknown, as with the heterogeneous IHW image
collection; useful facts no longer require making up the missing ones.
Fifteen Hubble configurations (aggregates such as `STIS` and `ACS`, which name no one detector, and retired instruments such
as the FOC, the WF/PC and the HSP) and nine NACO techniques whose own pages state no wavelength range are in that position
today. The FOS and GHRS detectors left that list when their handbooks' own ranges were read for the archive-final route; being
sourced is not being re-calibrated, and the query keeps those two apart. All Spitzer archive modes carry instrument-handbook
wavelength intervals, product kinds, sampling and a documented point-spread function where one is available. TEXES, HIRES and
NACO cube are also sourced: TEXES is 5–25 micrometre spectroscopy, HIRES is 0.2–1.1 micrometre spectroscopy, and NACO cube is
an infrared imaging-cube storage form whose exact filter and specialized technique remain observation-level facts. Other Gemini
and Keck modes remain visible where those sourced capability facts have not been written yet; affected constraints stay unknown.

## From a question to a publishable layer

The query can make an explicit selection instead of silently treating the first candidate as the answer:

```
pnpm telescope:query --target europa --wavelength 4.24,4.28 --kind cube \
  --any-time --min-arcsec 0.3 --result body-map \
  --select-telescope JWST --select-mode NIRSPEC/IFU --program europa-1250
```

Exploratory queries may omit constraints. An explicit selection must state time (a range or `--any-time`), one required
angular or surface resolution, product kind and whether it needs a telescope product or body map. Selection is refused when
any requested constraint is `no`, the mode has no usable toolkit, or a body map was requested but no body-map author is
registered. The full mode-level constraint table is retained, and every `partial` and `unknown` answer is copied into the
selection. Observation wavelength remains explicitly unknown until the selected program's filter, grating or channel is
qualified. The selected program must belong to this target in this mode. `assessObservationSelection` returns every blocker
as typed data; `selectObservation` reports them together rather than making a caller repair them one at a time.

Candidate output keeps three program facts separate: programmes the archive records for this target, programs pinned to the
toolkit, and programs with checked receipts or qualified archive-final products. An archive programme is therefore visible
without being presented as something the local route can already run. Where present, complete archive observation records are
returned under the candidate's observation count; the human output shows the first eight and the JSON answer retains all of them.

Spitzer IRAC Map is the first registered qualification route. For a request contained in one IRAC channel, the query can emit
one action per time-matching AOR. For example, the Bennu 3.5–3.9 micrometre request selected channel 1 and AOR 21415424. Running
that action pinned the archive inputs, produced and compared the mosaic, refreshed the ledger's program and receipt identities,
and changed the same query from `target-program-unqualified` to a selectable `bennu-21415424` program. Other telescopes remain
unregistered until their own reducers define the observation-level choices they can qualify honestly.

The instrument author then writes the final map, its `*.body-map.json`, and the shared `*.product.json`. Resolved images from
JWST, ALMA and NACO meet at `tools/objects/resolved-disc-map.mts`: an adapter supplies a north-up/east-left value plane, its
one-sigma uncertainty, plate scale and observation identity; the shared stage fits the limb and owns the ephemeris, rotation,
camera, projection and complete body-map observation. Hubble's slit scan has different image formation and joins at the final
body-map contract. The product record pins the recipe, observation products, ephemerides and rotation model that the map stage
read, along with the output plane and its body-map metadata.

Publication performs the query and verifies the whole chain in one command:

```
pnpm telescope:publish-map --target europa --wavelength 4.24,4.28 --kind cube \
  --any-time --min-arcsec 0.3 --result body-map \
  --select-telescope JWST --select-mode NIRSPEC/IFU --program europa-1250 \
  --map src/objects/europa/source/jwst/carbon-dioxide.fits.body-map.json \
  --out src/objects/europa/source/jwst/carbon-dioxide.telescope-layer.json
```

It refuses a missing map contract with the selected telescope, mode and program in the error. It also refuses a changed
plane, stale product record, changed measurement definition, frame, grid or combination policy, a map
whose observations omit their exact mode or program, a map that does not contain the selected program, or measured resolution
and observation times that fail the original question. Its output keeps
the original scientific request, unresolved constraints, selected toolkit level, exact product record, quantity, units,
definition digest and observations. A body package can therefore expose the layer without recreating a scientific claim in
presentation code.

### Europa between 3.4 and 3.6 micrometres

Asked for a cube, at Europa's typical range of 630 million kilometres, with at least eight resolution elements across the
disc, the query finds the recorded modes that have observed Europa. In plain language:

- **JWST NIRSPEC/IFU**, 13 observations: covers the wavelengths, produces cubes, and the route is proven on `europa-1250`,
  a program of Europa itself. Its optics hold the disc to at most 7.8 elements and its pixels sample 5.1, so the eight asked
  for are out of reach whichever figure is used, and this one is a definite no.
- **VLT/NACO spectroscopy**, 98 frames of the object: covers the wavelengths and is proven on `europa-088C0833`, but it
  produces spectra, not cubes. Its optics allow about 9.8 elements and its pixels 9.4, so the elements answer is *possible*
  rather than yes.
- **JWST NIRCAM/IMAGE**, 6 observations: covers the wavelengths, produces images rather than cubes, and its checked program is
  of another object.
- **Juno JUNOCAM**, 52 colour images, and the Hubble configurations: proven or partly proven routes, none covering 3.4 to 3.6
  micrometres, so they sort below the three above.
- One investigation entry about JWST carbon dioxide is left unassigned: it names the telescope but no single mode, and four
  JWST modes observed Europa.
- Gemini and Keck modes also appear as candidates, while constraints absent from their ledgers remain *unknown*. Keck's
  pinned NIRSPEC holdings are kept separate from its one runnable, checked KCWI program.

Chandra holds no record of Europa at all, and the query says so instead of leaving it out.

### What this does not establish

A candidate is a place to look, never a result. The query does not say that an observation exists at those exact wavelengths,
that it is public, that the target was resolved in it, or that it is usable: not whether an exposure saturates, not which
filter or grating it used inside the mode's intervals, not what resolution it reached, not where the body was pointed or lit.
Saturation is the plainest case: whether a grating saturates on a given body is learned by pinning an observation and reading
it, and it then belongs in that object's investigation ledger, which the query reports as evidence. No archive ledger knows it.
The sharpness figures are bounds on an instrument and its detector, not measurements: *possible* means only that the mode is
not ruled out, and *unknown* often means the pixels are coarser than the optics and nobody here knows what a given exposure
recovered. Nothing becomes a fact until an observation is pinned, re-run and compared, which is what the rest of this page is
about.
