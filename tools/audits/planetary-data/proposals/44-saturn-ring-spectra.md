# Saturn rings: qualify radial spectral measurements

Proposal 44 · **Blocked by existing evidence** · Priority 3 · 27 September 2026

Compared with cssEarth at [60ef02395df5](https://github.com/layoutit/css.earth/tree/60ef02395df5c466027b8a70214b09cbc1afc570). Proposed work only; original-source availability and scientific qualification are distinguished below.

## Problem and proposed result

Ring opacity uses a measured UVIS profile, but radius-indexed color is unresolved. Perspective Photojournal images do not meet that requirement.

Find a calibrated radius-indexed VIMS spectral profile that can be prepared within the existing ring contract, or record why it cannot.

Content owners: [saturn](https://github.com/layoutit/css.earth/blob/60ef02395df5c466027b8a70214b09cbc1afc570/src/objects/saturn/README.md)

## Evidence

PIA23170 shows spectral variation across A, B and C rings. Its colors mix ice purity and grain-size effects and are not a ready radial measurement file.

## Work

Trace the native VIMS scan and geometry, preserve radial resolution and quality flags, then check whether current prepared ring assets can represent the qualified quantity.

## Limits and prior decisions

No renderer or ring-topology changes. If the existing contract cannot support the result, keep an evidence-only PR. Do not infer grain size or abundance from press RGB values.

## Acceptance

Published radial calibration and uncertainty, scan-to-radius mapping, current-contract feasibility and no regression in the selected opacity profile.

Follow the [shared scope and acceptance contract](contract.md). This proposal contains no renderer changes. A qualification failure stays an explicit evidence-backed source decision.

## Sources

- [NASA source page](https://science.nasa.gov/photojournal/two-image-mosaic-of-saturns-rings/)
- [NASA source page](https://science.nasa.gov/photojournal/mosaic-of-saturns-rings/)
- [NASA source page](https://science.nasa.gov/photojournal/the-atlas-ring/)
- [NASA source page](https://science.nasa.gov/photojournal/infrared-eye-yields-new-spectral-map/)

## Individual Photojournal entries

Every row below was separately reviewed. A related variant belongs to this work without becoming another dataset.

| ID | Decision | Specific reason |
| --- | --- | --- |
| [PIA02227](https://science.nasa.gov/photojournal/two-image-mosaic-of-saturns-rings/) | candidate | Voyager ring mosaic offers a geometric/profile lead, but perspective brightness does not solve the missing calibrated radius-indexed color source. |
| [PIA02242](https://science.nasa.gov/photojournal/mosaic-of-saturns-rings/) | candidate | Underside Cassini-Division imagery is a ring-scattering observation lead; radial geometry and viewing-side calibration differ from face-on reflectance. |
| [PIA06113](https://science.nasa.gov/photojournal/the-atlas-ring/) | candidate | New narrow-ring observation near Atlas is a source lead for radial support, not calibrated opacity/color; require native geometry and a valid profile. |
| [PIA23170](https://science.nasa.gov/photojournal/infrared-eye-yields-new-spectral-map/) | candidate | Saturn VIMS ring colors combine ice/grain-size sensitivity; require calibrated radial spectra and current-contract feasibility, not palette inversion. |

[All proposals](README.md) · [Every Photojournal entry](../photojournal-audit.md) · [Coverage ledger](../evidence/previous-audits.json)

<!-- opus:start -->
## OPUS extension: 27 September 2026

8 instrument/target slices connect to this work at [f1493dccc15d](https://github.com/layoutit/css.earth/tree/f1493dccc15df52aaf55b7c8fc1c6dcec0d1eee3). These are catalogue records, including channels/derived products; they are not unique exposures or qualified coverage. Enceladus surface VIMS is now merged and remains separate from CIRS and UVIS work. The older proposal text above retains its original comparison revision.

| Instrument | Intended target | Records | Decision |
| --- | --- | ---: | --- |
| Cassini CIRS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+CIRS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 31656 | qualification |
| Cassini ISS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+ISS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 113394 | qualification |
| Cassini UVIS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+UVIS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 8250 | qualification |
| Cassini VIMS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Cassini+VIMS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 161187 | qualification |
| Hubble NICMOS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+NICMOS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 156 | qualification |
| Hubble STIS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+STIS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 20 | qualification |
| Hubble WFPC2 | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Hubble+WFPC2&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 195 | qualification |
| Voyager ISS | [Saturn Rings](https://opus.pds-rings.seti.org/opus/api/data.json?instrument=Voyager+ISS&target=Saturn+Rings&cols=opusid%2Cmission%2Cinstrument%2Ctarget%2Ctime1%2Ctime2%2Cbundleid%2Cdatasetid%2Cprimaryfilespec%2Cobservationtype%2Cquantity%2Cgreaterpixelsize%2Clesserpixelsize%2Cwavelength1%2Cwavelength2&order=time1%2Copusid&limit=2) | 2219 | qualification |

Every source-slice reason is retained in [the OPUS ledger](../evidence/opus-review.tsv). [All proposals](README.md).
<!-- opus:end -->
