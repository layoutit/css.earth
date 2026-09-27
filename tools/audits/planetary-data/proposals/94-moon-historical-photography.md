# Moon: qualify historical and illumination-specific photographs

Proposal 94 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Modern global lunar photography already exists. These sources would add a qualified historical or illumination comparison rather than automatically improve spatial detail.

Retain one genuinely distinct source-qualified observing set if its date or lighting adds scientific value within existing controls.

Content owners: [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

## Evidence

The USGS audit includes Lunar Orbiter imagery, a hybrid mosaic and Kaguya morning/evening products. The hybrid combines instruments rather than representing a single exposure.

## Work

Read source-image lineage, illumination and projection; cross-match current inputs and quantify registration and footprint before choosing a set.

## Limits and prior decisions

Do not turn lighting differences into surface-change claims or label a multi-epoch hybrid as one historical date. No duplicate dataset for a cosmetic alternate basemap.

## Acceptance

Original epochs and observing geometry, source overlap, control residuals, validity and an explicit reason the addition is useful.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_selene_kaguya_tc_global_orthomosaic_474m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_selene_kaguya_tc_evening_global_mosaic_474m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lunar_orbiter_digital_photographic_global_mosaic_59m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_lunar_orbiter_clementine_uvvisv2_hybrid_mosaic_59m)
- [USGS product record](https://astrogeology.usgs.gov/search/map/moon_selene_kaguya_tc_morning_global_mosaic_474m)

USGS catalogue IDs: `moon_lunar_orbiter_digital_photographic_global_mosaic_59m`, `moon_lunar_orbiter_clementine_uvvisv2_hybrid_mosaic_59m`, `moon_selene_kaguya_tc_global_orthomosaic_474m`, `moon_selene_kaguya_tc_evening_global_mosaic_474m`, `moon_selene_kaguya_tc_morning_global_mosaic_474m`.

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

3 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini ISS | [Moon](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Moon&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 56 | qualification |
| Hubble STIS | [Moon](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Moon&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 1 | qualification |
| Hubble WFPC2 | [Moon](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Moon&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 10 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
