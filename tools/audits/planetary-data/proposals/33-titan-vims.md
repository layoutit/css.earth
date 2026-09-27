# Titan: observed infrared surface coverage

Proposal 33 · **Blocked by existing evidence** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Titan has current ISS, radar, terrain and geology. The ledger leaves the 2019 VIMS/ISS composite unresolved because filled pixels lack a validity mask.

Qualify a VIMS surface product that distinguishes observed spectral coverage from filled or seam-repaired areas.

Content owners: [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

## Evidence

The surface Photojournal pages discuss atmospheric/photometric correction and mosaics from many flybys. Their native masks remain essential. The separate atmospheric HCN observation is assigned to proposal 80.

## Work

Locate masks and native band or ratio products, identify footprints and source epochs, and document haze correction before selecting data.

## Limits and prior decisions

The new list does not remove the existing mask blocker. Apparent surface brightening is not proof of cryovolcanism. No synthetic global fill or atmospheric volume work.

## Acceptance

Measured coverage per band, common mask, calibration/photometry comparison, existing-ledger reopen evidence and fixed-scene registration.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/an-infrared-map-of-titan/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-titan-in-infrared/)
- [NASA source page](https://science.nasa.gov/photojournal/infrared-map-of-titans-active-regions/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/)
- [NASA source page](https://science.nasa.gov/photojournal/working-toward-seamless-infrared-maps-of-titan/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA02147](https://science.nasa.gov/photojournal/an-infrared-map-of-titan/) | candidate | Titan 1.6/2.01/5 µm mosaic combines two flybys and measures reflected light; it is not thermal emission or instantaneous global coverage. |
| [PIA07961](https://science.nasa.gov/photojournal/map-of-titan-in-infrared/) | candidate | October 2004 Titan VIMS swath ranges from tens of km to roughly 2 km pixels; preserve variable resolution and atmospheric correction. |
| [PIA11701](https://science.nasa.gov/photojournal/infrared-map-of-titans-active-regions/) | candidate | Titan VIMS brightness-change regions are a source lead, but cryovolcanism is a hypothesis and calibration/atmospheric effects must be controlled. |
| [PIA13696](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/) | candidate | Sotra Facula plate combines SAR footprints with VIMS context and a volcanic interpretation; qualify each data source and keep the interpretation conditional. |
| [PIA20022](https://science.nasa.gov/photojournal/working-toward-seamless-infrared-maps-of-titan/) | candidate | Titan synthetic VIMS views demonstrate seam/photometry processing over many flybys; the existing validity-mask blocker remains and native observed support is required. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

1 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini VIMS | [Titan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Titan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 115767 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
