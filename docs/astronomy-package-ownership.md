# Astronomy package ownership

cssEarth uses upstream packages where they can own a complete mechanical boundary. Scientific selection, input pins, reducers,
product records and evidence remain cssEarth contracts.

The machine-readable contract is
[`tools/objects/astronomy-packages/ownership.json`](../tools/objects/astronomy-packages/ownership.json). Telescope's runtime
Python process boundary is `client.mts`; callers choose a named operation rather than importing Python packages or reproducing a protocol.
The WWT catalog has a separate preparation-only Python boundary and ships as checked-in metadata, with no Python needed for an `explore` lookup.

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

[WWT core catalogs](https://github.com/WorldWideTelescope/wwt-core-catalogs) curate imagesets, places, credits and tile URLs. The checked-in [imageset index](../data/wwt/core-imagesets.jsonl) holds 4,169 imagesets from all 45 `imagesets/*.xml` files at upstream revision [`2c7d96f`](https://github.com/WorldWideTelescope/wwt-core-catalogs/tree/2c7d96f14bae041501943b9281f71a84a5310f6e). It preserves each XML file's SHA-256, imageset name and tile template, projection, band, reference frame, WWT positioning fields and credits. The catalog metadata is MIT-licensed; [WWT's notice](../data/wwt/WWT-CORE-CATALOGS-LICENSE.txt) is retained. Each image's own credit remains attached to its result.

The [index builder](../tools/objects/telescopes/wwt/wwt-catalog-build.mts) reads the upstream XML through [wwt_data_formats](https://wwt-data-formats.readthedocs.io/en/latest/) 0.18.1, then pins the source revision and file digests. Telescope's [catalog adapter](../tools/objects/telescopes/wwt/wwt-catalog.mts) matches a resolved target's names against WWT titles or exact reference frames. `explore` saves up to 25 matching entries under `answer.curatedImagery`, with the total count and match basis, and displays the first five in the terminal. Europa matches its `ReferenceFrame`; M42 matches image titles. HR 8799 does not accidentally match WWT's `HR 8799e` title. These are name leads, not image-footprint checks. The entries are separate from numbered observation choices, do not change search coverage, and cannot be passed to `telescope get`.

To regenerate the index, obtain that exact WWT revision, install `wwt-data-formats==0.18.1` in an isolated Python environment, then run `CSSEARTH_WWT_PYTHON=/path/to/python node --import tsx tools/objects/telescopes/wwt/wwt-catalog-build.mts /path/to/wwt-core-catalogs/imagesets 2c7d96f14bae041501943b9281f71a84a5310f6e data/wwt/core-imagesets.jsonl`. The builder records SHA-256 for each XML input, making any changed source bytes visible in the index diff. Rebuilding from the pinned source and parser produced identical bytes in this PR. The 3.0 MB index has one record per line for review; it contains source metadata used by the CLI, no tile pixels or prepared body assets.

The [static WWT image exporter](../tools/objects/telescopes/wwt/wwt-image.mts) now takes a saved `explore.json`, checks its selection against that pinned catalog, and assembles supported top-down TAN sky tiles into one PNG for the existing offline image preparation path. Its `source.json` retains every tile URL and hash, the output hash, WWT metadata and the image credit; an authored image-layer recipe can use that file as its provenance input. A level-1 M33 trial assembled four ESO tiles into a 512 × 512 PNG. A small offline trial with M33's existing image-layer preparer produced a valid bank with 10 resources. Neither trial changes M33's current higher-resolution ESO source or its published prepared assets. Each image's publisher terms still govern reuse.

WWT also hosts scientific floating-point FITS tiles. The [PHAT FITS WTML](https://data1.wwtassets.org/packages/2021/09_phat_fits/index.wtml) is retained with a [pinned parser snapshot](../data/wwt/phat-fits.json), separately from the core display index. The [FITS command](../tools/objects/telescopes/wwt/wwt-fits.mts) retrieves one selected original tile with an 8 MiB transfer cap, preserves its bytes, and uses Telescope's existing Astropy extraction and plotting backend to produce a numeric FITS image and CSV with a product record. That record now exposes its pinned original tile through the same FITS output route used by a single-science-file local import, so `telescope outputs` can inspect actual HDUs and `telescope export` can extract further supported products; older WWT records retain this route. A live f475w level-0 tile had 256 × 256 floating-point samples, 11,378 finite samples, and no BUNIT, uncertainty array or celestial WCS in its header. It is useful numeric data, but its unit, sky coordinates and original untiled source identity remain unresolved. WTML positioning is retained as source metadata and is not silently asserted as FITS WCS. The [snapshot builder](../tools/objects/telescopes/wwt/wwt-fits-catalog-build.mts) accepts another FITS WTML collection without adding a source-specific adapter; the command selects its imageset and tile coordinates explicitly.

The bounded PNG exporter does not handle all WWT projections. WWT indexes Ceres Dawn FC HAMO and LAMO mosaics as TOAST tiles, while [Ceres's current source](../src/objects/ceres/source/manifest.json) is a USGS equirectangular WMS map. That map is unchanged here.

[Toasty](https://toasty.readthedocs.io/en/latest/overview.html) prepares 256-pixel tile pyramids and TOAST projections. Our prepared body surfaces use equirectangular source maps and PolyCSS atlases, with tracked inventories and restored output. A Toasty pyramid cannot replace that preparation by changing a URL; a candidate needs a projection/asset-contract comparison and an output diff on a source-backed body. WWT's WebGL engine is excluded by the [CSS runtime contract](../AGENTS.md); neither a viewer handoff nor a runtime tile request belongs to this integration. The runtime ownership check rejects WWT engine imports.

These are bounded decisions, not a claim that WWT lacks other extensions or that cssEarth's presentation is better. Telescope remains responsible for connecting supported discovery, selected retrieval, qualification and evidence. WWT contributes both curated display imagery for offline CSS preparation and hosted scientific FITS tiles that Telescope can preserve and inspect. The PHAT tile path does not claim a fulfilled calibrated observation request when its source metadata is incomplete.
