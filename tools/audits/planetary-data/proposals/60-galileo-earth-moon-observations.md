# Earth and Moon: historical Galileo spectral observations

Proposal 60 · **Qualification first** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Modern global maps already supply better basemap detail. Galileo offers a different observing epoch or wavelength, not an automatic replacement.

Qualify a compact set of dated Galileo Earth/Moon bands where the scientific difference is useful.

Content owners: [earth](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/earth/README.md), [moon](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/moon/README.md)

## Evidence

The supplied entries include an Antarctic limb mosaic, green and near-infrared lunar imagery, Andes observations and a 24-hour Earth mosaic. Their geometry and time support differ.

## Work

Group exposures by actual encounter and band; retrieve native calibrated values, poses and footprints; preserve observation intervals.

## Limits and prior decisions

A 24-hour mosaic is not simultaneous Earth illumination. Never wrap an unregistered camera image onto the whole globe or introduce a photograph gallery.

## Acceptance

Registration, band response, dates, view geometry and common support for any comparison.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/earth-antarctica-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-western-hemisphere/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-18-image-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-false-color-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-north-pole-mosaic/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-false-color-mosaic-2/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-false-color-mosaic-3/)
- [NASA source page](https://science.nasa.gov/photojournal/earth-false-color-mosaic-of-the-andes/)
- [NASA source page](https://science.nasa.gov/photojournal/global-view-of-earth-in-the-near-infrared/)
- [NASA source page](https://science.nasa.gov/photojournal/moon-north-polar-mosaic-color/)
- [NASA source page](https://science.nasa.gov/photojournal/south-polar-projection-of-earth/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA00116](https://science.nasa.gov/photojournal/earth-antarctica-mosaic/) | candidate | Galileo Antarctica limb mosaic is a dated three-filter Earth observation; useful only as a historical observation with its original camera geometry. |
| [PIA00120](https://science.nasa.gov/photojournal/moon-western-hemisphere/) | candidate | Galileo green-filter lunar hemisphere is a historical wavelength/epoch observation; not a resolution upgrade over LROC. |
| [PIA00128](https://science.nasa.gov/photojournal/moon-18-image-mosaic/) | candidate | Eighteen-image December 1992 lunar mosaic has enhanced dark-region brightness; retain original processing and treat as an observing set, not calibrated albedo. |
| [PIA00129](https://science.nasa.gov/photojournal/moon-false-color-mosaic/) | candidate | Galileo lunar false-color composite shows spectral contrasts; could support a historical band comparison, but cannot supply numeric titanium abundance. |
| [PIA00130](https://science.nasa.gov/photojournal/moon-north-pole-mosaic/) | candidate | North-polar Galileo mosaic has a shadowed pole and partial coverage; preserve that footprint and deduplicate its 18 input frames. |
| [PIA00131](https://science.nasa.gov/photojournal/moon-false-color-mosaic-2/) | candidate | Fifty-three-frame lunar color mosaic is a separate product variant requiring observation-ID overlap checks with the other Galileo lunar mosaics. |
| [PIA00132](https://science.nasa.gov/photojournal/moon-false-color-mosaic-3/) | candidate | Fifteen-image lunar false-color composite from December 1992 could supply a dated spectral example; no unique composition grid is provided. |
| [PIA00133](https://science.nasa.gov/photojournal/earth-false-color-mosaic-of-the-andes/) | candidate | Galileo Andes green/near-IR mosaic distinguishes surface colors regionally; needs original bands and geometry and is not a modern global vegetation map. |
| [PIA00226](https://science.nasa.gov/photojournal/global-view-of-earth-in-the-near-infrared/) | candidate | Single December 1990 1 µm Earth image has a distinct band and epoch, but only a visible hemisphere and perspective geometry. |
| [PIA00404](https://science.nasa.gov/photojournal/moon-north-polar-mosaic-color/) | duplicate-family | North-polar lunar presentation reuses Galileo's December 1992 18-frame observing set; compare with PIA00130 before selecting a variant. |
| [PIA00729](https://science.nasa.gov/photojournal/south-polar-projection-of-earth/) | candidate | Earth south-polar composite spans 24 hours and depicts an impossible simultaneous illumination; any historical view must state that mosaic interval. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

6 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini ISS | [Earth](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Earth&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 13 | qualification |
| Cassini UVIS | [Earth](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Earth&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 176 | qualification |
| Cassini VIMS | [Earth](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Earth&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 16 | qualification |
| Galileo SSI | [Earth](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Earth&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 5691 | qualification |
| Galileo SSI | [Moon](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Galileo+SSI&target=Moon&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2023 | qualification |
| New Horizons MVIC | [Earth](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=New+Horizons+MVIC&target=Earth&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 58 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
