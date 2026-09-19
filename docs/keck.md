# Keck

Keck observations reach this project through the Keck Observatory Archive (KOA). This guide describes how one archive
observation is pinned, re-reduced here on the observatory's own software, and checked against the archive's own product. The
route is the one [Hubble](hubble.md) and [JWST imaging](jwst-imaging.md) follow: pin, re-run, compare, write a receipt.

Nothing is drawn from Keck data yet. What exists is the toolkit and its proof on one KCWI observation of M42.
[What Keck holds](keck-ledger.md) says, per instrument, what the archive has for this project's objects and what can be
re-reduced here; that page is written from the archive and from the receipts, not by hand.

## What the archive serves, and to whom

KOA is run for W. M. Keck Observatory by NExScI at IPAC. **Public data needs no account**, and none was created. Three
anonymous interfaces are used, all through [`koa.mts`](../tools/objects/keck/koa.mts):

- **`TAP/sync`**, ADQL over one table per instrument (`koa_kcwi`, `koa_nirspec`, `koa_nirc2`, `koa_osiris` and the rest) plus
  `koa_reduced_data`. The service rewrites an anonymous query to hold only rows whose proprietary period has run out
  (`current_date > add_months(date_obs, propint)`); that clause, visible in the service's own error messages, is the archive's
  definition of public and is what this toolkit relies on. The period is 18 months, stated per row.
- **`KoaAPI/nph-getCaliblist`**, the calibration frames the archive associates with one science frame.
- **`KoaAPI/nph-getL1list`** and the table `koa_reduced_data`, the archive's own reduced products. Neither covers every
  instrument: the table holds KCWI and DEIMOS, the endpoint holds NIRC2, OSIRIS, LWS, HIRES and NIRSPEC, and for KCWI the
  endpoint closes the connection with no reply at all. `koaProducts` asks the table first and the endpoint second.

Downloads are `getKOA/nph-getKOA?filehand=` for a raw frame and `KoaAPI/nph-dnloadL1data` for a product.

**Four traps, all met and all handled in `koa.mts`.**

- KOA's CGI programs end some header lines with a bare newline, which Node's `fetch` refuses outright ("Missing expected CR
  after header value"); the requests here go through `node:https` with `insecureHTTPParser`, which accepts the line and relaxes
  nothing else.
- KOA resets connections part-way through a night of frames, so every request is retried on a dropped connection and a partial
  body is never renamed into place.
- KOA's CSV does not escape a comma inside a quoted cell correctly for the reader, and KCWI states its binning as `"2,2"`.
  Splitting on every comma shifted every column after it, and the shipped M42 program once recorded its binning as `"2` and its
  readout mode as `2"`. `csvCells` is quote aware.
- KOA's CSV also does not escape a quotation mark inside a target name. An observer who typed `SN 01fe 15"W` produces a row no
  CSV reader can take apart. Five such rows exist, across ESI and LRIS. The ledger counts them as unreadable and leaves them
  out of its totals rather than turning them into a NaN that spreads through every sum.

## Stages

1. **Install the software.** `node tools/objects/keck/toolchain.mts install` builds the pinned environment under
   `output/toolchains/keck` (ignored by git): micromamba Python 3.12 from conda-forge, then
   [requirements.lock](../tools/objects/keck/requirements.lock), the KCWI DRP's own `pip-compile` output with the pipeline
   added, installed with `--no-deps`, so the environment is that file and nothing else. `verify` prints the versions. The
   install records the sha256 of the descriptor and the lock together, a run refuses an environment built from other pins, and
   that same digest goes into the record of every product a run makes.
2. **Pin.** `archive.mts <program id> <instrument> <koaid>... [--nights n]` records, for each science frame: the raw frame
   itself with what the catalogue says it is (target, date, exposure, proprietary period, programme, and the instrument
   settings that decide which calibrations apply); the calibrations that apply to it; and the archive's own reduced products.
   Each file is fetched under `.local/keck/<program id>` and pinned by KOA URL, byte count and sha256. Each also keeps the name
   the observatory wrote it under, because the KCWI DRP reads a night by that convention and KOA stores frames under its own
   ids.

   Calibrations reach a program two ways, and each pinned file says which.
   - `association`: what `nph-getCaliblist` names, filtered to the kinds a pipeline reads and to the nights within `--nights`
     (0 by default), with the number the archive named in all recorded beside them.
   - `detector`: the night's own frames of the same detector configuration, for the kinds the association cannot cover.
     KOA matches a calibration to a science frame on `stateid`, the spectrograph state. A bias has no spectrograph state, so
     the association names only the bias frames that happen to carry the science frame's state id. For the M42 observation
     here it named **two** of the night's **nine**, and the KCWI DRP needs seven (`bias_min_nframes`) to build a master bias,
     so the first run of this route produced no cube at all: "Missing master bias", then every flat and the science frame
     refused in turn. The night's bias frames are now taken from the instrument table instead, matched on the catalogue's own
     `camera`, `binning` and `ampmode` columns, and the `CCDCFG` card is then read back off each downloaded file and checked
     against the science frame's. Catalogue and header have to agree, or the frame is not pinned.
3. **Re-run.** `reduce.mts <program id> <koaid> [<run directory>]` stages the pinned frames under their observatory names,
   checks every one against its pin through the shared `assertInputPins` **before the pipeline starts**, and runs the pipeline
   in group mode, the mode that sorts a night's files by image type and reduces them in the instrument's own order. Nothing
   here chooses a calibration or a science parameter. Two things are chosen, and both are recorded with every product:
   - **the channel.** KOA associates both KCWI channels with one science frame and the DRP reduces one at a time, so the run
     takes the science frame's own channel (`KB` blue, `KR` red) and the calibrations of that channel.
   - **no plots.** The DRP's shipped configuration has `enable_bokeh = True`, and the pipeline then starts a detached
     `bokeh serve` with `subprocess.Popen` and draws into a browser. The run passes the pipeline its own configuration file
     with exactly two settings replaced, `enable_bokeh = False` and `plot_level = 0`, and every other line as the pipeline
     ships it; the file's sha256 and both changed values go in the product record. After the run, the log is read and a run
     that started a server anyway is a failed run. No `bokeh` process was left behind by any run made here (`pgrep -fl bokeh`
     after each: nothing).

   The pipeline is given no stdin, so a run that would have asked a question at the terminal fails instead of hanging. Every
   product carries a `cssearth-telescope-product@1` record beside it naming the frames read, the channel, the configuration,
   the software versions and the toolchain digest; a re-run with the same record and the same outputs on disk is reused rather
   than repeated.
4. **Compare.** `compare.mts <program id> <koaid> <run directory>` matches each pinned archive product to the run's product of
   the same stage (`_icubed`, `_icubes`, `_intf` and the rest) **made from this observation's own raw frame**, reads both with
   this repository's FITS reader, and compares them sample by sample.

   The stage suffix alone does not identify a product, and treating it as though it did was a real defect: a run directory
   holds a whole night, every science frame in it ends in `_icubed.fits`, and taking the first match compared the December 9
   cube against a December 10 one without saying so. Three things now have to agree before a pair is compared. The run
   directory's own `run.json` must name the program and the observation asked for, or the directory is a different reduction
   and is refused. The candidate's name must carry this observation's frame name, either the observatory's (`kb231209_00085`)
   or KOA's id, as well as the stage. And the product's own record must name this observation and pin its raw frame at the
   pinned digest. There is no fall back to a first match: no candidate is reported as not reproduced, two candidates are
   refused, and a product with no record or with another observation's record is refused. The two must be on one grid; a difference in shape is reported and refused rather than reconciled. A
   cube is read one plane at a time, so what is held is one plane of each file. For each extension the receipt gives how many
   samples both hold, the share that are bit-identical, the median absolute difference over the median level, and then two
   cuts: over the samples above the median level, and over the samples above the 99th percentile of the archive's own levels,
   each with the correlation and the relative difference at its median, 99th percentile and largest. The second cut is the one
   that matters on a rectified cube, where the median level is near zero and most of the first cut is sky and read noise.

   Beside the numbers the receipt records what each file says about the run that made it. The KCWI DRP writes no version card:
   it writes one `HISTORY` record per primitive and one reading `kcwidrp version=1.0.2`, so the version and the recipe are read
   out of the raw cards. What the comparison establishes is then added to the product record of the cube it checked, as
   `archive-agreement` evidence naming that exact file and the receipt.

## Measured

One KCWI observation, measured on 19 September 2026 on an Apple silicon Mac with the pins in
[toolchain.json](../tools/objects/keck/toolchain.json).

**The observation.** M42, KCWI blue, grating BL at 4499.90 angstroms, Medium IFU, binning 2,2, readout TUP. Programme
`2023B_U124` (PI Jones), frame `KB.20231209.37031.94.fits`, 5 s, 2023-12-09 10:17:11.94 UT, 10,166,400 bytes. 48 of the 89
calibrations KOA associated are pinned, plus 7 bias frames of the night's own detector configuration; 3 archive products.

**Software.** kcwidrp 1.3.1 on keckdrpframework 1.0.0, Python 3.12.14, astropy 6.1.7, numpy 1.26.4, scipy 1.14.1,
ccdproc 2.4.3, astroscrappy 1.1.0, with the 83 packages the lock pins. The environment is 898 MB.

**The run.** 30 frames staged, 88 products written, exit 0. It built `mbias_2201009.fits`, which is the same master bias file
name the archive's own product names, then the continuum bars, the arc, the master flat, the dome flat, the twilight flat and
the cube.

**The comparison**, our `kb231209_00085_icubed.fits` against KOA's `KB.20231209.37031.94_icubed.fits` (150,932,160 bytes,
sha256 7140…05f5). Both are 34 x 95 x 2595, so the grid is reproduced exactly, and 8,381,850 samples are paired per extension.

Both files hold the same four image extensions of the same shape, and ours holds a fifth (`NOSKYSUB`) that 1.0.2 did not
write. Per extension, over the samples brighter than the 99th percentile of the archive's own levels, which is where the
nebula's light is:

| extension | paired samples | bit-identical | correlation on the brightest 1% | median relative difference there |
|---|---|---|---|---|
| PRIMARY, the flux | 8,381,850 | 4.10% | 0.9597 | 0.313 |
| UNCERT | 8,381,850 | 4.10% | 0.99975 | 0.0092 |
| FLAGS | 8,381,850 | 99.80% | 0.99946 | 0 |
| MASK | 8,381,850 | all but 10 samples | not defined, 10 samples are above zero | 1 |

Over the wider cut, every sample above the median level, PRIMARY correlates 0.9555 over 4,190,926 samples and UNCERT 0.99987.

So the mask, the flags and the uncertainties are reproduced, and **the flux samples are not**. The disagreement is real and
this route does not explain it. What was measured about it, and found not to be the answer:

- It is not a shift. Rolling our cube by one or two spaxels in either spatial axis, or by up to three wavelength planes,
  makes the agreement worse in every direction; the best alignment is no shift at all.
- It is not a constant offset. Removing the median difference of each wavelength plane leaves the median absolute difference
  at 0.1163 against 0.1161 before, and the bright-sample relative difference at 0.313 against 0.313.
- It is not one scale factor. The median ratio on bright samples is 0.876 while the median relative difference is 0.31, and
  the uncertainties, which would scale with the flux, agree to under 1%.
- It is worse at the edges. Excluding the outer 3 spaxels, 5 slices and 50 wavelength planes, which is roughly the DAR
  padding region (`DARPADX` 5, `DARPADY` 13), takes the bright-sample relative difference from 0.313 to 0.213.

**What the two runs do not share.** The archive's cube was written by **kcwidrp 1.0.2** and ours by **1.3.1**. The version
shows in three measured ways: the archive stores its samples as 64-bit floats and 1.3.1 stores 32-bit, which is why only a few
percent of samples are bit-identical; 1.3.1 writes a `NOSKYSUB` extension the archive's cube does not have; and the two name
their master flat after different members of the same group (`MFFILE` is `kb231209_00045_mflat.fits` here and
`KB.20231209.10064.94_mflat.fits` at the archive, which are the first and the last of the same six flat-lamp frames,
`kb231209_00045` to `kb231209_00050`). The arc and the geometry are the same frame in both, `kb231209_00044`. The remaining
difference in the flux samples is **not explained**: it is reported with numbers above and not tuned away.

Installing kcwidrp 1.0.2 and re-running the same frames through it would settle whether the version is the whole cause. That
was **attempted here and did not work**: 1.0.2 pins a 2020 stack (`numpy~=1.20`, `scipy~=1.4.1`, `pandas~=1.0.3`,
`scikit-image~=0.16.2`, `bokeh~=2.0`), none of which has a wheel for this machine, and 1.0.2 installed against today's
versions imports but stops at once on `DataFrame.OBJECT`, a pandas 1 idiom pandas 2 dropped. Building that stack from source
is a second toolchain and was not done. So the version is the **suspected** cause of the flux difference, not the measured
one.

**Not reproduced.** KOA's `lev2` `_icubes.fits`, its cube flux calibrated against a standard star. The night's pinned frames
hold no standard star, so the run wrote no `icubes` product and there is nothing to compare. The receipt says so by naming it
under NOT REPRODUCED rather than by leaving it out.

## What cannot be re-run, and why

[What Keck holds](keck-ledger.md) states this per instrument, derived from the archive and from what is pinned. In short:

- **OSIRIS.** The [OSIRIS DRP](https://github.com/Keck-DataReductionPipelines/OsirisDRP) is written in IDL, which is commercial
  and is not on this machine. KOA's own OSIRIS level-1 cubes can still be pinned and read, and they are unusually
  self-describing: each states its whole recipe in DRF comment cards.
- **HIRES.** PypeIt 2.0.1 lists `keck_hires` as not supported in its own spectrographs table.
- **NIRC2 adaptive-optics imaging.** [KAI](https://github.com/Keck-DataReductionPipelines/KAI) 2.0.1 (2026-08-18) is
  BSD-3-Clause and needs no IRAF, so an open pipeline exists; it is not installed here. What is missing is anything to check it
  against. Of nine Europa frames asked of `nph-getL1list` across nine programmes, seven returned a log file and nothing else
  and two returned no file at all; the NIRC2 frames anywhere that did return a reduced image state no pipeline, no version and
  no recipe in their headers at all. KOA's calibration association for a NIRC2 Europa frame is flat fields alone, with no darks
  and no sky frames, so even a consistency run would have to choose its own calibrations. **Held, not reducible with an
  oracle.**
- **NIRSPEC spectroscopy.** PypeIt 2.0.1 supports `keck_nirspec_high_old` for the pre-2018 data most Europa programmes used,
  and it is BSD-3-Clause; it is not installed here. An archive product exists for **two Europa nights only**: of thirteen
  Europa frames asked across eleven programmes, only 2006A returned any, and those are 1-D extracted spectra written by KOA's
  own **NSDRP 0.9.16**, which is not PypeIt. Agreement with them would be agreement between two different pipelines, which is
  not what the rest of this route means by reproducing the archive. Every other Europa programme, Paganini's water-vapour
  campaign included, has no archive product at all. One 2006A observation is **pinned** here
  ([europa-nirspec-2006a-c213ol](../tools/objects/keck/programs/europa-nirspec-2006a-c213ol.json): 53 calibrations, 57 archive
  products) so the next step is ready and this claim can be checked; it is **not reduced**.
- **DEIMOS, ESI, LRIS, MOSFIRE, NIRES.** PypeIt supports all of them and is not installed here. KOA publishes no reduced
  product for them either (its DEIMOS level 1 is JPEG quick-looks), so a re-run would have nothing to be checked against.

## Europa

Europa is this project's showcase body and Keck observed it a great deal: **10,164 public science frames**, NIRSPEC 8,444,
NIRC2 894, HIRES 660, NIRC 77, KPF 46, OSIRIS 41, NIRES 2. None of it is reproduced here, and the section above says why for
each instrument. The OSIRIS set is the Brown and Hand 2013 integral-field data and needs IDL; the NIRC2 set has no archive
product with a stated recipe; the NIRSPEC set has an archive product for two nights, from a different pipeline. This is
recorded as it is rather than worked around.

## Limits

- One observation of one instrument has been reproduced, and the flux samples of that one do not fully agree. Everything else
  in the archive is **not verified**.
- The comparison reads two- and three-axis image extensions. A four-axis extension is reported as uncomparable, not sampled,
  and no extension over 64 million samples is read.
- The re-run trusts the raw frames as KOA stores them. Nothing upstream of level 0 is reproduced.
- `--nights 0` keeps the calibrations of the observation's own night. The archive associates more than that, and the program
  records how many; a run that wants them takes `--nights 1`.
- The ledger matches an observer's target name to a shipped object by dropping time stamps from the end of the name and
  nothing else. It never matches by prefix, and a name carrying a minor-planet number matches only an id carrying the same
  number, so 52 Europa is never Jupiter's moon. A name this rule cannot read is not counted, so every count is a lower bound.
- Nothing here is drawn. No Keck observation has been turned into a lens or an object dataset.

## Re-running

```sh
source ~/.nvm/nvm.sh && nvm use 24
node tools/objects/keck/toolchain.mts install
node tools/objects/keck/toolchain.mts verify
node tools/objects/keck/archive.mts m42-kcwi-2023b-u124 kcwi KB.20231209.37031.94.fits
node tools/objects/keck/reduce.mts  m42-kcwi-2023b-u124 KB.20231209.37031.94.fits
node tools/objects/keck/compare.mts m42-kcwi-2023b-u124 KB.20231209.37031.94.fits \
  output/keck/m42-kcwi-2023b-u124/KB.20231209.37031.94
node tools/objects/keck/archive-ledger.mts
node --test tools/objects/keck/keck.test.mts
```

`.local/keck` and `output/keck` are ignored by git. For the M42 observation the pinned raw frames are 531 MB and the archive's
products 432 MB; the run directory is 3.5 GB.
