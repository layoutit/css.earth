# Hubble

Hubble images and spectra reach this project as MAST products. This guide describes how one archive observation is pinned, re-calibrated here from its raw exposure on Hubble's own software, and checked against the archive's own product. The route is the one [JWST imaging](jwst-imaging.md) and [interferometric imaging](interferometric-imaging.md) follow: pin, re-run, compare, write a receipt. What the archive holds, and how much of it this route reaches, is the [Hubble ledger](hubble-ledger.md).

One Hubble dataset is drawn: [Beta Pictoris's debris disc](#a-coronagraphs-starlight-removed) in three ACS/HRC filters. What exists beside it is the toolkit, its proof on five Europa observations across three instruments, two measurements made from the archive's own products, [line images of a moving target](#line-images-of-a-moving-target), stacked in the target's frame, and [bands mapped from a slit scanned across a body](#bands-mapped-from-a-slit-scanned-across-a-body), one stage that goes back behind those products to the photons themselves, [an exposure rebuilt in a moving target's frame](#an-exposure-rebuilt-in-a-moving-targets-frame), and one that makes nothing at all, [the archive's own final products of the instruments whose calibration is frozen](#archive-final-products-of-retired-instruments).

## Stages

1. **Install the software.** `node tools/objects/hst/toolchain.mts install` builds the pinned environment under `output/toolchains/hst` (ignored by git). The instrument pipelines are STScI's own executables from conda-forge's `hstcal`; the Python wrappers, drizzlepac and CRDS come from [requirements.lock](../tools/objects/hst/requirements.lock), installed without further resolution. `verify` prints the versions. The environment records the digest of [toolchain.json](../tools/objects/hst/toolchain.json) and the lock, and a run refuses an environment built from other pins.
2. **Pin.** `archive.mts <program id> <crds context> <obs_id>...` asks MAST what the observation holds: the raw exposures and the files the pipeline reads beside them (`_wav` wavecal, `_asn`, `_spt`, `_jit`), and the calibrated products the archive produced (`_flt`/`_flc`, `_crj`/`_sfl`, `_x2d`/`_sx2`, `_x1d`/`_sx1`, `_drz`/`_drc`), each by MAST URI and byte count. If the observation has an association table, that table is read and stored: the exposures it names, what each one does, and the rootname of the product it builds. Every file of every named exposure is pinned with it, and nothing else may be. The program also records what the observation is — instrument, detector, optical element, aperture, exposure start and end, target, proposal — and every `*CORR` calibration switch, read from the raw files' own primary headers over range requests and checked against what the archive catalogue says. Digests are added the first time a file is downloaded.
3. **Re-calibrate.** `calibrate.mts <program id> <observation> <work>` downloads the pinned inputs, copies them into `<work>/run`, and asks CRDS for the reference files the pinned context selects for those exposures. `crds bestrefs` writes their names into the raw headers and downloads the ones the cache does not hold; every one is then linked into a single directory that the instrument's variable (`oref`, `iref`, `jref`) points at, because the pipeline looks its references up as `oref$name` and the CRDS cache's own layout is CRDS's to change. The pipeline then runs: calstis through `stistools`, `calwf3` through `wfc3tools`, `calacs` through `acstools`. What it is given is the association table when the archive keeps a raw file for each exposure, and the one raw file otherwise — that distinction, not the instrument, is what makes the combining stage run.
4. **Compare.** `compare.mts <program id> <observation> <directory>` reads both the re-run product and MAST's with this repository's FITS reader and compares them sample by sample. The two must be on one grid — the same extensions, the same shape, the same table rows and columns — and a difference in shape is reported and refused rather than reconciled, because an HST product stays on its detector's own pixels. A three-axis extension is read one plane at a time, so what is held is one plane of each file. For each extension the receipt gives how many samples both hold, the share that are bit-identical, the median absolute difference over the median level, and, over the samples above that median level, the correlation and the relative difference at its median, 99th percentile and largest. Beside them it records the calibration software version each run used, every reference file or switch the two headers state differently, and any keyword the headers repeat.
5. **Drizzle, which is not the pipeline.** `_drz` and `_drc` are made after it, by drizzlepac. `drizzle.mts <program id> <observation> <work>` runs `stwcs.updatewcs` and then AstroDrizzle on the re-run's own `_flt`/`_flc`, with the kernel, drop size, output scale, fill value and units the archive's product states in its own header, and with the sky the archive's exposure records. Only a product the archive drizzled from one image is attempted.

**Records.** Each stage writes the record of its own run beside every product it makes, `<product>.product.json` ([product-record.mts](../tools/objects/product-record.mts)): for a calibration, the observation's pinned inputs at their sizes and digests, the CRDS context and the reference files that context chose, the pipeline and CRDS versions that ran, and the digest of the toolchain pins they were installed from; for a drizzle, the exposure drizzled, the archive files its settings and its sky were read from, and those settings. The record's evidence list is empty when it is written. `compare.mts` adds its receipt to that record as `archive-agreement` evidence naming the exact product it compared, and refuses a product that has no record beside it, so a receipt can never describe a file nothing here says it made. The line stack does the same for each `<line>-<subset>.fits`, and with `--receipt` adds its two checks as what they are: `published-value` for the comparison with the published brightness, `internal-consistency` for the mirrored handedness. The [archive-final](#archive-final-products-of-retired-instruments) stage writes one too, with no software in it and one `archive-origin` entry, because it made nothing. What each kind of evidence does and does not establish is in [virtual telescopes](virtual-telescopes.md).

## Measured

Five Europa observations, three instruments. Measured on 19 September 2026 with the pins in [toolchain.json](../tools/objects/hst/toolchain.json), on an Apple silicon Mac, CRDS context `hst_1358.pmap`.

**Software.** hstcal 3.2.0 from conda-forge, which is calstis 3.5.0 (02-Feb-2026), calwf3 3.7.3 and calacs 10.4.1 (08-Aug-2025); Python 3.12 with stistools 1.4.9, wfc3tools 1.6.1, acstools 3.8.2, drizzlepac 3.11.0, stwcs 1.7.7, crds 14.0.0, astropy 8.0.1 and numpy 2.5.3. The environment is 1.1 GB.

### STIS

**[Programme 14650](../tools/objects/hst/programs/europa-14650.json)** (PI M. Brown), `od9l12010`: STIS/CCD, G430L, 52X0.1, a 10-second subarray exposure of 29 June 2017. 22 reference files; two runs took 1.6 and 1.8 s at 0.23 and 0.24 GiB.

- **Flat field** ([receipt](../tools/objects/hst/programs/europa-14650.od9l12010_flt.reproduction.json)). The science array is bit-identical to the archive's, all 81,920 samples, and so is the data-quality array. The error array agrees to 3.4 × 10⁻⁷ relative.
- **Rectified image** ([receipt](../tools/objects/hst/programs/europa-14650.od9l12010_x2d.reproduction.json)). 87.9% of the science samples bit-identical, 99th percentile of the relative difference 1.6 × 10⁻⁶. The largest is 1.4%, on a pixel of 2.7 × 10⁻¹⁹: the rectified grid is mostly empty, so its median level is zero and "above the median" admits samples whose ratio means nothing. Two samples of 81,917 differ by more than a part in a thousand.
- **Extracted spectrum** ([receipt](../tools/objects/hst/programs/europa-14650.od9l12010_x1d.reproduction.json)). Gross, net and flux 99.3% bit-identical and within 1.5 × 10⁻⁷; the double-precision wavelengths within 2.3 × 10⁻¹⁵.

**[Programme 13040](../tools/objects/hst/programs/europa-13040.json)** (PI J. Saur, the oxygen-aurora observations), `obzp01010`: STIS/FUV-MAMA, G140L, 52X2, 865 seconds, 30 December 2012. 26 reference files; two runs took 2.2 and 1.7 s at 0.41 and 0.48 GiB.

- **Flat field** ([receipt](../tools/objects/hst/programs/europa-13040.obzp01010_flt.reproduction.json)): 82.8% of 1,048,576 science samples bit-identical, data quality identical, 99th percentile 1.6 × 10⁻⁷. **Rectified image** ([receipt](../tools/objects/hst/programs/europa-13040.obzp01010_x2d.reproduction.json)): 70.0% bit-identical, 99th percentile 8.2 × 10⁻⁷. **Extracted spectrum** ([receipt](../tools/objects/hst/programs/europa-13040.obzp01010_x1d.reproduction.json)): flux within 3.2 × 10⁻⁶, wavelength within 9.4 × 10⁻¹³.

**[Programme 15419](../tools/objects/hst/programs/europa-15419.json)** (PI L. Roth), `odr2a1010`: STIS/CCD, G750M, 52X2, a CR-SPLIT pair of 200 seconds each, 12 March 2019. Its association names two CRSPLIT exposures and two wavecals; the archive keeps the pair as two imsets of one raw file, so calstis is given that file and rejects cosmic rays across them. 21 reference files; two runs took 2.1 and 2.4 s at 0.39 and 0.38 GiB. Here the archive's own products were made with the same calstis, 3.5.0.

- **Flat field** ([receipt](../tools/objects/hst/programs/europa-15419.odr2a1010_flt.reproduction.json)). Both imsets: science and data quality bit-identical, 1,048,576 samples each.
- **Combined image** ([receipt](../tools/objects/hst/programs/europa-15419.odr2a1010_crj.reproduction.json)). 89.7% of the science samples bit-identical, data quality identical, 99th percentile 1.2 × 10⁻⁷.
- **Rectified from the combined image** ([receipt](../tools/objects/hst/programs/europa-15419.odr2a1010_sx2.reproduction.json)): 79.6% bit-identical, 99th percentile 1.5 × 10⁻⁷. **Extracted from it** ([receipt](../tools/objects/hst/programs/europa-15419.odr2a1010_sx1.reproduction.json)): flux within 2.1 × 10⁻⁷, wavelength within 4.1 × 10⁻¹³.

### WFC3

Programme 15419, `idr203wtq`: WFC3/UVIS, F631N, aperture UVIS2-C512C-SUB, 230 seconds, 30 August 2019. 18 reference files; two runs took 101.6 and 82.9 s at 0.96 and 0.88 GiB, most of it the charge-transfer correction. The archive's products were made with the same calwf3, 3.7.3.

- **Flat field and its charge-transfer-corrected form** (receipts [`_flt`](../tools/objects/hst/programs/europa-15419.idr203wtq_flt.reproduction.json), [`_flc`](../tools/objects/hst/programs/europa-15419.idr203wtq_flc.reproduction.json)). Both science arrays and both data-quality arrays are bit-identical to the archive's, 262,656 samples each; the error arrays agree to 4.0 × 10⁻⁷. The two products differ from each other by at most 460.09375 counts in our run and by exactly the same amount in the archive's, so the charge-transfer correction is reproduced as well as the flat field.
- **Drizzled** (receipts [`_drz`](../tools/objects/hst/programs/europa-15419.idr203wtq_drz.reproduction.json), [`_drc`](../tools/objects/hst/programs/europa-15419.idr203wtq_drc.reproduction.json)). The grid is the archive's exactly: 515 × 543, the same reference pixel, the same reference point, the same CD matrix to every digit the header prints, and the same `WCSNAME` (`IDC_2731450pi-GSC240`), so `stwcs.updatewcs` applied the same astrometric solution. 50.9% of the science samples are bit-identical and the median relative difference is 1.1 × 10⁻⁷.
  What is not reproduced is which pixels were kept. Over the 186,127 pixels the two runs give the same weight, the science values agree at a median relative difference of 0 and a 99th percentile of 2.2 × 10⁻⁷. The archive's run kept 32,102 pixels this one drops, and none the other way; those are flagged in the data-quality array (30,427 carry bit 256, full-well saturation). Which data-quality flags its drizzle was told to accept is **not recorded** in the drizzled product, in the calibrated exposure, or in any file the archive lists for this observation: the product's `D001*` cards state the geometry, kernel, drop size, scale, units and fill value, and nothing about the mask. Nothing here is set to close that gap.
  The sky is the archive's own, not a guess: its exposure records `MDRIZSKY = 0`, and `drizzle.mts` refuses a product whose exposure records any other value rather than trying to reproduce a sky estimate. A first run left to estimate its own sky subtracted −3971.06 counts and shifted every pixel by −17.27 counts per second.

### ACS

**[Programme 11085](../tools/objects/hst/programs/europa-11085.json)** (PI W. Sparks), `j9xe05010`: ACS/SBC, PR130L prism, two repeat exposures of 1300 seconds, 18 April 2007. The archive keeps a raw file for each, so calacs is given the association table and adds them. 7 reference files, 1.2 s at 0.22 GiB. Same calacs as the archive's, 10.4.1.

- **Both members' flat fields** (receipts [`e0q`](../tools/objects/hst/programs/europa-11085.j9xe05e0q_flt.reproduction.json), [`e1q`](../tools/objects/hst/programs/europa-11085.j9xe05e1q_flt.reproduction.json)) and **the summed product** ([`_sfl`](../tools/objects/hst/programs/europa-11085.j9xe05011_sfl.reproduction.json)): science and data quality bit-identical to the archive's in all three. The error arrays agree to 2.1 × 10⁻⁷.
- SBC is a photon counter, so calacs neither rejects cosmic rays nor corrects charge transfer for it; `RPTCORR` is what combines the exposures. The association's `_drz` is drizzlepac's, not calacs's, and is not attempted: the archive drizzled twenty exposures into it, which this observation does not pin.

### Both ends

- **Determinism.** Two runs of `od9l12010` in different working directories produced byte-identical `_flt`, `_x1d` and `_x2d` files, headers included. All five observations were re-calibrated a second time into the same working directories and every receipt came out with the same numbers.
- **Why STIS is not bit-identical everywhere.** For programmes 14650 and 13040 the archive's products were made with calstis 3.4.2 (19-Jan-2018) and the re-run uses 3.5.0 (02-Feb-2026), on a different machine. One reference file differs, `IMPHTTAB`, and it does not enter these arrays: neither product carries the photometry keywords that table sets. Every other reference file and every calibration switch is the same. The remaining differences sit at the last bit of single precision (2⁻²³ is 1.2 × 10⁻⁷). For programme 15419, where the software versions agree, the flat field is bit-identical and only the steps after it differ, still at single precision. Whether version or platform is responsible for the older pair is **not verified**: this route cannot run calstis 3.4.2, and nothing was tuned to close the gap.
- **Archive header quirks.** Two conventions repeat a keyword that the shared FITS reader refuses: a WFC3 `_flt` or `_flc` science extension carries the distortion records `D2IM1`, `D2IM2`, `DP1` and `DP2` four times each, and an ACS association table repeats `NEXTEND`. A drizzled product also draws rules across HISTORY cards, which puts an equals sign where a value card keeps one. [`product-file.mts`](../tools/objects/hst/product-file.mts) keeps the first card of a repeated keyword, reads commentary as commentary, and every receipt names the keywords that repeated.

## Line images of a moving target

A long-slit spectrum of a body smaller than the slit is already a picture in one direction: along the slit the body is resolved. At an emission line narrow enough it is a picture in both, because the across-slit axis then carries the body's own light at one wavelength. [`line-stack.mts`](../tools/objects/hst/line-stack.mts) takes every such exposure a programme holds, finds the body in each one, removes the sky and the sunlight the body reflects, turns what is left into Rayleigh with the frame's own `CONT2EML` slit conversion, and adds them up on a grid fixed to the body — north up, east left, measured in body radii, weighted by exposure. It writes one FITS file per line and subset, with the mean in `SCI` and its standard error in `ERR`, to a directory the caller names; nothing it produces is committed.

Nothing about one body is written into the tool. Which frames, lines, windows, subsets and rejection rule to use come from a pinned stack definition beside the programs, and so do the JPL Horizons requests that place the body and the raw text those requests returned — a re-run asks the network for nothing. The arithmetic sits in `line-stack-reduction.mts` and the geometry in `line-stack-ephemeris.mts`, both pure and covered by `line-stack.test.mts`.

Two things are worth knowing before re-using it. Horizons returns a `TLIST` sorted by time rather than in the order asked for, so every row is matched back to its epoch by the timestamp it carries; pairing by position mis-assigns the geometry without saying so, and the stacked disc comes out displaced and smeared. And every wavelength window the reduction uses has to fit inside the columns it reads: the tool refuses a window it would have to read short, because a row read past its end runs on into the next row.

### Europa's oxygen aurora

Every public STIS/FUV-MAMA G140L exposure of Europa — 140 frames, pinned in [`europa-oxygen-aurora.stack.json`](../tools/objects/hst/programs/europa-oxygen-aurora.stack.json), measured in its [receipt](../tools/objects/hst/programs/europa-oxygen-aurora.stack.reproduction.json). **112 frames are stacked**, 58.4 hours over 30 visits, from programmes 8224, 13040, 13619, 13679 and 15419. 28 are rejected: 26 transit-class targets, and 2 more because Jupiter's limb falls 7.4″ from Europa at their own epochs (**measured**, from Horizons at each mid-exposure). Published values below are Roth et al. (2016), doi:10.1002/2015JA022073.

| set | frames | disc < 1.25 R | 1.25–1.5 R | dusk/dawn | at the limb | e-folding |
|---|---|---|---|---|---|---|
| OI] 1356 Å, all | 112 | 45.4 R | 11.7 R | **1.66** | 52.7 R | **425 km** |
| OI] 1356 Å, east (leading) | 64 | 43.1 R | 12.4 R | 1.65 | 53.9 R | 418 km |
| OI] 1356 Å, west (trailing) | 48 | 48.3 R | 10.8 R | 1.68 | 51.2 R | 431 km |
| OI] 1356 Å, eclipse | 7 | 47.3 R | 13.8 R | 1.11 | 45.4 R | 530 km |
| OI 1304 Å, all | 112 | 20.4 R | −2.7 R | 1.52 | 17.8 R | 353 km |

- The disc glows at **45 R** inside 1.25 Europa radii at OI] 1356 Å and **20 R** at OI 1304 Å (**measured**; inside the published per-visit ranges of 33–158 R and 12–96 R).
- The glow is **lopsided**: the dusk half is **1.66×** the dawn half at 1356 Å and 1.52× at 1304 Å (**measured**; published 1.59 ± 0.33 and 1.66 ± 0.63). The brightness centroid moves only 0.14 R, so the disc is centred and it is the brightness that is lopsided.
- Above the limb the 1356 Å glow falls with an **e-folding length of 425 km** (**measured**; not corrected for Hubble's blur, which is not measured here).
- The seven eclipse frames carry no reflected sunlight at all and give the same disc brightness, 47 R (**measured**). That is the check that the reflected-sunlight removal is doing its job on the sunlit frames rather than leaving their reflected continuum in.
- Between 1.25 and 1.5 R the 1356 Å band is 11.7 R, under the published "<15 R above 1.25 R" (**measured**), with no background removed.

**Handedness is adopted, not proven.** Which way image `+x` — increasing wavelength — lies on the sky is settled here by a physical consistency argument, not by instrument documentation, which was not obtained. Stacking the two choices is not a mirror pair, because the roll angle runs over about 300° across these visits, so the wrong one reflects each frame about a different axis and washes any body-fixed asymmetry out. It does (**measured**):

| set | `+x` at `ORIENTAT−90` (adopted) | `+x` at `ORIENTAT+90` |
|---|---|---|
| OI] 1356 Å, all | **1.66** | 1.09 |
| OI] 1356 Å, east | 1.65 | 1.08 |
| OI] 1356 Å, west | 1.68 | 1.10 |
| OI 1304 Å, all | 1.52 | 0.95 |

Only `ORIENTAT−90` gives a coherent asymmetry, it appears in both lines and both elongations, and its size and sense match the published ratios. **Not verified from documentation**: if the adoption is wrong, every image is mirrored east–west and dusk and dawn swap.

**Limits.** Every one of these is in the receipt as well.

- Reflected solar OI 1304 is **not removed** — that needs a measured solar spectrum this route does not hold — so the 1304 Å disc values are upper limits. Above 1.1 R there is no surface reflection and the 1304 numbers stand.
- No TIME-TAG airglow cut is possible from `_x2d` products, which are whole exposures, so the 1304 Å images keep more geocoronal airglow than the published ones. It fills the slit and comes out in the mean at the sky step, so it costs signal-to-noise rather than accuracy.
- The far field is not exactly zero. Between 2.5 and 3 R this run measures −1.7 R at 1356 Å and −0.6 R at 1304 Å, and the 1304 Å band above the limb comes out at −2.7 R, so the reflected-sunlight model takes a little too much off. **Not verified**: nothing here establishes the size of that beyond the measurement.
- 12 of 30 visits take the median row offset of the visits whose reflected continuum was detected, and 7 of 30 — the five eclipse visits and two of low signal — sit at the slit centre rather than at a fitted position. **Assumed, not measured**, for those.
- The multiplet companions at 1358.5, 1304.9 and 1306.0 Å are not separated; they displace the centroid by 0.03–0.05 R toward dusk. No anamorphic correction is applied, and Hubble's blur is not measured. **Not verified.**
- Programme 15419 (2018–20) is stacked here and is outside the published 2016 set, so the totals are not comparable to Table 1 of that paper.

## Bands mapped from a slit scanned across a body

A slit narrower than the body and stepped across it samples the surface twice over. Along the slit the detector rows are already a picture; the steps are the other direction. Every row is a whole spectrum, so an absorption band can be measured in each of them and the measurements laid back on the body. [`slit-scan-map.mts`](../tools/objects/hst/slit-scan-map.mts) does that and writes a full-world longitude-latitude map of one band's strength.

It works the way the line stack does. Which frames, which reference spectrum, which continuum windows, which band, which grid and which rotation model come from a pinned scan definition beside the programs, together with the raw JPL Horizons responses that place the body, so a re-run asks the network for nothing. The arithmetic sits in [`slit-scan-reduction.mts`](../tools/objects/hst/slit-scan-reduction.mts), pure and covered by `slit-scan-map.test.mts`. Where the body sits in each frame is measured, not assumed: along the slit from the middle of the chord the disc cuts in the sunlight it reflects, and across the slit from the offset that best explains every step's chord against a disc of the ephemeris radius. From there the body geometry is the one every ground-based photograph here uses (an IAU pole model from a text PCK through `observerCamera`), and the projection and the weighted combination of the visits are `projectBandMap` and `combineBodyMaps`, the same parts that place a JWST cube or an ALMA image on a body.

Two things are worth knowing before re-using it. The x2d products read here are the archive's own: this route already proves it reproduces this instrument mode bit for bit, so the 60 frames are not re-calibrated from raw for the map. And **which way the aperture's first axis lies on the sky is not assumed**. `--mirror` runs the opposite choice as well, and the visits that saw the same ground decide between them.

### Europa's sodium chloride

Every public STIS/CCD G430L exposure of programme 14650 (PI M. Brown), 60 frames, fifteen slit positions in each of four visits of 2017, pinned in [`europa-salt-map.scan.json`](../tools/objects/hst/programs/europa-salt-map.scan.json) and measured in its [receipt](../tools/objects/hst/programs/europa-salt-map.scan.reproduction.json). The published account is Trumbo, Brown & Hand (2019), *Sodium chloride on the surface of Europa*, Science Advances **5**, eaaw7123, [doi:10.1126/sciadv.aaw7123](https://doi.org/10.1126/sciadv.aaw7123), whose method this follows: single rows of the rectified images at the 0.05" pixel scale, divided by a solar reference spectrum, a third-order polynomial continuum fitted between 310 and 550 nm excluding 350 to 530 nm, and the continuum-removed residual integrated to an equivalent width. Each choice is recorded in the definition with the sentence it comes from, and the ones the paper does not settle are marked as this repository's.

**All 60 frames are used**, none rejected; 600 seconds in all. The map covers **82.3% of the surface**, 7,611 of its 40,150 cells seen by two visits or more. The scan's own chords fit a disc of the ephemeris radius to under two detector pixels in every visit (**measured**), and the sub-observer longitudes this run derives, **45.9, 132.6, 223.5 and 313.6°W**, sit within about a degree of the 47, 133, 224 and 314°W of the paper's Table 1 (**measured**).

**The across-slit direction is measured, not adopted.** Two visits that saw the same ground agree only when that direction is right; the wrong one reflects each visit's picture about its own slit and moves the ground under it. It does (**measured**): `ORIENTAT-90` gives four agreeing visit pairs, mean correlation **0.60** over 7,611 shared cells, while `ORIENTAT+90` anti-correlates in two of the four, at −0.75 and −0.82, for a mean of −0.09. So `+POSTARG1` lies ninety degrees round from the slit at `ORIENTAT-90`, the same sense the [oxygen aurora](#europas-oxygen-aurora) adopts on the FUV MAMA from a physical argument. That one is still not proven; this one is measured, on a different detector.

#### Where zero is

The published continuum is fitted to each spectrum on its own, which sets no common zero: a polynomial anchored outside the band follows each spectrum's own shape, so a place whose reflectance curves differently between the anchors reads a band strength it does not have. The honest test is the paper's own statement that the feature is on the leading hemisphere only, so the trailing hemisphere should read nothing. With the published continuum alone it does not (**measured**):

| | trailing hemisphere | leading hemisphere | strongest cell |
|---|---|---|---|
| published continuum alone | **−79.8 ± 3.3 Å** (not zero) | +22.9 Å | 102.4 Å at 69.5°W, 15.5°S |
| against the featureless spectrum | **+2.6 ± 4.8 Å** (consistent with zero) | +113.4 Å | 193.6 Å at 94.5°W, 16.5°N |

Two causes were separated with numbers, not guessed at.

- **Not the solar reference.** The reference divides out to 1.2–2.5% above 4400 Å but only 5–15% below 4000 Å, and that residual is **common to all four visits** (correlation 0.72–0.99 between visits on opposite hemispheres), so it is solar line structure the reference cannot resolve rather than noise. Removing it cuts the blue continuum anchor's scatter from 7–9% to 2.4–4.6% and moves the band strength by under 4% (**measured**). It is not what set zero wrong.
- **The continuum windows.** They leave 1800 Å between the anchors unconstrained, and the two hemispheres curve differently across it. A second-order continuum, which the paper reports as giving qualitatively identical maps, gives values two to three times different here (**measured**), which is the same finding from the other side.

So every row is measured against the mean of the rows that show no band, which is the paper's own remedy for its own highest-quality spectrum: "we then divided by the average of all spectra from regions where the 450-nm feature is absent". Which rows those are is decided by a first pass with the published continuum and nothing else: **756 of 1,248 on-disc rows**. Dividing two spectra the same instrument took at the same resolution also cancels whatever the reference got wrong, since the same solar lines sit in both.

**The featureless set averages to zero by construction, so say what that test is worth.** The rows are chosen by their own spectra and not by where they are on the body, but most of them are trailing rows, so the set and the test overlap. The trailing median landing at +2.6 ± 4.8 Å is a weak confirmation, not an independent one.

**And the leading hemisphere now carries a pedestal.** Its median is 113.4 Å against an interquartile spread of only 25.9, so most of what the map shows on that side is a step across the whole hemisphere rather than the concentration in chaos terrain the paper describes. The featureless rows being mostly trailing ones means whatever differs broadly between the two hemispheres' continua enters the band. **Not verified**: this stage does not separate that from the sodium chloride band. The honest measure of the feature is the **80.2 Å** by which the strongest cell stands above its own hemisphere, at **94.5°W, 16.5°N**, against the about 85°W the paper gives for its deepest absorptions in Tara Regio.

#### What the error plane is

The band's sigma carries the fitted continuum, not only each band pixel's own noise. One continuum divides every pixel of the band, so the anchors' noise enters the integral once and correlated across it, and treating the fitted curve as exact understates the error by more than an order of magnitude. On synthetic flat spectra with 1% anchor noise, 400 realizations scatter by an amount the reported sigma matches to better than 10%, and raising the anchor errors a hundredfold raises the sigma a hundredfold (**measured**). On Europa this lifts the median of the exported `ERROR` plane from **1.42 to 17.86 Å**, and the per-cell statistical error from 1.3 to 16.3 Å on the leading hemisphere and 1.6 to 19.4 Å on the trailing one. **No mapped value moved.**

The spectrum every row is divided by has an error of its own, and it is carried too. It is a plain exposure-weighted mean, so its error is the matching `sqrt(sum w² σ²) / sum w`: two independent samples of sigma 0.1 average to 0.0707, not to nothing. That error reaches the equivalent width through the same derivatives as the continuum fit, and on Europa it contributes a median of **1.67 Å** of the 17.86 Å (**measured**). **It is common to every cell.** One spectrum divides the whole map, so every cell carries the same draw of it and it does not average down: a hemisphere median of many thousands of cells is still no better determined than that 1.67 Å, against the 4.8 Å the cell spread gives. The receipt states it separately and the product carries it as `COMMONER`.

That plane is the statistical error alone. The continuum model's systematic, which is what the pedestal and the overshoot above are, is not in it and is not reduced to a number per cell anywhere.

Two more rules keep a measurement from appearing where there is none. Every band pixel keeps the width of its own bin, and a band is measured only where at least **90% of its pixels were observed with no unobserved run longer than 5 pixels** (this repository's choice, stated in the definition); otherwise the cell is empty, never interpolated. And every slit position is placed by its own commanded offset rather than by counting array slots, with an interval wider than half again the scan's own step left unread. The Europa scan is regular in all four visits and its band is completely observed, so neither rule changes a value here; both stop a scan that lost a frame, or a band read through holes, from reading as a detection.

**Limits.** Every one of these is in the receipt as well.

- The band strength's absolute scale rests on a reference spectrum this repository chose, CALSPEC's `sun_reference_stis_002`, because the ASTM E-490 the paper used is not held here.
- The zero test counts one resolution element as the 150 km the paper gives at the sub-observer point. That is the best the data reach, so it counts the most independent elements and gives the smallest error the median can honestly claim; away from that point the elements are larger and so is the error. It uses the spread of the cells rather than the `ERROR` plane, because neighbouring cells share a resolution element: the plane's 17.82 Å over 480 independent elements would give 0.8 Å, well under the 4.8 Å the spread gives.
- Hubble's blur is not removed and no anamorphic correction is applied, so a 150 km resolution element is smeared across the neighbours of a 27 km map cell. The map is smoother than its grid.
- The rectified products carry no signal off the slit, so the background step subtracts a measured zero and does nothing. Scattered light varying along the slit underneath the body is neither measured nor modelled.
- The paper's "small variations on these parameters ... when necessary" are not reproduced.
- The G750L half of the programme is not read, so the 720 nm M-centre upper limit the paper places is not reproduced.

## An exposure rebuilt in a moving target's frame

A MAMA detector in TIME-TAG mode records a position and a time for every photon it counts, so an exposure of a body that moves is not one picture but the ingredients of any picture you care to make. [`timetag-frame.mts`](../tools/objects/hst/timetag-frame.mts) makes the one that is usually wanted: the body standing still. It follows the body across the detector through the exposure, then counts every event again on a grid fixed to the body, north up and east left, at a stated number of kilometres to the pixel. Nothing is interpolated and no pixel is resampled, because an event is simply counted where the body was when it arrived.

The image carries a real sky WCS about where the target stood at the middle of the exposure, and the stage reads its own product back with [`fits-sky.mts`](../tools/fits/fits-sky.mts) before it finishes: a grid this stage could not state as a sky image never leaves the run. Beside the counts it writes the exposure-normalised image, the background it fitted, the model it compared against and the per-pixel significance, a [product record](../tools/objects/product-record.mts) pinning what went in and what each check establishes, and a reproduction receipt. The arithmetic is in [`timetag-reduction.mts`](../tools/objects/hst/timetag-reduction.mts), covered by `timetag-frame.test.mts` on synthetic event lists.

Four things are worth knowing before re-using it. The good-time table matters: a buffer dump pauses the counting, so the exposure's wall span is longer than the time it collected, and slicing the span without it puts most of the events in the last slice. The body is found by the light it blocks, scored in standard deviations of Poisson noise against a bright surround, not by contrast: scoring contrast finds the unlit corner of the detector every time. One coordinate convention runs through the whole stage, stated at the top of `timetag-reduction.mts`: pixel `i` covers `[i, i + 1)` with its centre at `i + 0.5`, a continuous coordinate is binned with `Math.floor`, the body stands at continuous `N / 2`, and the FITS reference pixel for it is `N / 2 + 0.5`. Mixing that with rounding puts a symmetric cloud of events half a pixel off its own centre, which here is 17.5 km on each axis, and it moves the limb statistics (below). And the detector's geometric distortion is **not** corrected, because the archive applies that only when it rectifies an image.

### Europa's transit of Jupiter, 26 January 2014

`oc7u02g2q`, STIS/FUV-MAMA through the F25SRF2 filter, programme 13438 (PI W. Sparks), pinned in [`europa-transit-2014-01-26.timetag.json`](../tools/objects/hst/programs/europa-transit-2014-01-26.timetag.json) and measured in its [receipt](../tools/objects/hst/programs/europa-transit-2014-01-26.timetag.reproduction.json). This is the image Sparks et al. (2016), doi:10.3847/0004-637X/829/2/121, read a plume candidate off.

| quantity | measured | published |
|---|---|---|
| events in the file | 54,043,337 | |
| good time | 2023.2 s over a 2507.2 s span, 23 intervals | 2023.24 s |
| Europa's drift across the detector | 21.2 pixels | a commanded Level 3 drift, size not stated |
| the drift fit against the slice centres | 2.3 pixels at the median, 4.9 at worst | centring good to about one pixel |
| Europa's radius on the 35 km grid | 44.6 pixels | **44.6 pixels** |
| darkest bin, 1.0 to 1.25 R, latitude -40 to -60 | 3.10 (5x5), 3.96 (7x7) | 3.9 and 4.0 (Sparks et al.) |
| the same bin against the limb annulus's own scatter | **1.74** (5x5), 1.65 (7x7) | 3.3 (+0.4, -0.5) (Giono et al. 2020, doi:10.3847/1538-3881/ab7454) |
| the same latitude band north of the equator | 2.01 (5x5), 2.64 (7x7) | |
| scatter in a control annulus 1.5 to 2.5 R | 1.27 (5x5), 1.46 (7x7) | one, if the model were complete |

- Europa's radius comes out at **44.6 pixels** on the 35 km grid from its apparent diameter at mid-exposure, which is the figure the paper states for its own frame (**measured**, agreeing with the published value).
- The darkest bin off the limb does fall inside the region Sparks et al. measure, at latitude **-47 degrees**, one pixel above the limb (**measured**). Its formal Poisson significance is 3.10 on 5x5 bins; the darkest 7x7 bin sits a little lower on the limb, at -52 degrees, and comes to 3.96.
- That formal figure is **not** the significance it looks like. A control annulus far from Europa, where the model should leave pure counting noise, scatters by **1.27** rather than one, and the limb annulus itself scatters by **1.78**; the darkest bin is **1.74** times that scatter (**measured**), and 1.65 on 7x7 bins. A bin of 2.01 sits in the mirrored latitude band north of the equator, where no plume was claimed.
- **Half a pixel of registration moves these numbers, which is the whole point of the argument.** Correcting the rounding described above, a shift of about 0.7 pixels on this grid, took the 5x5 bin from 3.53 to 3.10 and its mirrored twin from 2.96 to 2.01, and took the 7x7 bin the other way, from 3.08 to 3.96 (**measured**, the same events reduced twice). Giono et al. name exactly this: a misalignment of a pixel distorts the limb statistics. In both reductions the darkest bin stays under twice the limb annulus's own scatter.
- **Not verified, and the reason the numbers above are not a reproduction of anyone's.** Neither model the paper builds is built here: not the Jovian background accumulated from one-second slices in Jupiter's own rest frame with Europa's path masked out, and not the Europa model from the USGS Galileo mosaic with an Oren-Nayar illumination function and a composite TinyTim point-spread function. A degree-3 polynomial fitted outside 1.6 Europa radii and the azimuthal average of the data stand in for them, and Jupiter's belts survive that fit. Geometric distortion is not corrected either. What is comparable with the paper is where the darkest bin lies and how much the statistics really scatter, not the significance itself.

## A coronagraph's starlight removed

A coronagraph blocks a star's core, but the light it diffracts and scatters is still far brighter than a debris disc beside it. The archive stops there: MAST's ACS/HRC coronagraph products still carry the star. [`psf-subtract.mts`](../tools/objects/hst/psf-subtract.mts) is the stage that removes it, by reference-star differential imaging: a star of similar colour, observed behind the same occulter in the orbits next to the science target, carries the same pattern of starlight, and scaled and shifted onto the science star it cancels it.

A subtraction is a record, `programs/<id>.psf-subtraction.json`: the pinned program, and for each filter the science associations at each telescope roll and the reference star's, each a long exposure and a shorter one. Every association is re-calibrated from raw by `calibrate.mts`, with the coronagraphic spot flat CRDS selects. Then, per filter and roll:

1. Each star's long and short CR-rejected frames are put in electrons per second and merged. A pixel the long frame flags as saturated is taken from the short frame.
2. Each star is found as the point about which its PSF is most nearly symmetric under a half turn, over an annulus with the disc's strip left out. The brightest pixel near the core is not the star: the long frames saturate and bleed there.
3. The reference is divided by the two stars' flux ratio in the band, **a published value the record cites**, and shifted onto the science star by cubic spline. Only the shift is fitted, by least squares over an annulus about the star with the disc's strip left out. The scale a free fit would choose there is reported beside it as a check and not used, because a paper's number outranks one fitted here.
4. The shifted reference is subtracted, and the occulter and every flagged pixel are left blank. stwcs writes the distortion model into the frame's WCS, and AstroDrizzle puts it on the sky north up, with the kernel and scale of the archive's own drizzled product of that observation.

Each drizzled result has its [product record](../tools/objects/product-record.mts) beside it: the four calibrated frames at their digests, the flux ratio and its source, the fitted shift, the free-fit check, the residual before and after, and the star's sky position. `psf-subtract.test.mts` checks that every association a subtraction names is pinned in its program through its band, on the star it says, and that a missing or impossible flux ratio is refused.

### Beta Pictoris, programme 9987

[`beta-pictoris-9987.psf-subtraction.json`](../tools/objects/hst/programs/beta-pictoris-9987.psf-subtraction.json) is the run of Golimowski et al. (2006, AJ 131, 3109): Beta Pictoris behind the 1.8 arcsecond spot on 1 October 2003 through F435W, F606W and F814W at two rolls, and alpha Pictoris, the reference, in the orbit before. The flux ratios are theirs, from Synphot (Section 2.2): alpha Pic over beta Pic is 1.65, 1.75 and 1.90, each uncertain by 2%. Measured on 22 September 2026 at CRDS context `hst_1358.pmap`.

| band, roll | fitted shift (pixels) | scale used | free-fit scale | residual before, after (e⁻/s) |
|---|---|---|---|---|
| F435W, roll 1 | (-0.38, +0.62) | 0.606 | 1.02 | 2.06, 1.26 |
| F435W, roll 2 | (-0.32, +0.55) | 0.606 | 1.04 | 2.16, 1.30 |
| F606W, roll 1 | (-0.76, +0.38) | 0.571 | 1.09 | 4.53, 3.19 |
| F606W, roll 2 | (-0.67, +0.28) | 0.571 | 1.12 | 4.78, 3.28 |
| F814W, roll 1 | (-0.62, +0.37) | 0.526 | 0.87 | 2.47, 1.48 |
| F814W, roll 2 | (-0.69, -0.50) | 0.526 | 0.87 | 2.60, 1.52 |

**The shifts agree with the paper.** Golimowski et al. found the two stars 0.8 pixel apart; the shifts here are 0.6 to 0.9 pixel. The two rolls agree to 0.1 pixel in F435W and F606W. In F814W the second roll's vertical shift is 0.9 pixel from the first's, which is **not explained**.

**The scale does not.** A free fit would scale alpha Pic's light 1.7 to 2.0 times higher than the paper's ratio allows. The fit annulus holds disc light, so some of that is expected, but not all of it: 9 to 12 arcseconds out and more than 6 arcseconds off the midplane, where the disc is faint, beta Pic's raw halo in F435W is 0.81 of alpha Pic's in both the long and the short frames, where the paper's ratio predicts 0.61. The paper refined its normalisation by eye and does not print the final factors. So the stated ratios are used, and what they leave, about a quarter of beta Pic's own halo far from the disc, stays in the image.

**The disc's colour does not match the paper's.** Divided by the star's brightness from the paper's magnitudes and Sirianni et al.'s (2005) zero points, the midplane 40 to 100 au out gives F606W/F435W 0.94 and F814W/F435W 0.92: slightly bluer than the star. Golimowski et al. measure it redder, F435W−F606W about +0.07 magnitude before deconvolution, a ratio near 1.07. The light the subtraction leaves beside the disc, 15 to 35 au off the midplane, is 16 to 19% of the midplane there, and it is bluer than the star (F606W/F435W 0.81, F814W/F435W 0.77), because the paper's ratios leave a different share of the halo in each band. That pulls the midplane toward blue. How much of the difference it explains is **not measured**.

## Archive-final products of retired instruments

WFPC2, the Faint Object Spectrograph and the Goddard High Resolution Spectrograph cannot be re-calibrated here: their pipelines are retired and are not in `hstcal`. That is a fact about this repository, and it is not the same fact as whether their observations are usable. STScI says what happened to them: "Data from HST legacy instruments are preserved in a static form, and there are no plans to regularly reprocess these data... For ACS/HRC, FOC, FOS, GHRS, NICMOS, and WFPC2, no further improvements in the calibration for these instruments are expected. The user is provided with a copy of the raw and final calibrated data from the archive once a request is made." ([Archive overview](https://hst-docs.stsci.edu/hstdhb/1-obtaining-hst-data/1-1-archive-overview), section 1.1.1.) The calibration is frozen, not missing, and nearly three hundred thousand public observations sit behind it.

So those instruments get a route of their own, `archive-final`, which makes nothing and pins everything. [`archive-final.mts`](../tools/objects/hst/archive-final.mts) takes one observation and pins the whole scientific product its handbook names, part by part: the science values, the wavelengths or the world coordinate system, the propagated statistical error and the data-quality flags, **where the archive supplies them**. A part it does not supply is written into the pin as missing, with the reason, so a reader never has to notice an absence: calwp2 writes no error array at all, and the WFPC2 program says so and says where the handbook states it.

Running the stage downloads those files, records the sha256 of the bytes it actually got, and reads every one of them with this repository's own FITS reader. The legacy products are "waivered" FITS, the format STScI made to carry a GEIS group image in one file: the samples are the PRIMARY unit, the GEIS groups are its second axis, and the group parameters follow in a table extension. WFPC2 is also distributed as ordinary multi-extension FITS, one 800 × 800 chip per extension, which is the form pinned here. A unit the reader cannot read stops the run and says why; nothing is inferred around it.

Which observation the bytes are is checked, not assumed. MAST's catalogue and the files' own headers are compared field by field against the pin (instrument, configuration, optical element, aperture, target, proposal, exposure start and end), and a disagreement stops the run rather than being reported. The FOS spells its grating `H27` in the wheel card and `G270H` in the catalogue, so both spellings are pinned and neither side is translated. Whatever calibration provenance the headers carry is recorded beside the pin: the WFPC2 products name calwp2 2.5.3 and OPUS 2009_2a, the FOS and GHRS products name no calibration version at all, which the record states rather than leaving blank. None of it is software that ran here, because none did.

**What this establishes, and what it does not.** Retrieval establishes origin and integrity: these bytes are the archive's own final product, at the size and digest recorded, for the observation the catalogue and the headers agree on. It is written as [`archive-origin`](virtual-telescopes.md#the-five-kinds-of-evidence) evidence, never as `archive-agreement`, and the [ledger](hubble-ledger.md) keeps it in a column of its own: a qualified archive-final program is never counted as a re-calibration anywhere.

### Qualified on Europa

One observation per instrument, pinned, downloaded, read whole and measured on 19 September 2026. The summaries below are in each program's [product record](../tools/objects/hst/programs).

**WFPC2/PC**, [`europa-wfpc2-11085`](../tools/objects/hst/programs/europa-wfpc2-11085.archive-final.json): `u9xe010cm`, a 5-second F631N exposure of 20 March 2007, programme 11085 (PI W. Sparks), the WFPC2 half of the visit whose ACS/SBC prism exposures are already pinned. Supplied: the calibrated science data (`_c0m`, four 800 × 800 chips) and its data quality (`_c1m`); the world coordinate system is in the planetary camera's own header. **Missing: the uncertainty.** calwp2 writes no error array, and table 2.1 of the [WFPC2 data handbook](https://www.stsci.edu/instruments/wfpc2/Wfpc2_dhb/wfpc2_ch22.html) lists only the calibrated science data and its data quality as its calibrated science output.

- The transform in the chip's header gives **0.04554 arcsec to the pixel** (**measured**, the square root of the CD matrix determinant).
- Europa is at pixel **(161, 186)** and is **17.4 pixels across**, 0.794 arcsec, taking the disc as everything connected above half its own five-by-five median level over the background (**measured**). That is the width of the half-level contour, not a fitted limb, and Hubble's blur is not removed.
- **No pixel is saturated**: nothing in the data quality carries flag 8, A/D converter saturation ([table 3.4](https://www.stsci.edu/instruments/wfpc2/Wfpc2_dhb/wfpc2_ch34.html)) (**measured**). 82,308 of the chip's 640,000 pixels are flagged at all, 79,367 of them flag 2, a calibration file defect, and 2,941 flag 258, a pixel above a charge trap.

**FOS/BL**, [`europa-fos-5837`](../tools/objects/hst/programs/europa-fos-5837.archive-final.json): `y2p60503t`, a 130-second G270H spectrum through the 0.86 arcsec B-3 aperture, 22 June 1995, programme 5837. All four parts supplied, as [section 30.1](https://www.stsci.edu/documents/dhb/webvol2/c05_fosdata.fm1.html) of the FOS data handbook lists them: wavelengths (`_c0f`), fluxes (`_c1f`), the propagated statistical error (`_c2f`) and the calibrated data quality (`_cqf`).

- **2,222 to 3,302 Å** in one group of 2,064 samples, median step **0.525 Å** (**measured**).
- Median signal to noise **82**, ninetieth percentile 189, against the archive's own propagated error (**measured**). That error "does not include errors caused by sky and background subtraction, flatfields, and sensitivity", in the handbook's words, so it is a floor.
- **16.7% of samples are flagged**: 332 at 170 (an intermittent noisy channel), 10 at 50 (sampling under half of nominal) and 2 at 700 (filled after the geomagnetic image-motion correction) (**measured**).

**HRS/1**, [`europa-ghrs-5376`](../tools/objects/hst/programs/europa-ghrs-5376.archive-final.json): `z2cf0206t`, a 326-second G140L far-ultraviolet spectrum through the large science aperture, 2 June 1994, programme 5376. All four parts supplied, as [table 35.1](https://www.stsci.edu/documents/dhb/webvol2/c10_ghrsdata.fm1.html) of the GHRS data handbook lists them. This product keeps the exposure's **four readouts as groups**, so it is four spectra of 2,000 samples rather than one of 8,000, and the sampling is measured inside each group rather than across the seam between them.

- **1,204 to 1,499 Å**, median step **0.143 Å** (**measured**).
- **Median signal to noise −0.14**, ninetieth percentile 0.77 (**measured**). The median sample is consistent with nothing: Europa reflects almost no sunlight at these wavelengths, so the background-subtracted spectrum scatters about zero. That is the honest state of this exposure, and it is what the route is for: the file is established, a detection is not.
- **3.2% of samples are flagged**, all at flag 30 (**measured**).

An instrument with no qualified dataset keeps its archive products listed in the ledger and its route unqualified. FOS/RD, HRS/2, WFPC2/WFC and the rest are in that state: the archive holds final products for them and nothing here has pinned one.

## Limits

- No COS, WFPC2, NICMOS, FOC, FOS, GHRS, WFPC, HSP or FGS observation can be **re-calibrated** here: `calcos` is not installed, and the rest of those pipelines are retired and not in `hstcal`. For WFPC2, the FOS and the GHRS the archive's own final products are pinned and read instead ([above](#archive-final-products-of-retired-instruments)); for the others nothing is pinned. The [ledger](hubble-ledger.md) says how much of the archive each of those is.
- The archive-final route pins one observation per program and makes nothing. It does not re-calibrate, it does not compare, and it does not establish that the archive's calibration is right. Nothing was measured about where Europa is on the sky in any of these three products, and no ephemeris was consulted: the picture's disc is where the light is, not where a body was.
- ACS/HRC has been run on programme 9987: calacs reproduces the archive's combined product of `j8qj15060` with 72% of samples bit-identical and the largest relative difference 1.5e-5. WFC3/IR, STIS/NUV-MAMA and ACS/WFC are handled by pipelines that are installed here, and no exposure of any of them has been run. Whether they reproduce is **not verified**.
- The comparison reads two- and three-axis image extensions and binary tables. A four-axis extension is reported as uncomparable, not sampled. No image extension over 64 million samples and no table file over 64 MiB is read.
- The re-run trusts the raw files and the support files as the archive stores them. Nothing upstream of `_raw` is reproduced.
- The relative difference is taken over samples above the median level. On a rectified image whose median level is zero that admits near-empty pixels, so the quantiles matter more than the largest value.
- Only a single-image drizzle is attempted, and its weight image is not reproduced (above).
- The ledger pass asks MAST about fifty times and takes half an hour or more; the cone searches are the slow part, and one of them once stopped answering altogether. Each request has a four-minute deadline and three attempts; a cone search that still will not answer is recorded as unanswered rather than throwing the pass away. `--local` rewrites only the pinned-and-checked columns, from the ledger already on disk.
- Only the Beta Pictoris disc is drawn. The PSF subtraction handles one reference star per band and fits only a shift; it does not use several references or a principal-component model.

## Re-running

```sh
source ~/.nvm/nvm.sh && nvm use 24
node tools/objects/hst/toolchain.mts install
node tools/objects/hst/toolchain.mts verify
node tools/objects/hst/archive.mts europa-15419 hst_1358.pmap idr203wtq odr2a1010
node tools/objects/hst/calibrate.mts europa-15419 idr203wtq .local/hst/europa-15419-idr203wtq
node tools/objects/hst/compare.mts   europa-15419 idr203wtq .local/hst/europa-15419-idr203wtq/run
node tools/objects/hst/drizzle.mts   europa-15419 idr203wtq .local/hst/europa-15419-idr203wtq
node tools/objects/hst/compare.mts   europa-15419 idr203wtq .local/hst/europa-15419-idr203wtq/drizzle
node tools/objects/hst/archive-ledger.mts --write
node --test tools/objects/hst/*.test.mts
```

The line stack is its own command, and takes a directory that already holds the pinned `_x2d` frames:

```sh
node tools/objects/hst/line-stack.mts europa-oxygen-aurora .local/hst/europa-aurora output/europa-aurora --mirror --receipt
```

It reads each frame once to place its visit and once to stack it, and holds no frame after it has been used. `--mirror` stacks the opposite handedness as well, which is the evidence above; `--receipt` writes the reproduction receipt beside the definition; `--fetch` allows a Horizons request the pinned responses do not already answer, and without it a missing one is an error. A run over the 112 Europa frames takes about fourteen seconds.

The slit-scan map is its own command as well, over a directory that already holds the pinned `_x2d` frames and the pinned reference spectrum:

```sh
node tools/objects/hst/slit-scan-map.mts europa-salt-map .local/hst/europa-14650 output/europa-salt-map --mirror --receipt
```

It reads each frame three times (once to place its visit, once for the first pass that finds the rows with no band, once to measure every row against them) and holds no frame after it has been used. `--mirror` maps the opposite across-slit direction as well, which is the evidence above; `--receipt` writes the reproduction receipt beside the definition; `--fetch` allows a Horizons request the pinned responses do not already answer. A run over the 60 Europa frames takes under three seconds.

The TIME-TAG rebuild is its own command, over a directory that already holds the pinned event list and its support files:

```sh
node tools/objects/hst/timetag-frame.mts europa-transit-2014-01-26 .local/hst/europa-13438 output/europa-transit-2014 --receipt
```

It reads the event list twice, once to follow Europa across the detector and once to count the events on Europa's grid, and holds no block of events after it has been counted. Every pinned file is checked by digest before a byte of science is read. `--receipt` writes the reproduction receipt beside the definition; `--fetch` allows the one Horizons request the pinned response does not already answer, and without it a missing one is an error. A run over 54 million events takes about five seconds and writes the product record beside the image.

The archive-final route is one command per program, and installs nothing at all:

```sh
node tools/objects/hst/archive-final.mts europa-wfpc2-11085 .local/hst/archive-final/europa-wfpc2-11085
node tools/objects/hst/archive-final.mts europa-fos-5837    .local/hst/archive-final/europa-fos-5837
node tools/objects/hst/archive-final.mts europa-ghrs-5376   .local/hst/archive-final/europa-ghrs-5376
node tools/objects/hst/archive-ledger.mts --local
```

It downloads the pinned files into the directory given, writes the product record beside them, and commits a copy of that record beside the program as `<id>.archive-final.product.json`, because the files themselves are not committed and the ledger still has to read what was pinned. The first run records each file's sha256 into the program; every later run is refused unless the bytes are those. The three together are under 16 MB and take a few seconds once downloaded.

`.local/hst` is ignored by git; `--raw <dir>` takes the pinned files from a directory that already holds them instead of downloading. The other four re-calibrated observations are the same `archive`, `calibrate` and `compare` commands with `europa-14650 od9l12010`, `europa-13040 obzp01010`, `europa-15419 odr2a1010` and `europa-11085 j9xe05010`.
