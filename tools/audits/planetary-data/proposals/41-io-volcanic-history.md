# Io: dated volcanic changes and thermal observations

Proposal 41 · **Qualification first** · Priority 2 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Io already has a JIRAM volcanic-heat view from orbits 41, 43, 47 and 49, with 22% measured coverage. The current hotspot table serves as validation, not a second live lens.

Add qualified dated observations of surface change or heat that are distinct from the existing JIRAM map.

Content owners: [io](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/io/README.md)

## Evidence

PIA26526 identifies JunoCam observations from April, October and December 2024 with different resolutions. Older Galileo pages show PPR temperatures and observed surface changes.

## Work

Recover native JunoCam/SSI/PPR observations, keep epochs and instrument quantities separate, and compare registered common footprints. Assess later JIRAM observations under the current ledger. Treat the 242-volcano historical reconstruction and heat-flow model as separate interpreted products requiring their original numeric data; do not revive the retired point-symbol lens.

## Limits and prior decisions

Different brightness processing is not proof of change. PPR temperature and JIRAM radiance are not interchangeable. The PPR night map warns that some edge temperatures may be spurious.

## Acceptance

Matched registration and resolution, common-footprint masks, native radiometry and source-time labels. Do not replace measured heat with a modeled prediction from PIA16941.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/io-shown-in-lambertian-equal-area-projection-and-in-approximately-natural-color/)
- [NASA source page](https://science.nasa.gov/photojournal/global-mercator-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/io-cylindrical-projection/)
- [NASA source page](https://science.nasa.gov/photojournal/high-resolution-global-view-of-io/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-io-in-various-colors/)
- [NASA source page](https://science.nasa.gov/photojournal/color-global-mosaic-of-io/)
- [NASA source page](https://science.nasa.gov/photojournal/resurfacing-of-the-jupiter-facing-hemisphere-of-io/)
- [NASA source page](https://science.nasa.gov/photojournal/ios-pele-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/voyager-to-galileo-changes-ios-anti-jove-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-io-natural-and-falseenhanced-color/)
- [NASA source page](https://science.nasa.gov/photojournal/color-mosaic-and-active-volcanic-plumes-on-io/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-io/)
- [NASA source page](https://science.nasa.gov/photojournal/ios-kanehekili-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/changes-on-ios-loki-pele-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/highest-resolution-mosaic-of-io/)
- [NASA source page](https://science.nasa.gov/photojournal/ios-pele-hemisphere-after-pillan-changes/)
- [NASA source page](https://science.nasa.gov/photojournal/io-southern-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/io-2x2-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/galileo-ppr-temperature-maps-of-loki-in-october-1999/)
- [NASA source page](https://science.nasa.gov/photojournal/temperature-map-of-ios-night-side/)
- [NASA source page](https://science.nasa.gov/photojournal/temperature-map-of-pele-io/)
- [NASA source page](https://science.nasa.gov/photojournal/io-predicted-heat-flow-map/)
- [NASA source page](https://science.nasa.gov/photojournal/map-of-ios-volcanic-heat-flow/)
- [NASA source page](https://science.nasa.gov/photojournal/ios-new-southern-hemisphere-hotspot/)
- [NASA source page](https://science.nasa.gov/photojournal/three-views-of-ios-southern-hemisphere/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00318](https://science.nasa.gov/photojournal/io-shown-in-lambertian-equal-area-projection-and-in-approximately-natural-color/) | candidate | Voyager equal-area Io hemispheres can anchor a historical surface-change comparison if source color and registration are recovered. |
| [PIA00319](https://science.nasa.gov/photojournal/global-mercator-mosaic/) | candidate | Voyager Mercator mosaic covers ±60° and a limited longitude range; a historical Io observation candidate with explicit footprint. |
| [PIA00401](https://science.nasa.gov/photojournal/io-cylindrical-projection/) | candidate | Voyager Io multispectral cube appears as natural/enhanced/ratio panels; recover its original bands once, rather than count three independent surveys. |
| [PIA00583](https://science.nasa.gov/photojournal/high-resolution-global-view-of-io/) | candidate | Galileo Io hemisphere offers a dated visible baseline at about 2.5 km resolvable scale; compare with current maps only on common support. |
| [PIA00584](https://science.nasa.gov/photojournal/global-view-of-io-in-various-colors/) | candidate | Near-zero-phase Io filter composites can support spectral/photometric comparison; the natural and enhanced panels are variants of related observations. |
| [PIA00585](https://science.nasa.gov/photojournal/color-global-mosaic-of-io/) | candidate | 1996 Io cylindrical composite merges July and September observations and includes grid lines; recover undecorated source bands and retain its multi-epoch identity. |
| [PIA00712](https://science.nasa.gov/photojournal/resurfacing-of-the-jupiter-facing-hemisphere-of-io/) | candidate | Voyager/Galileo Jupiter-facing comparison provides actual 1979/1996 surface-change leads; use original frames and common resolution rather than the four-panel plate. |
| [PIA00718](https://science.nasa.gov/photojournal/ios-pele-hemisphere/) | candidate | Pele comparison uses different filter sets on Voyager and Galileo; retain bandpass differences before attributing color differences to activity. |
| [PIA01063](https://science.nasa.gov/photojournal/voyager-to-galileo-changes-ios-anti-jove-hemisphere/) | candidate | Reprojected 1979/1996 Io comparison gives an explicit surface-change experiment; recover original filter calibration and common resolution. |
| [PIA01064](https://science.nasa.gov/photojournal/global-view-of-io-natural-and-falseenhanced-color/) | candidate | Natural/enhanced Io panels share a September 1996 near-IR/green/violet set; useful dated color, not two independent observations. |
| [PIA01081](https://science.nasa.gov/photojournal/color-mosaic-and-active-volcanic-plumes-on-io/) | candidate | Io C9 color records dated surface and plume activity; surface comparison is in scope, rendering an extended plume is not. |
| [PIA01108](https://science.nasa.gov/photojournal/mosaic-of-io/) | candidate | Io C3 simple-cylindrical mosaic is a broad dated photographic baseline; remove only presentation overlays using original data, not invented pixels. |
| [PIA01220](https://science.nasa.gov/photojournal/ios-kanehekili-hemisphere/) | candidate | Kanehekili C9 color hemisphere is a dated activity observation, with plume/thermal interpretations requiring their original supporting measurements. |
| [PIA01223](https://science.nasa.gov/photojournal/changes-on-ios-loki-pele-hemisphere/) | candidate | E6 Loki/Pele observation was designed to monitor color change; compare its common footprint and calibration with earlier Galileo epochs. |
| [PIA01663](https://science.nasa.gov/photojournal/highest-resolution-mosaic-of-io/) | candidate | Multi-orbit low-sun Io mosaic emphasizes relief; it is a historical photographic product, not numeric terrain or a single observation time. |
| [PIA01667](https://science.nasa.gov/photojournal/ios-pele-hemisphere-after-pillan-changes/) | candidate | Io's G10 Pele hemisphere follows the Pillan changes; useful for a registered dated sequence rather than another timeless global color map. |
| [PIA02250](https://science.nasa.gov/photojournal/io-southern-hemisphere/) | candidate | Io southern terminator photograph supplies shadow/terrain context at one geometry; do not derive a numeric height field from the press image. |
| [PIA02294](https://science.nasa.gov/photojournal/io-2x2-mosaic/) | candidate | Voyager four-image Io color mosaic is a 1979 baseline, conditional on original bands, registration and comparison with later epochs. |
| [PIA02524](https://science.nasa.gov/photojournal/galileo-ppr-temperature-maps-of-loki-in-october-1999/) | candidate | Galileo PPR maps of Loki's October 1999 eruption measure thermal behavior distinct from later JIRAM radiance; retain epoch and physical units. |
| [PIA02548](https://science.nasa.gov/photojournal/temperature-map-of-ios-night-side/) | candidate | Io night-temperature mosaic combines November 1999 and February 2000; keep spurious-edge warning and separate encounters from one instantaneous map. |
| [PIA02560](https://science.nasa.gov/photojournal/temperature-map-of-pele-io/) | candidate | Pele February 2000 infrared temperature overlay uses 1979 visible context; the thermal footprint must not inherit the background's apparent resolution or epoch. |
| [PIA16941](https://science.nasa.gov/photojournal/io-predicted-heat-flow-map/) | candidate | Two Io tidal-heating predictions are model-comparison leads only; they must remain distinct from observed PPR/JIRAM heat and cannot replace measured coverage. |
| [PIA19655](https://science.nasa.gov/photojournal/map-of-ios-volcanic-heat-flow/) | candidate | Io's 242-volcano heat-flow reconstruction is historical derived data, despite the supplied Jupiter tag; compare methodology with current JIRAM and do not revive the retired hotspot-symbol lens. |
| [PIA22600](https://science.nasa.gov/photojournal/ios-new-southern-hemisphere-hotspot/) | candidate | December 2017 JIRAM southern hotspot is a dated thermal source outside the selected later orbit set; qualify native radiance and footprint before extension. |
| [PIA26526](https://science.nasa.gov/photojournal/three-views-of-ios-southern-hemisphere/) | candidate | Io April/October/December 2024 JunoCam comparisons have unequal resolutions; native common-footprint qualification can support real volcanic surface-change content. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

11 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini ISS | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 600 | qualification |
| Cassini UVIS | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 29 | qualification |
| Cassini VIMS | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 296 | qualification |
| Galileo SSI | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 847 | qualification |
| Hubble ACS | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+ACS&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 341 | qualification |
| Hubble NICMOS | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 178 | qualification |
| Hubble STIS | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 282 | qualification |
| Hubble WFPC2 | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 332 | qualification |
| New Horizons LORRI | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+LORRI&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 179 | qualification |
| New Horizons MVIC | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 68 | qualification |
| Voyager ISS | [Io](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Io&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 851 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
