# Titan: measured seasonal temperature by latitude

Proposal 34 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Titan's selected views do not include this seasonal surface-temperature series.

Present Cassini CIRS seasonal temperatures as explicitly latitude-averaged observations, using the existing date selector or chart contract.

Content owners: [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

## Evidence

The source describes 19 µm measurements at two-year intervals from 2004 to 2016, averaged over longitude. Black regions have no data.

## Work

Find the numeric latitude/time measurements and uncertainty, preserve averaging windows and missing latitudes, then select a compact sequence.

## Limits and prior decisions

This is not a longitude-resolved surface temperature map. A zonal mean can only be displayed as such; the date is an averaging interval, not an instantaneous global observation.

## Acceptance

Reproduce latitude profiles from native data, retain uncertainty and check date labels and missing regions. If only the animation is available, stop before integration.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/titan-temperature-lag-maps-and-animation/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA20020](https://science.nasa.gov/photojournal/titan-temperature-lag-maps-and-animation/) | candidate | Titan 2004–2016 CIRS temperatures are longitude-averaged latitude profiles at two-year intervals, not resolved longitude maps. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

1 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini CIRS | [Titan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Titan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 20546 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
