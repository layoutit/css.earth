# Hubble

Hubble images and spectra reach this project as MAST products. This guide describes how one archive observation is pinned, re-calibrated here from its raw exposure on Hubble's own software, and checked against the archive's own product. The route is the one [JWST imaging](jwst-imaging.md) and [interferometric imaging](interferometric-imaging.md) follow: pin, re-run, compare, write a receipt. What the archive holds, and how much of it this route reaches, is the [Hubble ledger](hubble-ledger.md).

Nothing is drawn from Hubble data yet. What exists is the toolkit, its proof on five Europa observations across three instruments, and one measurement made from the archive's own products: [line images of a moving target](#line-images-of-a-moving-target), stacked in the target's frame.

## Stages

1. **Install the software.** `node tools/objects/hst/toolchain.mts install` builds the pinned environment under `output/toolchains/hst` (ignored by git). The instrument pipelines are STScI's own executables from conda-forge's `hstcal`; the Python wrappers, drizzlepac and CRDS come from [requirements.lock](../tools/objects/hst/requirements.lock), installed without further resolution. `verify` prints the versions. The environment records the digest of [toolchain.json](../tools/objects/hst/toolchain.json) and the lock, and a run refuses an environment built from other pins.
2. **Pin.** `archive.mts <program id> <crds context> <obs_id>...` asks MAST what the observation holds: the raw exposures and the files the pipeline reads beside them (`_wav` wavecal, `_asn`, `_spt`, `_jit`), and the calibrated products the archive produced (`_flt`/`_flc`, `_crj`/`_sfl`, `_x2d`/`_sx2`, `_x1d`/`_sx1`, `_drz`/`_drc`), each by MAST URI and byte count. If the observation has an association table, that table is read and stored: the exposures it names, what each one does, and the rootname of the product it builds. Every file of every named exposure is pinned with it, and nothing else may be. The program also records what the observation is — instrument, detector, optical element, aperture, exposure start and end, target, proposal — and every `*CORR` calibration switch, read from the raw files' own primary headers over range requests and checked against what the archive catalogue says. Digests are added the first time a file is downloaded.
3. **Re-calibrate.** `calibrate.mts <program id> <observation> <work>` downloads the pinned inputs, copies them into `<work>/run`, and asks CRDS for the reference files the pinned context selects for those exposures. `crds bestrefs` writes their names into the raw headers and downloads the ones the cache does not hold; every one is then linked into a single directory that the instrument's variable (`oref`, `iref`, `jref`) points at, because the pipeline looks its references up as `oref$name` and the CRDS cache's own layout is CRDS's to change. The pipeline then runs: calstis through `stistools`, `calwf3` through `wfc3tools`, `calacs` through `acstools`. What it is given is the association table when the archive keeps a raw file for each exposure, and the one raw file otherwise — that distinction, not the instrument, is what makes the combining stage run.
4. **Compare.** `compare.mts <program id> <observation> <directory>` reads both the re-run product and MAST's with this repository's FITS reader and compares them sample by sample. The two must be on one grid — the same extensions, the same shape, the same table rows and columns — and a difference in shape is reported and refused rather than reconciled, because an HST product stays on its detector's own pixels. A three-axis extension is read one plane at a time, so what is held is one plane of each file. For each extension the receipt gives how many samples both hold, the share that are bit-identical, the median absolute difference over the median level, and, over the samples above that median level, the correlation and the relative difference at its median, 99th percentile and largest. Beside them it records the calibration software version each run used, every reference file or switch the two headers state differently, and any keyword the headers repeat.
5. **Drizzle, which is not the pipeline.** `_drz` and `_drc` are made after it, by drizzlepac. `drizzle.mts <program id> <observation> <work>` runs `stwcs.updatewcs` and then AstroDrizzle on the re-run's own `_flt`/`_flc`, with the kernel, drop size, output scale, fill value and units the archive's product states in its own header, and with the sky the archive's exposure records. Only a product the archive drizzled from one image is attempted.

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

## Limits

- No COS, WFPC2, NICMOS, FOC, FOS, GHRS, WFPC, HSP or FGS observation can be re-calibrated here: `calcos` is not installed, and the rest of those pipelines are retired and not in `hstcal`. The [ledger](hubble-ledger.md) says how much of the archive that is.
- WFC3/IR, STIS/NUV-MAMA and ACS/WFC and /HRC are handled by pipelines that are installed here, and no exposure of any of them has been run. Whether they reproduce is **not verified**.
- The comparison reads two- and three-axis image extensions and binary tables. A four-axis extension is reported as uncomparable, not sampled. No image extension over 64 million samples and no table file over 64 MiB is read.
- The re-run trusts the raw files and the support files as the archive stores them. Nothing upstream of `_raw` is reproduced.
- The relative difference is taken over samples above the median level. On a rectified image whose median level is zero that admits near-empty pixels, so the quantiles matter more than the largest value.
- Only a single-image drizzle is attempted, and its weight image is not reproduced (above).
- The ledger pass asks MAST about fifty times and takes half an hour or more; the cone searches are the slow part, and one of them once stopped answering altogether. Each request has a four-minute deadline and three attempts; a cone search that still will not answer is recorded as unanswered rather than throwing the pass away. `--local` rewrites only the pinned-and-checked columns, from the ledger already on disk.
- Nothing here is drawn. No Hubble observation has been turned into a lens or an object dataset.

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

`.local/hst` is ignored by git; `--raw <dir>` takes the pinned files from a directory that already holds them instead of downloading. The other four observations are the same `archive`, `calibrate` and `compare` commands with `europa-14650 od9l12010`, `europa-13040 obzp01010`, `europa-15419 odr2a1010` and `europa-11085 j9xe05010`.
