# Europa: expand registered infrared coverage

Proposal 11 · **Qualification first** · Priority 1 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Two registered NIMS products supply the current infrared composite. Other composition datasets already exist and should remain distinct.

Use additional qualified NIMS observations to improve measured coverage and add a water-ice or hydrate signature only when the archived quantity supports it.

Content owners: [europa](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/europa/README.md)

## Evidence

The expanded USGS listing contains 794 TIFF URLs, including alternate processing products. Photojournal identifies trailing-hemisphere, Tyre and Manannán observations worth tracing back to original cubes.

## Work

Deduplicate by observation and processing version, join geometry and quality products, measure incremental surface coverage, and retain wavelength, observation epoch and calibration lineage.

## Limits and prior decisions

794 files do not mean 794 observations. The Manannán press overlay is regional and is not a quantitative abundance raster. Do not merge incompatible brightness scales or sharpen NIMS with SSI detail.

## Acceptance

A per-observation coverage table, independent band samples, geometry landmarks, explicit overlap rules and comparison against the existing two-product baseline.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/europa-galileo-nims-hyperspectral-map-products-registered-archive)
- [NASA source page](https://science.nasa.gov/photojournal/nims-e4-observations-of-europa-trailing-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/a-compositional-map-of-the-tyre-region-of-europa/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-water-signatures-at-europas-manannan-crater/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00846](https://science.nasa.gov/photojournal/nims-e4-observations-of-europa-trailing-hemisphere/) | candidate | December 1996 Europa E4 NIMS observations are regional, about 3 km/pixel, and overlaid on older Voyager context; preserve actual spectral support. |
| [PIA01098](https://science.nasa.gov/photojournal/a-compositional-map-of-the-tyre-region-of-europa/) | candidate | Tyre NIMS/SSI composition overlay is a useful regional observation lead; original spectral quantity and mask must be recovered. |
| [PIA26104](https://science.nasa.gov/photojournal/map-of-water-signatures-at-europas-manannan-crater/) | candidate | Manannán Galileo NIMS overlay is a regional water-ice/hydrate-signature lead published much later than observation; use original spectra and actual dates. |

USGS catalogue IDs: `europa-galileo-nims-hyperspectral-map-products-registered-archive`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

1 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini VIMS | [Europa](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Europa&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 352 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
