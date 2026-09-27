# Titan: dated ISS and radar observations

Proposal 69 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Titan already uses the USGS 2026 ISS map, mission-end SAR, terrain and geology. Historical cumulative mosaics often add no independent coverage.

Qualify actual dated observations that support a useful regional or temporal comparison, including radar lake observations.

Content owners: [titan](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/titan/README.md)

## Evidence

The supplied set spans 2004–2015 releases, individual flybys, cumulative maps and Sotra terrain. PIA19658 was published in 2015 but its source observations end in April 2014.

## Work

Resolve each exposure interval, recover native bands and SAR geometry, separate cumulative-map revisions from observations, and compare on common support.

## Limits and prior decisions

Atmospheric correction and changing look angle can mimic surface changes. VIMS spectra belong in proposal 33; mapped geological units belong in 70.

## Acceptance

Actual observing dates, instrument units, registration, masks and any change claim tested against processing and viewing differences.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/titan-mosaic-october-2004/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-mosaic-december-2004/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-mosaic-feb-2005/)
- [NASA source page](https://science.nasa.gov/photojournal/tracing-surface-features-on-titan-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-mosaic-east-of-xanadu/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-titan-december-2006/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-titan-october-2007/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-t28-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/radar-sees-lakes-in-titans-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/topographic-map-of-titans-north-polar-region/)
- [NASA source page](https://science.nasa.gov/photojournal/saturns-view-of-titans-trailing-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/maps-of-titan-january-2009/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-titan-february-2009/)
- [NASA source page](https://science.nasa.gov/photojournal/infrared-map-of-titans-active-regions/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-titan-april-2011/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-polar-maps-2015/)
- [NASA source page](https://science.nasa.gov/photojournal/titan-global-map-june-2015/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA06158](https://science.nasa.gov/photojournal/titan-mosaic-october-2004/) | candidate | Titan October 2004 28-image footprint set could support a dated ISS comparison with original haze treatment and measured regional coverage. |
| [PIA06159](https://science.nasa.gov/photojournal/titan-mosaic-december-2004/) | candidate | December 2004 Titan mosaic is a second regional epoch overlapping October; compare common support rather than mix dates into a change map. |
| [PIA06185](https://science.nasa.gov/photojournal/titan-mosaic-feb-2005/) | candidate | February 2005 Titan sixteen-image set has explicit haze and terminator processing; qualify those corrections before any seasonal surface comparison. |
| [PIA06203](https://science.nasa.gov/photojournal/tracing-surface-features-on-titan-mosaic/) | candidate | July 2004 Titan south-polar mosaic is contrast-enhanced; only native calibration can support comparison with later brightness changes. |
| [PIA06222](https://science.nasa.gov/photojournal/titan-mosaic-east-of-xanadu/) | candidate | East-of-Xanadu mosaic combines narrow- and wide-angle imaging with different resolution; keep their individual spatial support. |
| [PIA08346](https://science.nasa.gov/photojournal/map-of-titan-december-2006/) | candidate | Titan December 2006 ISS 938 nm release can help trace observing epochs, but a cumulative map is not itself an instantaneous historical surface. |
| [PIA08399](https://science.nasa.gov/photojournal/map-of-titan-october-2007/) | candidate | Titan 2007 cumulative ISS 938 nm mosaic offers source-lineage context for a time study; recover constituent observation times before comparing surface change. |
| [PIA08945](https://science.nasa.gov/photojournal/titan-t28-mosaic/) | candidate | Titan T28 April 2007 northern trailing-hemisphere mosaic offers a specific dated regional footprint for a controlled ISS comparison. |
| [PIA10018](https://science.nasa.gov/photojournal/radar-sees-lakes-in-titans-southern-hemisphere/) | candidate | Titan southern lake radar observation is a dated footprint that may support change/feature context beyond a mission-end composite; recover original SAR data. |
| [PIA10353](https://science.nasa.gov/photojournal/topographic-map-of-titans-north-polar-region/) | candidate | Titan north-polar stereo topography may offer regional information beyond the selected mission-end GTDR; compare native measured support and uncertainty first. |
| [PIA10536](https://science.nasa.gov/photojournal/saturns-view-of-titans-trailing-hemisphere/) | candidate | November 2008 Titan 938 nm image is a dated ISS observation with partial illumination; potential common-footprint comparison, not a new global map. |
| [PIA11146](https://science.nasa.gov/photojournal/maps-of-titan-january-2009/) | candidate | Titan January 2009 cumulative map incorporates August 2008 northern imaging; recover constituent epochs before a historical ISS comparison. |
| [PIA11149](https://science.nasa.gov/photojournal/map-of-titan-february-2009/) | candidate | February 2009 Titan 938 nm map is another cumulative release; qualification must separate new footprints from processing/version changes. |
| [PIA11701](https://science.nasa.gov/photojournal/infrared-map-of-titans-active-regions/) | candidate | Titan VIMS brightness-change regions are a source lead, but cryovolcanism is a hypothesis and calibration/atmospheric effects must be controlled. |
| [PIA13696](https://science.nasa.gov/photojournal/global-view-of-sotra-facula-titan/) | candidate | Sotra Facula plate combines SAR footprints with VIMS context and a volcanic interpretation; qualify each data source and keep the interpretation conditional. |
| [PIA14908](https://science.nasa.gov/photojournal/map-of-titan-april-2011/) | candidate | Titan April 2011 ISS cumulative 938 nm map supports observation-lineage work; a publication date is not a simultaneous surface snapshot. |
| [PIA19657](https://science.nasa.gov/photojournal/titan-polar-maps-2015/) | duplicate-family | Titan 2015 polar maps reproject the cumulative ISS source; only original dated observations, not map projections, can support a temporal comparison. |
| [PIA19658](https://science.nasa.gov/photojournal/titan-global-map-june-2015/) | candidate | Titan June 2015 ISS map uses data only through April 2014 T100; record observation cutoff separately from publication and compare with current 2026 mapping. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

5 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini ISS | [Titan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Titan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 45170 | qualification |
| Hubble ACS | [Titan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Titan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 490 | qualification |
| Hubble NICMOS | [Titan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Titan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 212 | qualification |
| Hubble WFPC2 | [Titan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Titan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 260 | qualification |
| Voyager ISS | [Titan](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Titan&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 926 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
