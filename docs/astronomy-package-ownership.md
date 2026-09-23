# Astronomy package ownership

cssEarth uses upstream packages where they can own a complete mechanical boundary. Scientific selection, input pins, reducers,
product records and evidence remain cssEarth contracts.

The machine-readable contract is
[`tools/objects/astronomy-packages/ownership.json`](../tools/objects/astronomy-packages/ownership.json). The sole Python process
boundary is `client.mts`; callers choose a named operation rather than importing Python packages or reproducing a protocol.

## Owned upstream

- **PyVO 1.9.1 owns TAP and VOTable decoding.** ALMA, ESO, Chandra, KOA, CADC, SIMBAD, OiDB and VizieR now use the same
  `tap-query` operation. Archive-specific downloads and calibration associations stay with their archive clients.
- **Astroquery 0.4.11 owns supported archive APIs.** It handles MAST, ALMA product discovery, VizieR cone searches and the JPL
  Horizons calls used by Chandra, Hubble and Juno.
- **Astropy owns the table, units and coordinates inside that Python boundary.** Its FITS/WCS implementation remains the
  independent oracle for the TypeScript production reader.
- **Peppi 0.5.0 owns complete, paginated PDS4 Registry discovery.** cssEarth supplies an exact target identity and explicit
  processing scope, verifies the returned label identities and bytes, and decides which product metadata is scientifically usable.
- **pdr 1.4.4 owns supported PDS3/PDS4 array and table decoding.** cssEarth pins the complete referenced file set and records
  label-declared special values, conventions and scientific limitations; a successful decode alone is not qualification.

## Whole implementations retained here

A candidate package is not adopted per field or per happy path. SPHERE's legacy pinned Horizons tables, PDS layouts that pdr
does not support, SPICE kernel evaluation, streaming FITS reads and the qualified Spitzer route remain entirely in their current implementations.
The eclipse-map eigensolver and small linear systems also remain in TypeScript. The ownership contract records the reason and
evidence for each decision. A later migration must move a complete operation and pass
the real products that operation serves.

The lock file uses hashes and `--no-deps`; package versions and the environment descriptor are part of the toolchain digest.
Astroquery, PyVO and Astropy are installed dependencies rather than copied source. Their copyright notices are retained beside
the lock. Observatory data keep their own attribution and reuse terms in each program and source manifest.

## Decisions checked on 23 September 2026

**SPICE.** Retain the preparation evaluator for now. [The tracked-kernel oracle](../tools/spice/small-kernel.oracle.test.mts)
checks UTC-to-ET and a body frame against [SpiceyPy](https://spiceypy.readthedocs.io/en/main/) 8.2.0 / CSPICE_N0067 with
a checked-in LSK and PCK. [The full DART oracle](../tools/spice/oracle.test.mts) checks spacecraft states, light-time
corrections, camera geometry and more frame classes when its pinned, ignored kernel bank is installed. The small test alone
does not qualify spacecraft geometry. Telescope's PlanetMapper route already uses SpiceyPy without mixing evaluators in one
result. Before deleting a custom path, migrate one complete preparation consumer with its pinned kernels and output receipt,
then compare positions, frames, light time and final pixels.

**FITS.** Retain the on-disk subregion reader used by repeated preparation reads. [The tracked STIS region oracle](../tools/fits/fits-file-region.oracle.test.mts)
hashes a 512 × 120 SCI rectangle after conversion to float64 and matches [Astropy](https://docs.astropy.org/en/stable/io/fits/)
8.0.1 `fits.open(..., memmap=True).section[...]` byte for byte. The reader can reuse an open file handle; Astropy already owns
Telescope's scientific FITS metadata checks. This one 3.1 MB file proves value parity, not large-file memory or speed. Before
changing readers, compare a real repeated-read workload and peak memory on the same pinned large input, then migrate its whole
consumer if Astropy meets the budget and preserves the receipt. WCS and data decoding require separate checks.

**Eclipse numerics.** Keep the small synchronous TypeScript eigensolver and fit for this release. Posterior sampling now draws
through the normal matrix's Cholesky factor instead of constructing its inverse and factoring it again. That draw has the same
covariance. [The independent NumPy oracle](../tools/objects/eclipse-map/numerics.oracle.test.mts) checks eigencurves, fit and
posterior covariance; the [ThERESA comparison](../tools/objects/eclipse-map/eigenmap-fit.oracle.test.mts) checks the method's
scientific behavior. A [SciPy](https://docs.scipy.org/doc/scipy/reference/linalg.html) replacement needs a complete real-fit
comparison, including process startup and the constrained posterior, before it can take ownership of this route.

## WorldWide Telescope data reuse

[WWT core catalogs](https://github.com/WorldWideTelescope/wwt-core-catalogs) curate imagesets, places, credits and tile URLs. At upstream revision [`2c7d96f`](https://github.com/WorldWideTelescope/wwt-core-catalogs/tree/2c7d96f14bae041501943b9281f71a84a5310f6e), `imagesets/planet_europa_visible.xml` is a planetary `Toast` imageset with a tile URL and NASA/JPL/Space Science Institute credit. It parses with `wwt_data_formats` 0.18.1 `Folder.from_file`. Its record supplies neither a qualified science product nor a Telescope retrieval receipt. It must be presented as curated display imagery, never as an `explore` observation choice or evidence that a wavelength/time search is complete.

The first possible integration is a separate curated-imagery result type carrying WWT's imageset identity, projection, source URL, credits, upstream revision and availability state. A generic importer should read WTML with [wwt_data_formats](https://wwt-data-formats.readthedocs.io/en/latest/) and validate those fields across catalog entries before use; it should not add a second handwritten WTML parser. The existing [WWT service client](https://wwt-api-client.readthedocs.io/en/latest/) is relevant for hosted collection operations, but the examined API does not establish a science observation search with Telescope's delivery and qualification semantics. No live tile availability, reuse terms for a prepared asset, or target-to-imageset matching was qualified in this review, so this PR does not publish an imagery choice.

[Toasty](https://toasty.readthedocs.io/en/latest/overview.html) prepares 256-pixel tile pyramids and TOAST projections. Our prepared body surfaces use equirectangular source maps and PolyCSS atlases, with tracked inventories and restored output. A Toasty pyramid cannot replace that preparation by changing a URL; a candidate needs a projection/asset-contract comparison and an output diff on a source-backed body. WWT's [WebGL engine](https://docs.worldwidetelescope.org/webgl-reference/latest/getting-started/) is a rendering system and is outside this data-ownership evaluation.

These are bounded decisions, not a claim that WWT lacks other extensions or that cssEarth's presentation is better. Telescope remains responsible for connecting supported discovery, selected retrieval, qualification and evidence; WWT data and visualization may complement that workflow.
