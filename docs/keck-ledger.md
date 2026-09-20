# What Keck holds

Written by `tools/objects/keck/archive-ledger.mts` from the [Keck Observatory Archive](https://koa.ipac.caltech.edu) on 2026-09-19.
Every count is the archive's own, taken with one grouped query per instrument. Every state is worked out from the pinned
programs and the receipts beside them in `tools/objects/keck/programs`, not declared. 519 objects are shipped by this project.

## By instrument

| instrument | science frames | on shipped objects | objects | pipeline | state |
|---|---|---|---|---|---|
| DEIMOS | 73,524 | 306 | 17 | PypeIt keck_deimos | held |
| ESI | 35,305 | 222 | 8 | PypeIt keck_esi | held |
| GUIDER | not counted | 0 | 0 | none | held, not reducible |
| HIRES | 192,642 | 4,255 | 33 | none | held, not reducible |
| KCWI | 42,662 | 59 | 2 | KCWI DRP (kcwidrp) | reduced |
| KPF | 30,764 | 1,853 | 12 | KPF DRP | held |
| LRIS | 311,931 | 1,366 | 41 | PypeIt keck_lris_blue/_red | held |
| LWS | 20,766 | 969 | 13 | none | held, not reducible |
| MOSFIRE | 224,020 | 517 | 8 | PypeIt keck_mosfire | held |
| NIRC | 200,250 | 5,273 | 42 | none | held, not reducible |
| NIRC2 | 889,231 | 29,366 | 48 | KAI (Keck AO Imaging) | held |
| NIRES | 104,744 | 1,211 | 15 | PypeIt keck_nires | held |
| NIRSPEC | 1,544,474 | 186,622 | 58 | PypeIt keck_nirspec_high_old | pinned |
| OSIRIS | 101,653 | 3,180 | 19 | OSIRIS DRP | held, not reducible |

## Why each instrument is where it is

- **DEIMOS**: PypeIt supports it, but it is not installed here, and KOA publishes only JPEG quick-looks for DEIMOS, so a re-run would have no archive product to be checked against.
- **ESI**: PypeIt supports it; not installed here and KOA publishes no reduced product for it.
- **GUIDER**: Guider frames are pointing exposures, not observations. KOA's own count query for the table fails server-side (ORA-12899 on KOAID_ALLOWED), so its rows are not counted here.
- **HIRES**: PypeIt 2.0.1 lists keck_hires as not supported in its own spectrographs table, and no other open HIRES pipeline was found.
- **KCWI**: BSD-3-Clause, pure Python, installed here by toolchain.json; KOA publishes its own products of the same pipeline to check against. Pinned: m42-kcwi-2023b-u124.json. Receipts: m42-kcwi-2023b-u124.lev1-icubed.reproduction.json, m42-kcwi-2023b-u124.lev2-icubed.reproduction.json.
- **KPF**: The KPF DRP is open; it is not installed here and KPF observes no Solar System body this project ships.
- **LRIS**: PypeIt supports it; not installed here and KOA publishes no reduced product for it.
- **LWS**: LWS was retired and no open pipeline for it was found.
- **MOSFIRE**: PypeIt supports it; not installed here and KOA publishes no reduced product for it.
- **NIRC**: NIRC was retired in 2010 and no open pipeline for it was found.
- **NIRC2**: KAI 2.0.1 (2026-08-18) is BSD-3-Clause by its own licences/LICENSE.rst and setup.cfg, and needs only numpy, scipy, matplotlib, astropy, photutils, ccdproc and drizzle, with no IRAF or PyRAF; it is not installed here and that it runs was not verified. There is nothing to check a re-run against: of nine Europa frames asked of nph-getL1list across nine programmes, seven returned a log file and nothing else, two returned no file at all, and the two frames anywhere in NIRC2 that did return a reduced image state no pipeline, version or recipe in their headers at all (one says only that IDL wrote it). KOA's calibration association for a NIRC2 Europa frame is flats alone, with no darks and no sky frames, so even a consistency run would have to choose its own calibrations.
- **NIRES**: PypeIt supports it; not installed here and KOA publishes no reduced product for it.
- **NIRSPEC**: PypeIt 2.0.1 supports keck_nirspec_high, keck_nirspec_high_old (pre-2018 upgrade) and keck_nirspec_low (post-upgrade only), all BSD-3-Clause; it is not installed here. An archive product to check against exists for two Europa nights only: of thirteen Europa frames asked of nph-getL1list across eleven programmes, only 2006A returned any, and those are 1-D extracted spectra written by KOA's own NSDRP 0.9.16, a different pipeline from PypeIt, so agreement with them would be agreement between two pipelines and not a re-run of the archive's. Every other Europa programme, Paganini's water-vapour campaign included, has no archive product at all. Pinned: europa-nirspec-2006a-c213ol.json.
- **OSIRIS**: The OSIRIS DRP is written in IDL, which is commercial and is not on this machine. KOA publishes its own OSIRIS level-1 cubes, and each states its whole recipe in DRF comment cards, so they can be pinned and read but not remade.

## Shipped objects Keck observed

Science frames only, matched from the observer's own target name. A name carrying a minor-planet number matches only an id
carrying the same number, so 52 Europa is not Jupiter's moon.

| object | frames | instruments |
|---|---|---|
| jupiter | 80,469 | NIRSPEC 77,465, HIRES 1,640, NIRC2 632, NIRC 570, LWS 134, KPF 17, LRIS 7, ESI 2, NIRES 2 |
| saturn | 29,678 | NIRSPEC 29,007, LWS 266, NIRC 254, NIRC2 78, HIRES 52, LRIS 16, KPF 3, MOSFIRE 2 |
| uranus | 20,967 | NIRSPEC 11,924, NIRC2 8,196, OSIRIS 291, NIRC 192, NIRES 172, KPF 117, LWS 45, MOSFIRE 17, HIRES 5, LRIS 5, DEIMOS 3 |
| pluto | 14,794 | NIRSPEC 13,264, NIRC2 545, NIRC 504, OSIRIS 401, DEIMOS 54, HIRES 17, LRIS 6, LWS 3 |
| titan | 14,391 | NIRSPEC 8,292, NIRC2 3,646, OSIRIS 1,352, NIRC 1,022, LWS 71, HIRES 8 |
| trappist-1 | 10,377 | NIRSPEC 10,377 |
| europa | 10,164 | NIRSPEC 8,444, NIRC2 894, HIRES 660, NIRC 77, KPF 46, OSIRIS 41, NIRES 2 |
| io | 10,020 | NIRC2 5,619, NIRSPEC 2,881, HIRES 735, NIRC 343, OSIRIS 305, LWS 80, NIRES 44, KPF 13 |
| neptune | 9,806 | NIRC2 5,666, NIRSPEC 2,358, NIRC 961, OSIRIS 500, LWS 303, NIRES 9, DEIMOS 8, LRIS 1 |
| hd-189733 | 8,039 | NIRSPEC 7,680, LRIS 205, HIRES 119, NIRC2 35 |
| mars | 5,892 | NIRSPEC 5,461, NIRC2 350, NIRC 75, DEIMOS 2, HIRES 2, LRIS 2 |
| wasp-43 | 2,836 | NIRSPEC 2,460, MOSFIRE 349, NIRC2 24, HIRES 2, KPF 1 |
| sun | 1,595 | KPF 1,595 |
| ganymede | 1,246 | NIRC2 562, HIRES 439, NIRSPEC 225, OSIRIS 13, KPF 7 |
| psyche | 1,177 | NIRSPEC 1,002, NIRC2 157, OSIRIS 18 |
| callisto | 1,163 | NIRC2 1,043, NIRSPEC 47, OSIRIS 38, HIRES 23, KPF 12 |
| kalliope | 1,050 | NIRSPEC 924, NIRC2 126 |
| juno | 783 | NIRSPEC 670, OSIRIS 49, NIRC2 45, NIRC 9, HIRES 7, LRIS 3 |
| eris | 744 | NIRES 702, LRIS 42 |
| quaoar | 665 | NIRSPEC 553, NIRC 100, LRIS 12 |
| ceres | 611 | NIRSPEC 441, NIRC2 87, LRIS 59, HIRES 20, LWS 4 |
| triton | 582 | NIRSPEC 387, NIRC 123, NIRC2 39, OSIRIS 33 |
| vesta | 544 | NIRSPEC 274, NIRC2 104, HIRES 82, LRIS 52, OSIRIS 32 |
| makemake | 530 | LRIS 348, NIRSPEC 182 |
| eunomia | 424 | NIRSPEC 419, HIRES 5 |
| moon | 324 | ESI 113, MOSFIRE 67, LRIS 64, HIRES 53, NIRC 10, NIRC2 9, NIRSPEC 6, KCWI 2 |
| didymos | 316 | NIRSPEC 306, HIRES 10 |
| eurybates | 301 | NIRC2 300, NIRES 1 |
| mercury | 293 | HIRES 176, NIRSPEC 35, KPF 34, ESI 23, LRIS 12, LWS 7, NIRC 6 |
| himalia | 274 | NIRSPEC 126, NIRES 78, NIRC 70 |
| m31 | 231 | NIRC2 63, DEIMOS 62, LRIS 47, MOSFIRE 23, ESI 21, LWS 13, NIRES 2 |
| m1 | 214 | NIRC2 56, LRIS 45, MOSFIRE 33, NIRC 31, LWS 26, HIRES 19, ESI 3, DEIMOS 1 |
| m33 | 213 | DEIMOS 78, NIRC 35, ESI 29, HIRES 28, NIRC2 28, LRIS 15 |
| deimos | 209 | NIRC2 209 |
| phoebe | 191 | NIRC 92, NIRSPEC 69, LRIS 16, NIRES 14 |
| iris | 160 | NIRC2 129, NIRSPEC 17, OSIRIS 8, HIRES 5, LWS 1 |
| hygiea | 156 | NIRSPEC 155, HIRES 1 |
| pallas | 153 | NIRSPEC 128, OSIRIS 23, HIRES 2 |
| iapetus | 140 | NIRSPEC 114, NIRC 26 |
| venus | 138 | HIRES 120, ESI 14, NIRC 4 |

127 objects matched in all; the rest are in [the ledger](../data/keck/ledger.json).
