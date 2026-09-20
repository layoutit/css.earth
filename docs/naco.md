# VLT/NACO

NACO — NAOS-CONICA, the adaptive-optics imager and spectrograph on the VLT's Unit Telescope 4 from 2001 to 2019 — reaches
this project as raw frames from the ESO archive. This guide describes how one night's observation is pinned, re-reduced here
from those frames on ESO's own pipeline, and checked. The route is the one [interferometric imaging](interferometric-imaging.md)
and [JWST imaging](jwst-imaging.md) follow: pin, re-run, compare, write a receipt.

The checked Ceres imaging night also proves the resolved-disc route: a NACO adapter restores the sky axes from the pinned raw
headers and the shared body-map stage places its relative Ks intensity on Ceres. Europa spectroscopy still ends at a detector
spectrum, and [the ledger](naco-ledger.md) records what the archive holds for this project's bodies.

## What is different about NACO

The other routes here check a re-run against something the archive itself produced. NACO has nothing to check against.
On 19 September 2026 `ivoa.ObsCore` held **nine** NAOS+CONICA Phase 3 products, all of them GW170817, and the archive's
calselector returned no `M.NACO.*` master calibration for a science frame. ESO never ran this pipeline over the NACO archive
and published the result.

So the comparison here is internal, and it says so in every receipt. It is **not** an accuracy figure.

Two other things are worth knowing before reading the code.

- NACO is `NAOS+CONICA` in the archive's raw table. `instrument = 'NACO'` returns nothing at all, not an error.
- A NACO night is not one sequence. The Ceres night below is three observing templates — two of twenty object frames each
  and one of nine sky frames — under one programme, one target and one filter. Treating the night as one jitter sequence
  would combine two separately commanded sequences into one product. Grouping by `tpl_start` is what makes the two
  sequences available as independent reductions, and that is the oracle this route has.

## Stages

1. **Install the software.** `node tools/objects/naco/toolchain.mts install` downloads ESO's own NACO kit and builds it into
   `output/toolchains/naco` (ignored by git). The kit is pinned in [toolchain.json](../tools/objects/naco/toolchain.json) by
   byte count, sha256, and the BSD `cksum` value ESO publishes beside it — that last one is the only digest ESO states for a
   kit, so it is checked as well as the sha256 and a swapped file is caught by ESO's own number. `install_pipeline` builds
   erfa, fftw, cpl, cfitsio, wcslib, gsl, esorex and the naco recipes; `verify` refuses an install built from another pin and
   `recipes` prints what esorex offers.
2. **Pin.** `archive.mts <program id> <prog_id> <object> [--night YYYY-MM-DD]` records one night: every science frame, and
   from the archive's calibration association tree the darks and flats the jitter run needs. Each frame carries its `dp_id`,
   the tag the recipes read it under, its technique, filter, integration time, template and byte count. Byte counts come from
   a one-byte range request, so nothing is downloaded to pin it. Everything the raw table says about a frame is checked
   against that frame's own primary header from the archive's header service, and a disagreement stops the pin. The program
   is written to `tools/objects/naco/programs/<program id>.json`; digests are added the first time a frame is downloaded.
3. **Re-reduce.** `reduce.mts <program id> <work> [--template <tpl_start>|--half a-half|b-half]` downloads the pinned frames
   and runs the recipes its mode needs. Imaging: `naco_img_dark` over the associated darks, `naco_img_twflat` over the
   twilight flats with those darks, and `naco_img_jitter` over one object template with every sky frame of the night, the
   master dark, the master flat and the flat's bad-pixel map. Nodded spectroscopy: `naco_spc_lampflat` over the
   spectroscopic flats, then `naco_spc_combine` over the nods with that flat, and again over the night's telluric standard.
   A dark, a bad-pixel map and sky frames are all optional, because the recipes look them up and work without them. Each runs in its own directory with its set-of-frames and log beside its
   products. A virtual-memory ceiling is asked for so a cube sequence that would take the machine down is killed instead —
   but macOS's shell refuses `ulimit -v`, so on this machine it binds nothing. Every reduction records whether the ceiling
   was actually applied, rather than claiming a protection it does not have.

   Every frame a run consumes is checked against the program's pin (the sha256 of the FITS file the recipes read) inside
   the reduction itself and before any recipe is asked for, so a file already in the raw directory that is not the pinned
   frame reaches no pipeline even when it is a perfectly valid FITS. That check has one owner and it sits where the frames
   are used; a frame the program has not pinned is pinned by the run that first downloads it. Each reduction then writes a
   **product record** beside the product it yields (`<product>.product.json`): the pinned frames that went in, the recipes
   and options that decided it, the pipeline versions the product itself states, and the digest of the toolchain pin. Its
   evidence list is empty, because a run establishes nothing about its own product.
4. **Compare.** For imaging, `compare.mts <program id> <work> <tpl_start> <tpl_start>` reads the two sequences' combined images with this
   repository's FITS reader and compares them sample by sample. They must be on one grid; a difference in shape is reported
   and refused rather than reconciled, because a NACO product stays on its detector's own pixels. Reported: how many samples
   both hold, the share bit-identical, the median absolute difference over the median level, and, over the samples above that
   median level, the correlation and the relative difference at its median, 99th percentile and largest. One receipt per
   product, beside the program, and what it establishes is added to each reduction's product record as
   **`internal-consistency`** evidence, naming the receipt. That is the only kind of evidence this route can ever add: with
   no archive product and no ESO master calibration to agree with, nothing here is archive agreement. A product whose run
   wrote no record takes no evidence, and the comparison stops rather than inventing one. For spectroscopy,
   `spectroscopy-receipt.mts <program id> <work>` compares the two nod
   halves' extracted one-dimensional spectra, measures the target's width across the slit against the night's telluric
   standard, and records the slit geometry.
5. **Place a resolved image.** `author-body-map.mts <target> <program id> <naco_img_jitter.fits> --raw <raw-dir>` is the
   NACO adapter to [`resolved-disc-map.mts`](../tools/objects/resolved-disc-map.mts), the same placement boundary now used by
   JWST and ALMA. The adapter checks the current reduction record and every raw pin, requires every object exposure to carry
   the same north-up/east-left TAN grid and zero requested position angle, and uses the recipe's shift-only coadd with a newly
   fitted disc centre. It publishes relative filter intensity with an explicit sky-noise uncertainty; no absolute calibration
   or photometric correction is claimed. The shared stage owns the ephemeris, rotation model, camera, projection, measured
   resolution, body-map metadata and product record.
6. **Ledger.** `archive-ledger.mts` writes [data/naco/ledger.json](../data/naco/ledger.json) and
   [docs/naco-ledger.md](naco-ledger.md): frame counts by mode counted server-side by the archive, the shipped objects NACO
   observed, one retrievable identity per programme, target spelling, mode and night, and each mode's state read from the
   pinned programs and the receipts beside them rather than declared. When qualification is the only query blocker, that
   identity becomes an executable `telescope:qualify` action. The shared dispatcher validates it and this NACO route still
   owns pinning, the two independent template reductions, their comparison and the receipt.

What is shared rather than repeated: the archive's raw table, the header service, the anonymous data-portal download and the
esorex runner are `tools/objects/interferometry/eso-pipeline.mts`, the calibration association tree is
`eso-associations.mts`, and resolved-image placement is `resolved-disc-map.mts`. NACO supplies only the facts peculiar to its
product: how the recipe retained the detector axes, how relative intensity and its noise are measured, and which bytes prove it.

## Measured

One slice: Ceres. Measured on 19 September 2026 with the pin in
[toolchain.json](../tools/objects/naco/toolchain.json), on an Apple silicon Mac (macOS 24.6, arm64).

**Software.** ESO's `naco-kit-4.4.13-15`, 37,596,448 bytes, sha256
`5d708e5368021246a6367419a8bc246f1dc15631fe64cb6850bf066c250fac3e`, whose `cksum` is `1928251875 37596448` — the value ESO
publishes beside it. It builds on macOS arm64 without a patch, and its `install_pipeline` needs no repair step, unlike the
AMBER and MATISSE kits. All fifteen recipes install and `esorex --recipes` lists them: `naco_img_dark`, `naco_img_detlin`,
`naco_img_lampflat`, `naco_img_twflat`, `naco_img_jitter`, `naco_img_zpoint`, `naco_img_strehl`, `naco_img_checkfocus`,
`naco_img_slitpos`, `naco_spc_lampflat`, `naco_spc_wavecal`, `naco_spc_combine`, `naco_util_img_std_cat`,
`naco_util_spc_argon`, `naco_util_spc_model`. The pipeline is `naco/4.4.13` on esorex 3.13.11, with cpl 7.4, cfitsio 4.6.2,
wcslib 8.4, gsl 2.8, fftw 3.3.10 and erfa 2.0.1. The installed toolchain is 54 MB once the build tree is deleted.

**[Programme 080.C-0881(C)](../tools/objects/naco/programs/ceres-080C0881.json)**, the night of 11 November 2007, target
`CERES`. Three templates under `NACO_img_obs_GenericOffset`: two of twenty object frames (`02:38:47` and `02:45:32`) and one
of nine sky frames (`02:53:07`), all Ks, DIT 2.0 s × NDIT 5. The archive's calibration tree gives 6 darks and 31 twilight
flats. 66.4 MiB of science and 45.4 MiB of calibration, 86 frames, every one downloaded anonymously and digested. The pin
took 4 m 19 s, almost all of it the archive's header service and the per-frame range requests.

The darks are not all one setting: three at DIT 2 s and three at DIT 70 s, and `naco_img_dark` writes a master dark for each.
The 2 s master goes to the jitter run, the 70 s one to the flat run, each chosen by the header keywords the recipes group on
rather than by taking the first.

Each sequence reduced in 4.5 s and 15.3 s through three recipes, at 0.60 GB and 0.73 GB of resident memory.

**[Receipt](../tools/objects/naco/programs/ceres-080C0881.COADDED_IMG.reproduction.json).** The two sequences combined to
1553 × 1550 and 1515 × 1550 from a 1024 × 1024 detector, and the product carries no WCS. They share an origin: the brightest
pixel — Ceres — is at (769, 803) in both, which is checked before anything is compared. Over the 1515 × 1550 rectangle both
hold, 2,348,250 samples:

- **Correlation 0.99889** over the 1,174,125 samples above the median level. That is the figure that means something here.
- 0.43% of samples are bit-identical, which is what two different sets of exposures should give.
- The median level is **0.82 counts**. That is sky, not signal, so "above the median" admits half the frame at noise level and
  the relative-difference quantiles below describe noise rather than the reduction: median 0.46, 99th percentile 3.08,
  largest 411. They are recorded because the receipt records them, and they should not be read as a reproduction error.
- The peak differs by 6.1% (6279 against 6664 counts) and the flux in a 61 × 61 box around Ceres by 4.8%
  (1.302 × 10⁷ against 1.365 × 10⁷). Seven minutes of seeing and airmass separate the two sequences, so this is the sky
  changing, not the pipeline.
- The two products' headers differ in exactly two cards: `DATE-OBS`, which is each sequence's own first exposure, and `DATE`,
  which is when each ran. Both record pipeline `naco/4.4.13`.

**Determinism.** The same template reduced twice, in two working directories, from the same raw frames: the master dark, the
master flat and the combined image are identical in every sample — 1,048,576, 1,048,576 and 2,407,150 of them. The files are
not byte-identical, and the reason is in the headers: `DATE`, which is when the recipe ran, and `CHECKSUM`, which covers it.
Nothing else differs.

**One recipe default changed.** `naco_img_twflat` ships with `--bpm=FALSE` and then writes no bad-pixel map, while
`naco_img_jitter` declares `MASTER_IMG_FLAT_BADPIX` as an input. The flat step asks for the map so that input is given. Every
run records the options it used, and this is the only one that is not the recipe's own default.

## Measured: Europa, and what it did not show

Europa is this project's showcase body, and NACO's only observations of it are spectroscopy: programme **088.C-0833(B)**,
98 science frames, `SPECTRUM,NODDING` through the SL grism in the L band, on eight nights from 4 October 2011 to 18 January
2012, with 18 L' acquisition images. There is no NACO imaging of Europa at all.

**Nobody has published it.** ESO's own telescope bibliography lists two papers for programme 088.C-0833 —
Ligier et al. 2016, AJ **151**, 163 (`2016AJ....151..163L`) and Davis et al. 2023, PSJ **4**, 148 (`2023PSJ.....4..148D`) —
and both record SINFONI, the sister run 088.C-0833(A). Filtering the same query to NACO returns nothing, while `NACO` alone
returns 832 papers, so the filter works. So there is no published result to check this against, and the checks below are
internal and physical.

**[The night of 3 January 2012](../tools/objects/naco/programs/europa-088C0833.json).** 12 nods under one
`NACO_spec_obs_AutoNodOnSlit` template, DIT 3.5 s × NDIT 10, plus 6 spectroscopic flats, 3 darks and an 8-frame telluric
standard taken through the same slit and grism twenty minutes later. 67.3 MiB. The archive associates **no arc frames** with
any night of this programme, so `naco_spc_wavecal` has nothing to fit and no wavelength solution is claimed; the pinned
program records `arcs: false` and the reduction carries it into the receipt.

**[Receipt](../tools/objects/naco/programs/europa-088C0833.spectrum.reproduction.json).**

- **The disc is not resolved along the slit.** Europa's profile across the slit is **2.69 px** full width at half maximum,
  0.148″ at the frame's own 0.0549″/px. The telluric standard — a point source through the same slit and grism — is
  **3.09 px**, 0.170″. The ratio is **0.87**: the target is not wider than the instrument's own profile, so on this
  measurement there is no spatial information across the disc to place on the moon. This is **not** what a ~1″ disc at
  54 mas/px would give, and no explanation for that is offered here, because none has been tested. What is recorded is the
  measurement and the fact that it disagrees with the expectation.
- **Repeatability.** The 12 nods split into two disjoint halves of 6, balanced across both nod positions, each reduced on
  its own through the same recipes and the same master flat. Their extracted one-dimensional spectra correlate **0.366**
  over the samples above the median level. That is a weak number and the reason is the same one the Ceres receipt has: the
  extraction runs the full 1024 samples of the dispersion axis and most of them hold no spectrum, so "above the median"
  admits noise. It is a floor, not a measure of the spectrum's own repeatability.
- **Geometry**, from the frames' own headers, recorded whether or not the disc is resolved: plate scale 0.0549″/px on the
  L54 objective, slit `Slit_172mas`, `Grism2`, filter `SL`, position angle **90.0°**, rotator 55.399° to 55.673° across the
  first exposure, pointing RA 28.68055° Dec 10.45311°, airmass 1.254, and the twelve exposure midpoints in UTC from
  `2012-01-03T00:38:36.037Z` to `2012-01-03T00:46:38.040Z`. The slit runs along the detector's **x** axis and the grism
  disperses along **y**, decided by the contiguous run of the trace from its brightest pixel: 127 samples one way, 8 the
  other.

## Limits

- Two modes are reduced: imaging jitter and nodded spectroscopy. **Every other NACO mode is refused by name**, with the
  reason, rather than reduced without a check — sparse-aperture masking and its polarimetric form (an interference pattern,
  not an image), SDI (four channels on one detector), the apodising phase plate (a shaped point-spread function),
  coronagraphy (the target occulted), differential imaging (two bands to difference), Fabry-Perot (one wavelength of a scan)
  and chopping (differenced in the detector). `naco_img_jitter` would combine any of them without complaint and the product
  would look right and mean nothing. The [ledger](naco-ledger.md) counts what each refusal costs.
- **Cube mode is refused too**, for the other reason: `naco_img_jitter` has a cube path and nothing here has run it, so no
  measurement backs it. That is 136,973 science frames, including the Betelgeuse narrow-band sequences of 082.D-0172(A)
  (Kervella et al. 2009, doi `10.1051/0004-6361/200912521`), which are the obvious next slice — cubes of 15,000 to 30,000
  planes at 64 × 66 pixels, about 250 MB each unpacked. Removing `CUBE` from the refusal list is all it takes to try; a
  receipt is what would let it stay removed.
- **Recipes that are installed and refused.** `naco_img_lampflat` (the code path exists, because the Betelgeuse cube nights
  associate lamp flats and no twilight ones, but no night has been reduced through it), `naco_img_zpoint` (its answer is as
  good as the catalogue magnitude typed in, and nothing here checks that number), `naco_img_detlin` (needs a linearity
  sequence no science night associates), `naco_img_strehl` (needs the star's true angular size to mean anything),
  `naco_spc_wavecal` (needs arc frames, and the pinned nights associate none), `naco_img_slitpos` and `naco_img_checkfocus`
  (instrument housekeeping). `reduce.mts` refuses each by name and says why.
- **No wavelength calibration.** Without arcs the spectroscopy products carry no checked dispersion. The Europa spectra are
  flux against detector sample, not against wavelength.
- The comparison is internal in both modes. It measures whether two sets of exposures sharing none reduce to the same
  product. It does not and cannot measure whether the pipeline is right.
- The calibration taken is the science association's own `DARK` and flat children (`TIMGFLAT`/`LIMGFLAT` for imaging,
  `LSPECFLAT` for spectroscopy), and the darks that flat association names for itself. Everything else the tree hangs under
  the science association — the photometric-standard subtrees, which are `naco_img_zpoint`'s — is left alone. For the Ceres
  night that is 37 frames rather than 128.
- The re-run trusts the archive's raw frames as it stores them. Nothing upstream of them is reproduced.
- The memory ceiling does not bind on macOS. `ulimit -v` is refused there, and the reduction record says so
  (`memoryCeilingApplied: false`). The protection on this machine is the measured peak, not an enforced limit.
- Two products of the same shape are compared as they are. Two imaging mosaics of different sizes are compared over the
  rectangle both hold, anchored at the origin, only after checking that each puts its brightest pixel on the same pixel.
  Nothing is shifted or resampled to make that true. A target that is not the brightest thing in its frame would need a
  different registration.
- The Europa spectra are not placed on the moon. The disc is not resolved along the slit on this measurement, so there is
  no spatial strip to place, and the geometry in the receipt is recorded for a stage that has not been written.
- The Ceres author produces an auditable relative-Ks body map, not a claim that the frame reveals named terrain. On the
  retained clean-room reduction the fitted delivered resolution is 0.169 arcseconds and the wide adaptive-optics halo remains
  in the measurement. The map carries that resolution, the uncertainty and the lack of photometric correction.

## Re-running

```sh
source ~/.nvm/nvm.sh && nvm use 24
node tools/objects/naco/toolchain.mts install
node tools/objects/naco/toolchain.mts verify
node tools/objects/naco/archive.mts ceres-080C0881 "080.C-0881(C)" CERES
node tools/objects/naco/reduce.mts ceres-080C0881 .local/naco/ceres-080C0881 --template 2007-11-11T02:38:47
node tools/objects/naco/reduce.mts ceres-080C0881 .local/naco/ceres-080C0881 --template 2007-11-11T02:45:32
node tools/objects/naco/compare.mts ceres-080C0881 .local/naco/ceres-080C0881 2007-11-11T02:38:47 2007-11-11T02:45:32
node tools/objects/naco/author-body-map.mts ceres ceres-080C0881 \
  .local/naco/ceres-080C0881/jitter-2007-11-11T023847/naco_img_jitter.fits \
  --raw .local/naco/ceres-080C0881/raw

node tools/objects/naco/archive.mts europa-088C0833 "088.C-0833(B)" EUROPA --night 2012-01-03
node tools/objects/naco/reduce.mts europa-088C0833 .local/naco/europa-088C0833
node tools/objects/naco/reduce.mts europa-088C0833 .local/naco/europa-088C0833 --half a-half
node tools/objects/naco/reduce.mts europa-088C0833 .local/naco/europa-088C0833 --half b-half
node tools/objects/naco/spectroscopy-receipt.mts europa-088C0833 .local/naco/europa-088C0833

node tools/objects/naco/archive-ledger.mts
node --test tools/objects/naco/naco.test.mts
```

`.local/naco` is ignored by git; `--raw <dir>` takes the pinned frames from a directory that already holds them instead of
downloading.
