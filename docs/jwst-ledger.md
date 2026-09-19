# JWST ledger

This page is written by [`archive-ledger.mts`](../tools/objects/jwst/archive-ledger.mts) from MAST's public archive as it stood on 2026-09-19, and from the programs pinned in this repository. It answers two questions: what kinds of JWST observation can this project already turn into something drawn, and which of the objects it ships has JWST observed. The numbers are in [`data/jwst/ledger.json`](../data/jwst/ledger.json). How each route works is in [JWST imaging](jwst-imaging.md) and [eclipse mapping](eclipse-mapping.md).

## Observing modes

An observation here is one public level-3 product set: one target, one instrument setup. "Checked" counts the pinned programs whose result was compared with someone else's: MAST's own product, or the light curve an author deposited.

| Mode | What it records | What it could draw | Observations | Targets | Of moving targets | Shipped objects | Bands | Programs | Checked |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| NIRCAM/IMAGE | pictures, 0.6–5 µm | nebulae and shells as volumes; pictures of Solar System bodies | 19,388 | 2,040 | 480 | 21 | 7 | 1 | 1 |
| NIRCAM/CORON | pictures with the star blocked out | discs and rings attached to their star | 285 | 79 | 0 | 1 | 75 | 2 | 2 |
| NIRCAM/GRISM | slitless spectra: time series of one star, or every source in a field | exoplanet maps from eclipses and phase curves | 8,520 | 177 | 0 | 1 | 0 | 0 | 0 |
| MIRI/IMAGE | pictures, 5–26 µm, and time series of one star through a filter | nebulae as volumes; exoplanet maps from eclipse photometry | 6,850 | 2,111 | 174 | 23 | 4 | 10 | 1 |
| MIRI/CORON | pictures with the star nulled by a phase mask | discs and rings attached to their star | 68 | 41 | 0 | 1 | 0 | 0 | 0 |
| MIRI/IFU | cubes: a 5–28 µm spectrum in every pixel | maps of what a surface or a gas is made of; gas velocity as depth | 25,596 | 1,428 | 1,936 | 36 | 0 | 0 | 0 |
| MIRI/SLIT | one 5–14 µm spectrum through a slit | whole-disc composition; nothing resolved | 432 | 358 | 24 | 8 | 0 | 0 | 0 |
| MIRI/SLITLESS | time series of one star's 5–12 µm spectrum | exoplanet maps from eclipses and phase curves | 111 | 74 | 0 | 2 | 0 | 3 | 3 |
| NIRSPEC/IFU | cubes: a 0.6–5.3 µm spectrum in every pixel | maps of what a surface or a gas is made of; gas velocity as depth | 2,229 | 1,256 | 637 | 68 | 9 | 10 | 3 |
| NIRSPEC/SLIT | one spectrum through a slit, and time series of one star | exoplanet maps from eclipses and phase curves | 3,015 | 535 | 42 | 6 | 0 | 0 | 0 |
| NIRSPEC/MSA | spectra of many faint sources at once | nothing: survey spectra of distant galaxies | 145,378 | — | — | 0 | 0 | 0 | 0 |
| NIRISS/AMI | interferograms through a seven-hole mask | structure closer to a star than a coronagraph reaches | 65 | 14 | 1 | 1 | 0 | 0 | 0 |
| NIRISS/SOSS | time series of one star's 0.6–2.8 µm spectrum | exoplanet maps from eclipses and phase curves | 143 | 67 | 0 | 1 | 0 | 0 | 0 |
| NIRISS/WFSS | slitless spectra of every source in a field | nothing: survey spectra | 592 | 31 | 0 | 0 | 0 | 0 | 0 |
| NIRISS/IMAGE | pictures, 0.9–4.8 µm | nebulae as volumes | 1,745 | 373 | 17 | 1 | 0 | 0 | 0 |

5 of 15 modes have a checked program: NIRCAM/IMAGE, NIRCAM/CORON, MIRI/IMAGE, MIRI/SLITLESS, NIRSPEC/IFU.

- **NIRCAM/CORON.** Full-frame observations do not name their occulter.
- **MIRI/IMAGE.** Time series are reduced from raw; pictures have bands but no reproduced program.
- **MIRI/CORON.** Refused: the pipeline's alignment does not converge (docs/jwst-imaging.md).
- **NIRSPEC/IFU.** Only a body several pixels across gets a map: NIRSpec's pixels are 0.1″, and most moons and small bodies fit inside one.
- **NIRSPEC/SLIT.** WASP-43b's NIRSpec map is fitted from the authors' deposited light curve, not reduced here.

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
| albiorix | NIRSPEC/IFU 1 | — | 3716 | — |
| ariel | NIRSPEC/IFU 2 | — | 1786 | — |
| asteroid-2002-tc302 | NIRSPEC/IFU 1 | — | 2418 | — |
| asteroid-2002-tx300 | NIRSPEC/IFU 1 | — | 1191 | — |
| astraea | NIRSPEC/IFU 2 | — | 8782 | — |
| bienor | MIRI/IFU 24, MIRI/IMAGE 1, MIRI/SLIT 1 | — | 2820 | — |
| caliban | NIRSPEC/IFU 1 | — | 4645 | — |
| callisto | MIRI/IFU 24, NIRSPEC/IFU 3 | — | 2060, 4687 | — |
| ceres | MIRI/IFU 12, NIRSPEC/IFU 2 | — | 1244 | — |
| chariklo | MIRI/IFU 24, MIRI/IMAGE 1, MIRI/SLIT 1, NIRSPEC/IFU 2 | — | 1272, 2820 | — |
| charon | MIRI/IFU 12, MIRI/IMAGE 1, MIRI/SLIT 1, NIRSPEC/IFU 15 | — | 1191, 1658 | — |
| comet-3i | MIRI/IFU 32, NIRSPEC/IFU 2 | — | 5094, 9442 | — |
| daphne | NIRCAM/IMAGE 2 | — | 8527 | — |
| didymos | MIRI/IFU 12, NIRCAM/IMAGE 24, NIRSPEC/SLIT 1 | — | 1245 | — |
| dione | NIRSPEC/IFU 4 | — | 3716 | — |
| enceladus | MIRI/IFU 12, MIRI/IMAGE 1, NIRCAM/IMAGE 6, NIRSPEC/IFU 9 | — | 1250, 4320, 4604 | — |
| eos | NIRSPEC/IFU 2 | — | 8782 | — |
| epimetheus | NIRSPEC/IFU 1 | — | 1247 | — |
| eris | MIRI/SLIT 1, NIRCAM/IMAGE 6, NIRSPEC/IFU 3 | — | 1191, 6064 | — |
| europa | MIRI/IFU 12, MIRI/IMAGE 1, NIRCAM/IMAGE 6, NIRSPEC/IFU 13 | — | 1250, 4023, 9230 | NIRSPEC/IFU |
| eurybates | MIRI/IFU 12, NIRSPEC/IFU 2 | — | 2574 | — |
| galatea | NIRSPEC/IFU 2 | — | 4645 | — |
| ganymede | MIRI/IFU 24, NIRSPEC/IFU 3 | — | 1373 | — |
| haumea | MIRI/IMAGE 2, MIRI/SLIT 2, NIRSPEC/IFU 8 | — | 1273 | — |
| hd-181327 | MIRI/CORON 1, NIRCAM/CORON 12, NIRSPEC/IFU 1 | — | 1563, 2780, 3662 | NIRCAM/CORON |
| hd-189733 | NIRCAM/GRISM 4 | NRC_TSGRISM 4, NRC_TSIMAGE 4 | 1185, 1274, 1633 | — |
| hd-189733b | MIRI/SLITLESS 4 | MIR_LRS-SLITLESS 4 | 2001, 2021 | MIRI/SLITLESS, MIR_LRS-SLITLESS |
| hektor | NIRSPEC/IFU 1 | — | 1244 | — |
| helix | MIRI/IFU 12, NIRCAM/IMAGE 6 | — | 1239, 6557 | — |
| henrietta | MIRI/IFU 36, MIRI/IMAGE 2, NIRSPEC/IFU 2 | — | 3760 | — |
| himalia | MIRI/SLIT 1, NIRSPEC/IFU 2 | — | 4028 | — |
| huya | NIRSPEC/IFU 1 | — | 2418 | — |
| hydra | MIRI/IFU 24, MIRI/IMAGE 3 | — | 5018 | — |
| hygiea | MIRI/IFU 12, NIRSPEC/IFU 2 | — | 1244 | — |
| hyperion | NIRSPEC/IFU 2 | — | 3716 | — |
| iapetus | NIRSPEC/IFU 4 | — | 3716 | — |
| io | MIRI/IFU 44, NIRISS/AMI 1, NIRSPEC/IFU 6 | — | 1373, 4078, 4565 | — |
| jupiter | MIRI/IFU 128, MIRI/IMAGE 10, NIRCAM/IMAGE 57, NIRISS/IMAGE 4, NIRSPEC/IFU 45 | — | 1022, 1246, 1373, 3665, 9022 | — |
| kleopatra | NIRSPEC/IFU 1 | — | 1444 | — |
| larissa | NIRSPEC/IFU 2 | — | 4645 | — |
| leda-38 | MIRI/IFU 12, MIRI/IMAGE 1 | — | 11793 | — |
| leucus | MIRI/IFU 12, NIRSPEC/IFU 2 | — | 2574 | — |
| libussa | MIRI/IFU 12, MIRI/IMAGE 1 | — | 11793 | — |
| m1 | MIRI/IFU 48, MIRI/IMAGE 10, NIRCAM/IMAGE 2 | — | 1714 | — |
| m33 | MIRI/IMAGE 4, NIRCAM/IMAGE 8 | — | 2128, 3436 | — |
| m42 | MIRI/IFU 84, MIRI/IMAGE 10, NIRCAM/IMAGE 37, NIRSPEC/IFU 32 | — | 1228, 1256, 1288, 1741, 3983, 4332, 5460, 5804 | — |
| m8 | NIRSPEC/SLIT 3 | — | 7929 | — |
| mab | NIRCAM/IMAGE 2 | — | 8527 | — |
| makemake | MIRI/IMAGE 2, MIRI/SLIT 1, NIRSPEC/IFU 11 | — | 1254, 9453 | — |
| mars | NIRCAM/IMAGE 14, NIRSPEC/SLIT 9 | — | 1415, 2787 | — |
| mimas | NIRSPEC/IFU 4 | — | 3716 | — |
| miranda | NIRSPEC/IFU 2 | — | 4645 | — |
| neptune | MIRI/IFU 84, MIRI/IMAGE 4, NIRCAM/IMAGE 4, NIRSPEC/IFU 45 | — | 1249, 1604, 2739, 7570 | — |
| nereid | NIRSPEC/IFU 1 | — | 4645 | — |
| oberon | NIRSPEC/IFU 3 | — | 1786, 7813 | — |
| orcus | NIRCAM/IMAGE 6, NIRSPEC/IFU 3 | — | 1231, 6064 | — |
| orus | MIRI/IFU 12, NIRSPEC/IFU 2 | — | 2574 | — |
| pallas | MIRI/IFU 12, NIRSPEC/IFU 2 | — | 1244 | — |
| pallene | NIRSPEC/IFU 1 | — | 1247 | — |
| pandora | NIRSPEC/IFU 1 | — | 1247 | — |
| patroclus | MIRI/IFU 12, NIRSPEC/IFU 3 | — | 1244, 2574 | — |
| peitho | MIRI/IFU 4, MIRI/IMAGE 1 | — | 1449 | — |
| phaethon | MIRI/IFU 12, NIRCAM/IMAGE 2, NIRSPEC/SLIT 1 | — | 1245 | — |
| phoebe | NIRSPEC/IFU 2 | — | 3716 | — |
| pluto | MIRI/IFU 24, MIRI/IMAGE 26, MIRI/SLIT 1, NIRCAM/IMAGE 24, NIRSPEC/IFU 15 | — | 1191, 1658 | — |
| polymele | MIRI/IFU 12, NIRSPEC/IFU 2 | — | 2574 | — |
| portia | NIRSPEC/IFU 1 | — | 4645 | — |
| proteus | NIRSPEC/IFU 2 | — | 4645 | — |
| psyche | MIRI/IFU 16, MIRI/IMAGE 2, NIRSPEC/IFU 12 | — | 1731 | — |
| puck | NIRSPEC/IFU 1 | — | 4645 | — |
| quaoar | NIRCAM/IMAGE 6, NIRSPEC/IFU 3 | — | 1273, 6064 | — |
| rhea | NIRSPEC/IFU 4 | — | 3716 | — |
| salacia | NIRSPEC/IFU 1 | — | 1191 | — |
| saturn | MIRI/IFU 48, NIRCAM/IMAGE 8, NIRSPEC/IFU 1 | — | 1247, 5308 | — |
| sedna | NIRSPEC/IFU 1 | — | 1272 | — |
| sycorax | NIRSPEC/IFU 2 | — | 4645 | — |
| taurinensis | MIRI/IFU 12, MIRI/IMAGE 1 | — | 11793 | — |
| telesto | NIRSPEC/IFU 1 | — | 1247 | — |
| tethys | NIRSPEC/IFU 4 | — | 3716 | — |
| titan | MIRI/IFU 24, NIRCAM/IMAGE 54, NIRSPEC/IFU 13 | — | 1251, 2760, 4523 | — |
| titania | NIRSPEC/IFU 3 | — | 1786 | — |
| trappist-1 | NIRISS/SOSS 9, NIRSPEC/SLIT 29 | MIR_IMAGE 10, NIS_SOSS 9, NRS_BRIGHTOBJ 29 | 1201, 1331, 1981, 2304, 2420, 2589, 3077, 5191, 6456, 9256, 12492 | MIR_IMAGE |
| trappist-1b | — | MIR_IMAGE 10 | 1177, 1279 | MIR_IMAGE |
| triton | MIRI/IFU 24, MIRI/IMAGE 8, NIRSPEC/IFU 6 | — | 1272 | — |
| umbriel | NIRSPEC/IFU 2 | — | 1786 | — |
| uranus | MIRI/IFU 36, MIRI/IMAGE 3, NIRCAM/IMAGE 36, NIRSPEC/IFU 49 | — | 1248, 2739, 2768, 5073, 6379, 7570, 8975, 9482 | — |
| varuna | MIRI/IMAGE 2, NIRCAM/IMAGE 12, NIRSPEC/IFU 1 | — | 1254, 4541 | — |
| wasp-43 | MIRI/SLITLESS 1, NIRSPEC/SLIT 1 | MIR_LRS-SLITLESS 1, NRS_BRIGHTOBJ 1 | 1224, 1366 | MIRI/SLITLESS, MIR_LRS-SLITLESS |

## Limits

- A target is matched by the name its proposer typed, or by position for what does not move. A moving target is matched by the first word of its name, so TITAN-LEADING is Titan; a pointing named as a background or an offset is left out. A name two objects share (Dione the moon, 106 Dione) goes to the unnumbered one unless the target carries the number. An object observed under a name this does not recognise is missed, and a nebula is matched to anything pointed within a sixth of a degree of its centre.
- The archive changes daily; this is a dated snapshot, and only public data are counted.
- NIRSpec's multi-object mode is counted but not listed by target.
