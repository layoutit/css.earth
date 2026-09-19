# Hubble ledger

What Hubble's public archive holds, what this repository can re-calibrate from raw, whose archive-final products it has pinned and read, and which of the objects it ships Hubble has observed. Written by [`archive-ledger.mts`](../tools/objects/hst/archive-ledger.mts) from MAST on 2026-09-19; the routes it checks are in [Hubble](hubble.md).

The collection holds 1,492,979 public observations. The configurations below account for 1,492,029; 950 are in configurations this file does not name. 51,498 observations are of moving targets, which is the Solar System.

## Configurations

Two capabilities, kept apart. **Re-calibrated here** is whether a pipeline for the configuration is in the pinned toolchain and whether a program of it has been re-run and checked against the archive's own product. **Archive-final products** is whether the archive's own final product for an observation has been pinned, downloaded and read here. Retiring an instrument takes the first away and leaves the second: the archive still distributes a complete calibrated product for every WFPC2, FOS and GHRS observation, and this ledger says so rather than reporting those configurations as empty.

| Configuration | Observations | Of moving targets | Records | Re-calibrated here | Archive-final products |
| --- | ---: | ---: | --- | --- | --- |
| ACS/WFC | 174,029 | 482 | wide-field pictures, 0.35–1.1 µm | a pipeline is installed, none run | not pinned |
| ACS/HRC | 35,937 | 2,234 | high-resolution pictures and slitless spectra | a pipeline is installed, none run. The detector stopped working in 2007. | not pinned |
| ACS/SBC | 9,540 | 885 | far-ultraviolet pictures and prism spectra | europa-11085 | not pinned |
| WFC3/UVIS | 206,612 | 23,542 | pictures, 0.2–1 µm | europa-15419 | not pinned |
| WFC3/IR | 256,117 | 1,046 | pictures and slitless spectra, 0.8–1.7 µm | a pipeline is installed, none run | not pinned |
| STIS/CCD | 210,165 | 4,226 | spectra and pictures, 0.2–1 µm | europa-14650, europa-15419 | not pinned |
| STIS/NUV-MAMA | 12,742 | 483 | near-ultraviolet spectra and pictures | a pipeline is installed, none run | not pinned |
| STIS/FUV-MAMA | 14,982 | 1,743 | far-ultraviolet spectra and pictures | europa-13040 | not pinned |
| STIS | 8,164 | 145 | co-added spectra the archive builds from several visits (HASP) | A product of products; there is no raw exposure to re-calibrate. | not pinned |
| COS/FUV | 27,302 | 193 | far-ultraviolet point-source spectra | calcos is not installed. | not pinned |
| COS/NUV | 13,863 | 289 | near-ultraviolet point-source spectra | calcos is not installed. | not pinned |
| WFPC2/PC | 202,677 | 8,746 | pictures on the planetary camera, 1994–2009 | calwp2 is retired and not in hstcal. | qualified: europa-wfpc2-11085 |
| WFPC2/WFC | 20,292 | 2,327 | pictures on the three wide-field chips | calwp2 is retired and not in hstcal. | not pinned |
| WFPC2 | 35,523 | 0 | WFPC2 products the catalogue does not assign to a chip | no pipeline here | not pinned |
| NICMOS/NIC1 | 26,812 | 398 | near-infrared pictures at the finest sampling | calnica is retired and not in hstcal. | not pinned |
| NICMOS/NIC2 | 40,531 | 903 | near-infrared pictures and coronagraphy | calnica is retired and not in hstcal. | not pinned |
| NICMOS/NIC3 | 47,611 | 120 | near-infrared pictures and grism spectra | calnica is retired and not in hstcal. | not pinned |
| FOC/96 | 5,441 | 249 | faint-object camera pictures, 1990–2002 | Its pipeline is retired. | not pinned |
| FOC/48 | 1,254 | 4 | faint-object camera pictures in its other format | Its pipeline is retired. | not pinned |
| FOS/BL | 11,180 | 579 | faint-object spectrograph, blue detector, 1990–1997 | Its pipeline is retired. | qualified: europa-fos-5837 |
| FOS/RD | 12,200 | 599 | faint-object spectrograph, red detector, 1990–1997 | Its pipeline is retired. | not pinned |
| WFPC/PC | 9,520 | 463 | the first wide-field camera, 1990–1993 | Its pipeline is retired. | not pinned |
| ACS | 12,218 | 0 | ACS products the catalogue does not assign to a detector | no pipeline here | not pinned |
| COS-STIS | 875 | 0 | co-added spectra the archive builds from COS and STIS visits together (HASP) | A product of products. | not pinned |
| COS | 8,247 | 77 | COS products the catalogue does not assign to a detector | no pipeline here | not pinned |
| HRS | 3,703 | 177 | the Goddard high resolution spectrograph, 1990–1997 | Its pipeline is retired. | not pinned |
| HRS/1 | 6,424 | 710 | the same spectrograph on its first detector | Its pipeline is retired. | qualified: europa-ghrs-5376 |
| HRS/2 | 14,122 | 610 | the same spectrograph on its second detector | Its pipeline is retired. | not pinned |
| HSP/UNK/POL | 1,505 | 12 | the high speed photometer, polarimetry, 1990–1993 | no pipeline here | not pinned |
| HSP/UNK/UV1 | 1,025 | 0 | the high speed photometer, first ultraviolet channel | no pipeline here | not pinned |
| HSP/UNK/UV2 | 1,064 | 0 | the high speed photometer, second ultraviolet channel | no pipeline here | not pinned |
| HSP/UNK/VIS | 687 | 52 | the high speed photometer, visible channel | no pipeline here | not pinned |
| WFPC/WFC | 6,226 | 93 | the first wide-field camera, wide-field chips | Its pipeline is retired. | not pinned |
| FGS | 53,439 | 0 | fine guidance sensor astrometry and interferometry | no pipeline here | not pinned |

Re-calibrated and checked against the archive's own product: ACS/SBC (europa-11085); WFC3/UVIS (europa-15419); STIS/CCD (europa-14650, europa-15419); STIS/FUV-MAMA (europa-13040).
Archive-final products pinned, downloaded and read whole: WFPC2/PC (europa-wfpc2-11085); FOS/BL (europa-fos-5837); HRS/1 (europa-ghrs-5376). None of those is a re-calibration, and none of them is counted as one: what the route establishes is in [Hubble](hubble.md#archive-final-products-of-retired-instruments).
Every other configuration is counted here and nothing more.

## Moving targets

Every public moving-target observation, matched to a shipped object by name. A pointing at the sky beside a body, at a guide star or at a calibration lamp is not an object.

| Object | Observations | Configurations |
| --- | ---: | --- |
| jupiter | 6,338 | ACS/HRC, ACS/SBC, ACS/WFC, FOC/96, FOS/BL, FOS/RD, HRS, HRS/1, HRS/2, NICMOS/NIC1, NICMOS/NIC2, NICMOS/NIC3, STIS, STIS/CCD, STIS/FUV-MAMA, WFC3/UVIS, WFPC/PC, WFPC/WFC, WFPC2/PC, WFPC2/WFC |
| uranus | 3,929 | ACS/HRC, ACS/SBC, ACS/WFC, COS, COS/FUV, COS/NUV, FOC/96, FOS/BL, FOS/RD, HRS/1, HRS/2, HSP/UNK/VIS, NICMOS/NIC1, NICMOS/NIC2, NICMOS/NIC3, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/IR, WFC3/UVIS, WFPC2/PC, WFPC2/WFC |
| neptune | 3,610 | ACS/HRC, ACS/WFC, FOS/BL, HRS/1, HSP/UNK/VIS, NICMOS/NIC1, NICMOS/NIC2, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/UVIS, WFPC/PC, WFPC2/PC, WFPC2/WFC |
| pluto | 3,123 | ACS/HRC, ACS/WFC, COS, COS/NUV, FOC/96, FOS/BL, FOS/RD, HSP/UNK/VIS, NICMOS/NIC2, STIS, STIS/CCD, STIS/NUV-MAMA, WFC3/IR, WFC3/UVIS, WFPC2/PC |
| mars | 3,072 | ACS/HRC, ACS/SBC, FOS/BL, HRS/1, HRS/2, NICMOS/NIC1, NICMOS/NIC2, STIS, STIS/CCD, STIS/FUV-MAMA, WFC3/UVIS, WFPC/PC, WFPC2/PC, WFPC2/WFC |
| saturn | 2,942 | ACS/HRC, ACS/SBC, ACS/WFC, FOC/96, FOS/BL, FOS/RD, HRS, HRS/1, HRS/2, NICMOS/NIC1, NICMOS/NIC2, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/UVIS, WFPC/PC, WFPC/WFC, WFPC2/PC, WFPC2/WFC |
| io | 1,610 | ACS/SBC, COS, COS/FUV, COS/NUV, FOC/96, FOS/BL, FOS/RD, HRS, HRS/1, HRS/2, NICMOS/NIC1, NICMOS/NIC2, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/UVIS, WFPC/PC, WFPC/WFC, WFPC2/PC, WFPC2/WFC |
| europa | 895 | ACS/SBC, ACS/WFC, COS, COS/FUV, COS/NUV, FOS/BL, FOS/RD, HRS, HRS/1, HRS/2, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/IR, WFC3/UVIS, WFPC2/PC |
| titan | 812 | ACS/HRC, ACS/SBC, FOC/96, FOS/BL, HRS, HRS/1, HRS/2, HSP/UNK/VIS, NICMOS/NIC1, NICMOS/NIC2, STIS/CCD, WFPC/PC, WFPC2/PC, WFPC2/WFC |
| didymos | 682 | WFC3/UVIS |
| vesta | 590 | FOC/96, NICMOS/NIC1, NICMOS/NIC2, WFC3/UVIS, WFPC2/PC, WFPC2/WFC |
| haumea | 514 | STIS/CCD, WFC3/UVIS, WFPC2/PC |
| callisto | 453 | COS, COS/FUV, COS/NUV, FOS/BL, FOS/RD, HRS, HRS/2, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/IR, WFPC2/PC |
| ganymede | 355 | ACS/HRC, ACS/SBC, COS, COS/FUV, COS/NUV, FOS/BL, FOS/RD, HRS, HRS/1, HRS/2, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/IR, WFPC2/PC |
| ceres | 270 | ACS/HRC, ACS/SBC, COS/FUV, COS/NUV, FOC/96, FOS/RD, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/UVIS, WFPC2/PC, WFPC2/WFC |
| makemake | 248 | WFC3/UVIS |
| eurybates | 160 | WFC3/UVIS |
| patroclus | 121 | STIS, STIS/CCD, STIS/NUV-MAMA, WFC3/UVIS |
| quaoar | 105 | ACS/HRC, NICMOS/NIC1, WFC3/UVIS, WFPC2/PC |
| triton | 102 | FOC/96, FOS/BL, FOS/RD, HSP/UNK/VIS, STIS, STIS/CCD, STIS/NUV-MAMA |
| orus | 94 | WFC3/UVIS |
| comet-9p | 93 | ACS/HRC, WFC3/UVIS |
| pallas | 80 | WFPC2/PC |
| phaethon | 79 | ACS/WFC, NICMOS/NIC3, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/UVIS |
| charon | 70 | FOS/BL, NICMOS/NIC1, NICMOS/NIC2, NICMOS/NIC3, STIS, STIS/CCD |
| moon | 68 | FOS/BL, HRS/2, STIS/CCD |
| lutetia | 64 | ACS/SBC, WFPC2/PC |
| comet-3i | 55 | COS, COS/FUV, COS/NUV, STIS, STIS/CCD, STIS/NUV-MAMA, WFC3/UVIS |
| tethys | 42 | FOS/BL, FOS/RD, HRS, HRS/2, STIS, STIS/CCD, STIS/NUV-MAMA |
| bennu | 40 | WFC3/UVIS |
| polymele | 39 | WFC3/UVIS |
| enceladus | 38 | COS, COS/FUV, COS/NUV, NICMOS/NIC2, STIS, STIS/CCD, STIS/NUV-MAMA |
| comet-46p | 37 | COS, COS/FUV, COS/NUV, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA |
| donaldjohanson | 36 | WFC3/UVIS |
| dione | 35 | FOS/RD, STIS, STIS/CCD, STIS/NUV-MAMA, WFPC2/PC |
| iapetus | 31 | FOS/RD, STIS, STIS/CCD, STIS/NUV-MAMA, WFPC2/PC |
| amalthea | 30 | FOS/RD, STIS, STIS/CCD, STIS/NUV-MAMA |
| rhea | 29 | FOS/BL, FOS/RD, HRS, HRS/2, STIS, STIS/CCD, STIS/NUV-MAMA |
| comet-2i | 28 | WFC3/UVIS |
| leucus | 26 | WFC3/UVIS |
| oumuamua | 25 | WFC3/UVIS |
| titania | 25 | FOS/BL, FOS/RD, STIS, STIS/CCD, STIS/NUV-MAMA |
| ida | 24 | WFPC2/PC |
| eris | 22 | NICMOS/NIC2, WFC3/UVIS, WFPC2/PC |
| oberon | 22 | FOS/RD, STIS, STIS/CCD, STIS/NUV-MAMA |
| ariel | 21 | FOS/RD, STIS, STIS/CCD, STIS/NUV-MAMA |
| comet-c1995-o1 | 20 | WFPC2/WFC |
| venus | 20 | HRS/2, STIS, STIS/CCD, STIS/FUV-MAMA, WFPC2/WFC |
| melpomene | 19 | WFPC/PC, WFPC2/PC |
| comet-17p | 18 | WFPC2/PC |
| cybele | 16 | STIS, STIS/CCD, STIS/NUV-MAMA, WFPC2/PC |
| salacia | 16 | WFC3/UVIS |
| umbriel | 16 | STIS, STIS/CCD, STIS/NUV-MAMA |
| comet-103p | 15 | COS/FUV, COS/NUV, STIS/CCD |
| flora | 14 | WFPC2/PC |
| thebe | 14 | FOS/RD, STIS, STIS/CCD, STIS/NUV-MAMA |
| alexandra | 13 | WFPC2/PC |
| amphitrite | 13 | WFPC2/PC |
| julia | 13 | WFPC2/PC |
| mimas | 13 | FOS/BL, HRS, HRS/2, STIS, STIS/CCD, STIS/NUV-MAMA |
| parthenope | 13 | WFPC2/PC |
| astraea | 12 | WFPC2/PC |
| camilla | 12 | WFPC2/PC |
| comet-67p | 12 | COS, COS/FUV, COS/NUV, STIS, STIS/CCD, STIS/NUV-MAMA |
| egeria | 12 | WFPC2/PC |
| elektra | 12 | WFPC2/PC |
| eugenia | 12 | WFPC2/PC |
| eunomia | 12 | WFPC2/PC |
| gyptis | 12 | WFPC2/PC |
| hebe | 12 | WFPC2/PC |
| hermione | 12 | WFPC2/PC |
| hestia | 12 | WFPC2/PC |
| irene | 12 | WFPC2/PC |
| iris | 12 | WFPC2/PC |
| massalia | 12 | WFPC2/PC |
| nemausa | 12 | WFPC2/PC |
| nysa | 12 | WFPC2/PC |
| orcus | 12 | ACS/HRC, NICMOS/NIC1, WFPC2/PC |
| pales | 12 | WFPC2/PC |
| psyche | 12 | COS, COS/FUV, COS/NUV, STIS, STIS/CCD, STIS/NUV-MAMA |
| vibilia | 12 | WFPC2/PC |
| hygiea | 11 | WFPC2/PC |
| deimos | 9 | FOS/RD |
| hidalgo | 9 | FOS/RD |
| ixion | 8 | ACS/HRC, STIS/CCD |
| toutatis | 8 | WFPC/PC |
| herculina | 7 | WFPC/PC, WFPC2/PC |
| kleopatra | 7 | COS, COS/FUV, COS/NUV, WFPC/PC |
| palma | 7 | STIS, STIS/CCD, STIS/NUV-MAMA |
| metis | 6 | FOS/RD |
| minerva | 6 | WFPC2/PC |
| phobos | 6 | FOS/BL, FOS/RD |
| sylvia | 6 | WFPC2/PC |
| miranda | 5 | FOS/RD |
| hektor | 4 | WFPC/PC |
| lucina | 4 | WFPC/PC |
| themis | 4 | STIS, STIS/CCD, STIS/NUV-MAMA |
| thule | 4 | STIS, STIS/CCD, STIS/NUV-MAMA |
| hertha | 3 | COS, COS/FUV, COS/NUV |
| kalliope | 3 | COS, COS/FUV, COS/NUV |
| lydia | 3 | COS, COS/FUV, COS/NUV |
| varuna | 3 | ACS/HRC |
| asteroid-2002-tc302 | 2 | ACS/HRC |
| asteroid-2002-tx300 | 2 | ACS/HRC |
| asteroid-2003-vs2 | 2 | ACS/HRC |
| sedna | 2 | ACS/HRC |
| juliet | 1 | FOS/RD |
| portia | 1 | FOS/RD |
| puck | 1 | FOS/RD |

## Objects that do not move

What the archive holds within each positioned object's own radius on the sky.

| Object | Radius | Observations | Configurations |
| --- | ---: | ---: | --- |
| m42 | 10.0′ | 7,526 | ACS, ACS/HRC, ACS/SBC, ACS/WFC, COS, COS/FUV, COS/NUV, FGS, FOC/48, FOC/96, FOS/BL, FOS/RD, HRS, HRS/2, HSP/UNK/POL, HSP/UNK/VIS, NICMOS/NIC1, NICMOS/NIC2, NICMOS/NIC3, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/IR, WFC3/UVIS, WFPC/PC, WFPC/WFC, WFPC2, WFPC2/PC, WFPC2/WFC |
| hd-189733-companion | 0.5′ | 4,144 | ACS, ACS/HRC, ACS/SBC, COS, COS-STIS, COS/FUV, COS/NUV, NICMOS/NIC1, NICMOS/NIC2, NICMOS/NIC3, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/IR, WFC3/UVIS, WFPC2, WFPC2/PC |
| hd-189733 | 0.5′ | 4,143 | ACS, ACS/HRC, ACS/SBC, COS, COS-STIS, COS/FUV, COS/NUV, NICMOS/NIC1, NICMOS/NIC3, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/IR, WFC3/UVIS, WFPC2, WFPC2/PC |
| wasp-43 | 0.5′ | 2,675 | COS, COS-STIS, COS/FUV, COS/NUV, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/IR, WFC3/UVIS |
| m1 | 10.0′ | 1,708 | ACS/HRC, ACS/SBC, ACS/WFC, COS, COS-STIS, COS/FUV, COS/NUV, FOC/96, FOS/BL, FOS/RD, HSP/UNK/POL, HSP/UNK/UV2, HSP/UNK/VIS, NICMOS/NIC1, NICMOS/NIC2, NICMOS/NIC3, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/IR, WFC3/UVIS, WFPC/PC, WFPC/WFC, WFPC2, WFPC2/PC, WFPC2/WFC |
| trappist-1 | 0.5′ | 1,568 | ACS/SBC, COS, COS-STIS, COS/FUV, COS/NUV, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/IR, WFC3/UVIS, WFPC2/PC |
| helix | 10.0′ | 792 | ACS, ACS/HRC, ACS/WFC, FGS, NICMOS/NIC1, NICMOS/NIC2, NICMOS/NIC3, STIS, STIS/CCD, STIS/FUV-MAMA, WFPC/PC, WFPC2, WFPC2/PC, WFPC2/WFC |
| betelgeuse | 0.5′ | 733 | FOC/96, FOS/BL, HRS, HRS/1, HRS/2, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA |
| polaris | 0.5′ | 350 | ACS/HRC, COS, COS/FUV, COS/NUV, FGS, STIS/CCD, WFC3/UVIS, WFPC2/PC |
| m2-9 | 10.0′ | 302 | HSP/UNK/UV1, NICMOS/NIC1, NICMOS/NIC2, NICMOS/NIC3, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFC3/UVIS, WFPC/PC, WFPC2, WFPC2/PC, WFPC2/WFC |
| m8 | 10.0′ | 252 | ACS, ACS/HRC, ACS/WFC, FGS, FOS/BL, FOS/RD, STIS, STIS/CCD, STIS/NUV-MAMA, WFC3/IR, WFC3/UVIS, WFPC/PC, WFPC/WFC, WFPC2, WFPC2/PC |
| m45 | 10.0′ | 144 | ACS/HRC, ACS/WFC, FOC/48, FOC/96, HRS, HRS/2, STIS/CCD, WFPC/PC, WFPC/WFC, WFPC2, WFPC2/PC |
| antares | 0.5′ | 86 | HRS, HRS/1, HRS/2, STIS, STIS/CCD, STIS/FUV-MAMA, STIS/NUV-MAMA, WFPC2/WFC |
| hd-181327 | 0.5′ | 80 | ACS/HRC, NICMOS/NIC2, STIS/CCD |
| pi1-gruis | 0.5′ | 9 | ACS/HRC, COS, COS/FUV, COS/NUV |

## Receipts

A program counts as re-calibrated in a configuration only when a receipt beside it parses, states the `cssearth-hst-reproduction@1` schema, and names one of its observations in that configuration together with the MAST product the program pins for it, with the digest of what it compared. A receipt that says anything else is reported here and proves nothing.

An archive-final program counts as qualified only when the `<id>.archive-final.product.json` beside it parses as a `archive-final` product record, names that program, observation and configuration, states that no software of ours ran, pins every file the program pins at the same byte count and digest, and carries one `archive-origin` entry for the science product and no `archive-agreement` at all. A record that cannot be read proves less than no record, so it is reported here too.

None: every receipt beside a pinned program was accepted.

## Limits

- Counts are the archive's own, by configuration. Nothing outside a moving target or a positioned object's radius is listed, because the fixed-target archive is far too large to pull.
- A moving target is matched by its name alone. A body a proposer named in some other way is missed, and a name shared with a body this repository does not ship is not matched.
- An object that does not move and has no position in its package (no star record, no nebula recipe) is not searched for.
- Every positioned object was asked for and answered.
- The counts are of observations as the catalogue groups them, which for HST is one exposure or one association, not one file.
