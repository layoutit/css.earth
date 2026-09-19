# JWST ledger

This page is written by [`archive-ledger.mts`](../tools/objects/jwst/archive-ledger.mts) from MAST's public archive as it stood on 2026-09-19, and from the programs pinned in this repository. It answers two questions: what kinds of JWST observation can this project already turn into something drawn, and which of the objects it ships has JWST observed. The numbers are in [`data/jwst/ledger.json`](../data/jwst/ledger.json). How each route works is in [JWST imaging](jwst-imaging.md) and [eclipse mapping](eclipse-mapping.md).

## Observing modes

An observation here is one public level-3 product set: one target, one instrument setup. "Checked" counts the pinned programs whose result was compared with someone else's: MAST's own product, or the light curve an author deposited.

| Mode | What it records | What it could draw | Observations | Targets | Of moving targets | Shipped objects | Bands | Programs | Checked |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| NIRCAM/IMAGE | pictures, 0.6–5 µm | nebulae and shells as volumes; pictures of Solar System bodies | 19,388 | 2,040 | 480 | 21 | 7 | 1 | 1 |
| NIRCAM/CORON | pictures with the star blocked out | discs and rings attached to their star | 285 | 79 | 0 | 1 | 75 | 2 | 2 |
| NIRCAM/GRISM | slitless spectra: time series of one star, or every source in a field | exoplanet maps from eclipses and phase curves | 8,520 | 177 | 0 | 1 | 0 | 0 | 0 |
| MIRI/IMAGE | pictures, 5–26 µm, and time series of one star through a filter | nebulae as volumes; exoplanet maps from eclipse photometry | 6,850 | 2,111 | 174 | 23 | 4 | 11 | 2 |
| MIRI/CORON | pictures with the star nulled by a phase mask | discs and rings attached to their star | 68 | 41 | 0 | 1 | 0 | 0 | 0 |
| MIRI/IFU | cubes: a 5–28 µm spectrum in every pixel | maps of what a surface or a gas is made of; gas velocity as depth | 25,596 | 1,428 | 1,936 | 36 | 12 | 1 | 1 |
| MIRI/SLIT | one 5–14 µm spectrum through a slit | whole-disc composition; nothing resolved | 432 | 358 | 24 | 8 | 0 | 0 | 0 |
| MIRI/SLITLESS | time series of one star's 5–12 µm spectrum | exoplanet maps from eclipses and phase curves | 111 | 74 | 0 | 2 | 0 | 3 | 3 |
| NIRSPEC/IFU | cubes: a 0.6–5.3 µm spectrum in every pixel | maps of what a surface or a gas is made of; gas velocity as depth | 2,229 | 1,256 | 637 | 68 | 9 | 10 | 3 |
| NIRSPEC/SLIT | one spectrum through a slit, and time series of one star | exoplanet maps from eclipses and phase curves | 3,015 | 535 | 42 | 6 | 0 | 0 | 0 |
| NIRSPEC/MSA | spectra of many faint sources at once | nothing: survey spectra of distant galaxies | 145,378 | none | none | 0 | 0 | 0 | 0 |
| NIRISS/AMI | interferograms through a seven-hole mask | structure closer to a star than a coronagraph reaches | 65 | 14 | 1 | 1 | 0 | 0 | 0 |
| NIRISS/SOSS | time series of one star's 0.6–2.8 µm spectrum | exoplanet maps from eclipses and phase curves | 143 | 67 | 0 | 1 | 0 | 0 | 0 |
| NIRISS/WFSS | slitless spectra of every source in a field | nothing: survey spectra | 592 | 31 | 0 | 0 | 0 | 0 | 0 |
| NIRISS/IMAGE | pictures, 0.9–4.8 µm | nebulae as volumes | 1,745 | 373 | 17 | 1 | 0 | 0 | 0 |

6 of 15 modes have a checked program: NIRCAM/IMAGE, NIRCAM/CORON, MIRI/IMAGE, MIRI/IFU, MIRI/SLITLESS, NIRSPEC/IFU.

- **NIRCAM/CORON.** Full-frame observations do not name their occulter.
- **NIRCAM/GRISM.** Held, not reducible here: its level-3 product is an extracted spectrum, not a picture or a cube, and no stage reads one.
- **MIRI/IMAGE.** Time series are reduced from raw by reduce-tso.mts; pictures go through image3.
- **MIRI/CORON.** Refused: the pipeline's alignment does not converge (docs/jwst-imaging.md).
- **MIRI/IFU.** One observation is twelve cubes: four channels in three sub-bands, each pinned and rebuilt on its own.
- **MIRI/SLIT.** Held, not reducible here: its level-3 product is an extracted spectrum, not a picture or a cube, and no stage reads one.
- **NIRSPEC/IFU.** Only a body several pixels across gets a map: NIRSpec's pixels are 0.1″, and most moons and small bodies fit inside one.
- **NIRSPEC/SLIT.** WASP-43b's NIRSpec map is fitted from the authors' deposited light curve, not reduced here. Held, not reducible here: its level-3 product is an extracted spectrum, not a picture or a cube, and no stage reads one.
- **NIRISS/AMI.** Held, not reducible here: no stage reads its level-3 interferometric products.
- **NIRISS/SOSS.** Held, not reducible here: its level-3 product is an extracted spectrum, not a picture or a cube, and no stage reads one.
- **NIRISS/IMAGE.** Held, not reducible here: the image3 stage would read it, but no NIRISS filter is defined as a band and no program is pinned.

## Time series

One star watched for hours, which is what an exoplanet map is fitted from. These are counted by visit from MAST's instrument keywords, because a time series through a filter has no level-3 product and a grism or slit mode mixes time series with ordinary spectra.

| Exposure type | What it records | Visits | Targets | Shipped objects | Programs | Checked |
|---|---|---:|---:|---|---:|---:|
| MIR_LRS-SLITLESS | MIRI 5–12 µm spectra | 149 | 105 | hd-189733b, wasp-43 | 3 | 3 |
| MIR_IMAGE | MIRI brightness through one filter | 62 | 17 | trappist-1, trappist-1b | 10 | 1 |
| NRS_BRIGHTOBJ | NIRSpec 0.6–5.3 µm spectra | 289 | 129 | trappist-1, wasp-43 | 0 | 0 |
| NIS_SOSS | NIRISS 0.6–2.8 µm spectra | 145 | 66 | trappist-1 | 0 | 0 |
| NRC_TSGRISM | NIRCam 2.4–5 µm spectra | 99 | 45 | hd-189733 | 0 | 0 |
| NRC_TSIMAGE | NIRCam brightness through one filter | 101 | 47 | hd-189733 | 0 | 0 |

## Shipped objects JWST has observed

88 shipped objects appear in the archive. 2 of them were observed only in modes with no checked program here. "Drawn" names the modes a pinned program of that object already uses.

| Object | Observations by mode | Time-series visits | Programmes | Drawn |
|---|---|---|---|---|
| albiorix | NIRSPEC/IFU 1 | none | 3716 | none |
| ariel | NIRSPEC/IFU 2 | none | 1786 | none |
| asteroid-2002-tc302 | NIRSPEC/IFU 1 | none | 2418 | none |
| asteroid-2002-tx300 | NIRSPEC/IFU 1 | none | 1191 | none |
| astraea | NIRSPEC/IFU 2 | none | 8782 | none |
| bienor | MIRI/IFU 24, MIRI/IMAGE 1, MIRI/SLIT 1 | none | 2820 | none |
| caliban | NIRSPEC/IFU 1 | none | 4645 | none |
| callisto | MIRI/IFU 24, NIRSPEC/IFU 3 | none | 2060, 4687 | none |
| ceres | MIRI/IFU 12, NIRSPEC/IFU 2 | none | 1244 | none |
| chariklo | MIRI/IFU 24, MIRI/IMAGE 1, MIRI/SLIT 1, NIRSPEC/IFU 2 | none | 1272, 2820 | none |
| charon | MIRI/IFU 12, MIRI/IMAGE 1, MIRI/SLIT 1, NIRSPEC/IFU 15 | none | 1191, 1658 | none |
| comet-3i | MIRI/IFU 32, NIRSPEC/IFU 2 | none | 5094, 9442 | none |
| daphne | NIRCAM/IMAGE 2 | none | 8527 | none |
| didymos | MIRI/IFU 12, NIRCAM/IMAGE 24, NIRSPEC/SLIT 1 | none | 1245 | none |
| dione | NIRSPEC/IFU 4 | none | 3716 | none |
| enceladus | MIRI/IFU 12, MIRI/IMAGE 1, NIRCAM/IMAGE 6, NIRSPEC/IFU 9 | none | 1250, 4320, 4604 | none |
| eos | NIRSPEC/IFU 2 | none | 8782 | none |
| epimetheus | NIRSPEC/IFU 1 | none | 1247 | none |
| eris | MIRI/SLIT 1, NIRCAM/IMAGE 6, NIRSPEC/IFU 3 | none | 1191, 6064 | none |
| europa | MIRI/IFU 12, MIRI/IMAGE 1, NIRCAM/IMAGE 6, NIRSPEC/IFU 13 | none | 1250, 4023, 9230 | MIRI/IMAGE, MIRI/IFU, NIRSPEC/IFU |
| eurybates | MIRI/IFU 12, NIRSPEC/IFU 2 | none | 2574 | none |
| galatea | NIRSPEC/IFU 2 | none | 4645 | none |
| ganymede | MIRI/IFU 24, NIRSPEC/IFU 3 | none | 1373 | none |
| haumea | MIRI/IMAGE 2, MIRI/SLIT 2, NIRSPEC/IFU 8 | none | 1273 | none |
| hd-181327 | MIRI/CORON 1, NIRCAM/CORON 12, NIRSPEC/IFU 1 | none | 1563, 2780, 3662 | NIRCAM/CORON |
| hd-189733 | NIRCAM/GRISM 4 | NRC_TSGRISM 4, NRC_TSIMAGE 4 | 1185, 1274, 1633 | none |
| hd-189733b | MIRI/SLITLESS 4 | MIR_LRS-SLITLESS 4 | 2001, 2021 | MIRI/SLITLESS, MIR_LRS-SLITLESS |
| hektor | NIRSPEC/IFU 1 | none | 1244 | none |
| helix | MIRI/IFU 12, NIRCAM/IMAGE 6 | none | 1239, 6557 | none |
| henrietta | MIRI/IFU 36, MIRI/IMAGE 2, NIRSPEC/IFU 2 | none | 3760 | none |
| himalia | MIRI/SLIT 1, NIRSPEC/IFU 2 | none | 4028 | none |
| huya | NIRSPEC/IFU 1 | none | 2418 | none |
| hydra | MIRI/IFU 24, MIRI/IMAGE 3 | none | 5018 | none |
| hygiea | MIRI/IFU 12, NIRSPEC/IFU 2 | none | 1244 | none |
| hyperion | NIRSPEC/IFU 2 | none | 3716 | none |
| iapetus | NIRSPEC/IFU 4 | none | 3716 | none |
| io | MIRI/IFU 44, NIRISS/AMI 1, NIRSPEC/IFU 6 | none | 1373, 4078, 4565 | none |
| jupiter | MIRI/IFU 128, MIRI/IMAGE 10, NIRCAM/IMAGE 57, NIRISS/IMAGE 4, NIRSPEC/IFU 45 | none | 1022, 1246, 1373, 3665, 9022 | none |
| kleopatra | NIRSPEC/IFU 1 | none | 1444 | none |
| larissa | NIRSPEC/IFU 2 | none | 4645 | none |
| leda-38 | MIRI/IFU 12, MIRI/IMAGE 1 | none | 11793 | none |
| leucus | MIRI/IFU 12, NIRSPEC/IFU 2 | none | 2574 | none |
| libussa | MIRI/IFU 12, MIRI/IMAGE 1 | none | 11793 | none |
| m1 | MIRI/IFU 48, MIRI/IMAGE 10, NIRCAM/IMAGE 2 | none | 1714 | none |
| m33 | MIRI/IMAGE 4, NIRCAM/IMAGE 8 | none | 2128, 3436 | none |
| m42 | MIRI/IFU 84, MIRI/IMAGE 10, NIRCAM/IMAGE 37, NIRSPEC/IFU 32 | none | 1228, 1256, 1288, 1741, 3983, 4332, 5460, 5804 | none |
| m8 | NIRSPEC/SLIT 3 | none | 7929 | none |
| mab | NIRCAM/IMAGE 2 | none | 8527 | none |
| makemake | MIRI/IMAGE 2, MIRI/SLIT 1, NIRSPEC/IFU 11 | none | 1254, 9453 | none |
| mars | NIRCAM/IMAGE 14, NIRSPEC/SLIT 9 | none | 1415, 2787 | none |
| mimas | NIRSPEC/IFU 4 | none | 3716 | none |
| miranda | NIRSPEC/IFU 2 | none | 4645 | none |
| neptune | MIRI/IFU 84, MIRI/IMAGE 4, NIRCAM/IMAGE 4, NIRSPEC/IFU 45 | none | 1249, 1604, 2739, 7570 | none |
| nereid | NIRSPEC/IFU 1 | none | 4645 | none |
| oberon | NIRSPEC/IFU 3 | none | 1786, 7813 | none |
| orcus | NIRCAM/IMAGE 6, NIRSPEC/IFU 3 | none | 1231, 6064 | none |
| orus | MIRI/IFU 12, NIRSPEC/IFU 2 | none | 2574 | none |
| pallas | MIRI/IFU 12, NIRSPEC/IFU 2 | none | 1244 | none |
| pallene | NIRSPEC/IFU 1 | none | 1247 | none |
| pandora | NIRSPEC/IFU 1 | none | 1247 | none |
| patroclus | MIRI/IFU 12, NIRSPEC/IFU 3 | none | 1244, 2574 | none |
| peitho | MIRI/IFU 4, MIRI/IMAGE 1 | none | 1449 | none |
| phaethon | MIRI/IFU 12, NIRCAM/IMAGE 2, NIRSPEC/SLIT 1 | none | 1245 | none |
| phoebe | NIRSPEC/IFU 2 | none | 3716 | none |
| pluto | MIRI/IFU 24, MIRI/IMAGE 26, MIRI/SLIT 1, NIRCAM/IMAGE 24, NIRSPEC/IFU 15 | none | 1191, 1658 | none |
| polymele | MIRI/IFU 12, NIRSPEC/IFU 2 | none | 2574 | none |
| portia | NIRSPEC/IFU 1 | none | 4645 | none |
| proteus | NIRSPEC/IFU 2 | none | 4645 | none |
| psyche | MIRI/IFU 16, MIRI/IMAGE 2, NIRSPEC/IFU 12 | none | 1731 | none |
| puck | NIRSPEC/IFU 1 | none | 4645 | none |
| quaoar | NIRCAM/IMAGE 6, NIRSPEC/IFU 3 | none | 1273, 6064 | none |
| rhea | NIRSPEC/IFU 4 | none | 3716 | none |
| salacia | NIRSPEC/IFU 1 | none | 1191 | none |
| saturn | MIRI/IFU 48, NIRCAM/IMAGE 8, NIRSPEC/IFU 1 | none | 1247, 5308 | none |
| sedna | NIRSPEC/IFU 1 | none | 1272 | none |
| sycorax | NIRSPEC/IFU 2 | none | 4645 | none |
| taurinensis | MIRI/IFU 12, MIRI/IMAGE 1 | none | 11793 | none |
| telesto | NIRSPEC/IFU 1 | none | 1247 | none |
| tethys | NIRSPEC/IFU 4 | none | 3716 | none |
| titan | MIRI/IFU 24, NIRCAM/IMAGE 54, NIRSPEC/IFU 13 | none | 1251, 2760, 4523 | none |
| titania | NIRSPEC/IFU 3 | none | 1786 | none |
| trappist-1 | NIRISS/SOSS 9, NIRSPEC/SLIT 29 | MIR_IMAGE 10, NIS_SOSS 9, NRS_BRIGHTOBJ 29 | 1201, 1331, 1981, 2304, 2420, 2589, 3077, 5191, 6456, 9256, 12492 | MIR_IMAGE |
| trappist-1b | none | MIR_IMAGE 10 | 1177, 1279 | MIR_IMAGE |
| triton | MIRI/IFU 24, MIRI/IMAGE 8, NIRSPEC/IFU 6 | none | 1272 | none |
| umbriel | NIRSPEC/IFU 2 | none | 1786 | none |
| uranus | MIRI/IFU 36, MIRI/IMAGE 3, NIRCAM/IMAGE 36, NIRSPEC/IFU 49 | none | 1248, 2739, 2768, 5073, 6379, 7570, 8975, 9482 | none |
| varuna | MIRI/IMAGE 2, NIRCAM/IMAGE 12, NIRSPEC/IFU 1 | none | 1254, 4541 | none |
| wasp-43 | MIRI/SLITLESS 1, NIRSPEC/SLIT 1 | MIR_LRS-SLITLESS 1, NRS_BRIGHTOBJ 1 | 1224, 1366 | MIRI/SLITLESS, MIR_LRS-SLITLESS |

## Receipts

A band counts as checked only when a receipt beside its program parses, states one of the imaging stages' reproduction schemas, and names that program, that band, that observation and the level-3 product the program pins, with the digest of what it compared. A receipt that says anything else is reported here and proves nothing.

None: every receipt beside a pinned program was accepted.

## Limits

- A target is matched by the name its proposer typed, or by position for what does not move. A moving target is matched by the first word of its name, so TITAN-LEADING is Titan; a pointing named as a background or an offset is left out. A name two objects share (Dione the moon, 106 Dione) goes to the unnumbered one unless the target carries the number. An object observed under a name this does not recognise is missed, and a nebula is matched to anything pointed within a sixth of a degree of its centre.
- The archive changes daily; this is a dated snapshot, and only public data are counted.
- NIRSpec's multi-object mode is counted but not listed by target.
