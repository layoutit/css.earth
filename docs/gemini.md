# Gemini Observatory

Gemini's twin 8.1 m telescopes reach this project as raw frames re-reduced here on DRAGONS, Gemini's own open-source
reduction platform. This guide describes how one public observation is pinned, re-reduced from those frames, and checked.
The route is the one [Hubble](hubble.md) and [NACO](naco.md) follow: pin, re-run, compare, write a receipt.

Nothing is drawn from Gemini data yet. What exists is the toolkit, its proof on one GMOS-S imaging sequence of the
interstellar comet 3I/ATLAS, and [a ledger](gemini-ledger.md) of what the archive holds for this project's bodies.

## Three things that are different about Gemini

**The Gemini Observatory Archive refuses us.** Every anonymous request to `archive.gemini.edu` from this machine returns
`403` with a body saying the archive blocks address ranges associated with automated collection and that access needs a
login. That is a blocker for the whole of Gemini's own service: `/jsonsummary/`, `/jsonfilelist/`, `/file/`, `/download/`
and, most importantly, the calibration association service `/calmgr/`. No account was created and nobody was contacted.

The route is instead the **Canadian Astronomy Data Centre**, which mirrors the same raw files as CAOM-2 collection `GEMINI`
and answers anonymously. Metadata is ADQL over TAP at `argus`; files come through `raven`, CADC's global locator. CADC
records each artifact's byte count and its own md5, which is the archive digest a pin carries.

**The calibration association is still the archive's own, by another road.** CADC has no equivalent of `/calmgr/`, so an
association made by a query of ours would be ours and not the archive's. It does not have to be. The archive publishes the
processed master calibrations its nightly pipeline made, and **each master names its own inputs** in the `IMCMB00n` cards of
its first extension header. So a calibration set here is one archive master plus exactly the raw frames that master says
went into it, read from the master's own header over a range request. That is a stronger pin than a query would give, and it
hands the re-run an oracle for free.

**The archive's GMOS masters are Gemini IRAF products, not DRAGONS ones.** Their headers carry `ORIGIN = NOAO-IRAF` and
`GPREPARE`, `GIREDUCE`, `GEMCOMB` and `GBIAS` timestamps. This has two consequences that shape everything below.

- A comparison against them is a comparison of **two different official Gemini pipelines reducing identical raw frames**, not
  of one pipeline against its own earlier output. Bit-for-bit reproduction is not expected and is not claimed.
- DRAGONS **cannot consume them at all**. IRAF trims a GMOS frame to detector rows 49 to 4224 while DRAGONS keeps 1 to 4224,
  and `biasCorrect` refuses a calibration that does not cover the section it is correcting rather than mis-applying it:

  ```
  OSError: No auxiliary data in gS20250917S0156_bias.fits matches the detector section
  Section(x1=0, x2=512, y1=0, y2=4224) in S20250917S0126_overscanCorrected.fits extension 1
  ```

  So the chain has to be DRAGONS from the raw frames down. Where the archive's flat names the bias it used, that bias is not
  handed to DRAGONS; **its own raw frames are pinned as a set of their own** and the bias is remade here. That is why the pin
  carries three calibration sets and not two.

## Stages

1. **Install the software.** `node tools/objects/gemini/toolchain.mts install` builds the pinned DRAGONS environment under
   `output/toolchains/gemini` (ignored by git) and writes `packages.lock`, the explicit package list micromamba resolved, so
   a second machine gets the same builds by URL and digest. `verify` refuses an environment built from other pins.
   **There is no `osx-arm64` build of DRAGONS**: the Gemini channel's `osx-arm64` subdirectory holds only `qemu` and
   `libslirp`, while `osx-64` carries every release. On Apple silicon the environment is created for `osx-64` and Rosetta 2
   translates it. The channel is `http` only; port 443 refuses the connection, which is why the lock pins every package by
   URL and digest and the transport is not what the pin rests on.
2. **Pin.** `archive.mts <program id> <proposal id> <filter> [--days 15] [--start YYYY-MM-DD]` records one observation:
   every science frame of one sequence in one filter, and for each calibration kind one archive master with the raw frames
   that master names. Each file carries its CAOM artifact URI, byte count and the archive's md5, with our sha256 added the
   first time it is downloaded. A frame whose release date has not passed is refused, so nothing proprietary is pinned. An
   `ACQUISITION` frame is a pointing exposure and is never pinned as science. Each science frame's own primary header is
   checked against CAOM and a disagreement stops the pin.

   Sequences are grouped **by gap, not by the date in the file name**. Gemini names a frame for one date and files the night
   under another: every frame of the pinned 3I/ATLAS sequence is named `S20250906…` and every one of them was exposed on
   2025-09-05. Splitting on the name would cut one dither sequence in half.
3. **Re-reduce.** `reduce.mts <program id> <work> <stage> [--raw <dir>] [--half a|b]`, where a stage is `bias`, `flat-bias`,
   `flat` or `science`. Each calibration stage is named for the pinned set it reduces, so adding a set adds a stage.
   Calibrations are passed with `--user_cal` and **not** through a `caldb`: with a database, what went into a product depends
   on what that database happened to hold. `--half` reduces one disjoint half of the science dither, interleaved rather than
   cut in the middle so each half holds dither positions from across the sequence.

   Every stage checks its inputs against their pins (`assertInputPins`) **before** DRAGONS opens anything, writes a
   `cssearth-telescope-product@1` record beside its product, and is skipped when that record says this same run already made
   the files that are there.

   A master this toolkit made is reused by a later stage only when the record beside it describes **the run this program's
   current plan would make**, not merely when the file still matches whatever record sits next to it. A work directory
   outlives a pin, so a master left there by another programme, or by an earlier version of this one that named a different
   calibration set, is exactly the file that would otherwise be folded into a new product without a word. It is refused by
   name and the stage that would remake it is named.
4. **Compare.** `compare.mts <program id> <work> archive <stage>` checks a master against the archive's own, extension by
   extension, over the detector rows and columns both hold. The overlap is **read from the products**: each extension states
   its own `DETSEC`, and extensions are matched by the detector region they cover rather than by their order in the file.
   Nothing is shifted or resampled.

   Two origins go into that, not one. `DETSEC` says which part of the detector an extension covers and `DATASEC` says where
   inside the stored array that part begins, and they differ whenever a product keeps its overscan. Both products compared
   below happen to start their science region at column 1, so this makes no difference to the numbers here; it is covered by
   a test rather than by this dataset, because taking only the `DETSEC` difference would line the science pixels of one
   product up against the overscan of the other and return a plausible, entirely wrong answer.

   `compare.mts <program id> <work> halves` checks the two science half-stacks against each other. They are registered
   through the world coordinates each product carries, and that registration is then checked against the data by measuring
   the same agreement at the eight neighbouring whole-pixel shifts.
5. **Ledger.** `archive-ledger.mts [work]` writes [data/gemini/ledger.json](../data/gemini/ledger.json) and
   [docs/gemini-ledger.md](gemini-ledger.md): public frame counts by instrument counted server-side, the shipped objects
   Gemini observed, a census of Europa, and each instrument's state read from the pinned programs and the receipts beside
   them. A capability counts as reduced only when a receipt parses, names a pinned program, and names a product whose own
   product record carries that same kind of evidence.

## Measured

One slice: the interstellar comet 3I/ATLAS, which this project ships as `comet-3i`. Measured on 19 September 2026 with the
pin in [toolchain.json](../tools/objects/gemini/toolchain.json), on an Apple silicon Mac (macOS 24.6, arm64).

**Software.** DRAGONS **4.2.2**, with numpy 2.5.3, astropy 8.0.1 and Python 3.12.14, built for `osx-64` and run under
Rosetta 2. The installed environment is 1.6 GB. Its licence is BSD, as the conda package declares.

**[Programme GS-2025B-DD-102](../tools/objects/gemini/programs/comet-3i-gs2025bdd102.json)** (PI Bryce Bolin), a Director's
Discretionary programme released at once and public since 2025-09-05. The pinned sequence is **four 25 s GMOS-S `r` frames**
beginning 2025-09-05T23:27:40Z, on `GMOS + Ham-2` binned 2 by 2 over the full 3072 by 2112 read-out. Three calibration sets,
each one archive master with the raw frames that master names:

| set | kind | raw frames | archive master | days from the science frames |
|---|---|---|---|---|
| `bias` | BIAS | 5 (70.8 MiB) | `gS20250906S0254_bias.fits` | 0.47 |
| `flat-bias` | BIAS | 5 (70.8 MiB) | `gS20250917S0156_bias.fits` | 11.47 |
| `flat` | FLAT | 7 (99.1 MiB) | `gS20250917S0126_flat.fits` | 11.45 |

371.1 MiB pinned in all, every file downloaded anonymously and digested. **The flat is 11.4 days from the science frames**,
and that is recorded rather than bounded: it is the nearest twilight flat in `r` that the archive processed at this binning.
The two nearer `r` twilight flats in the window are binned 4 by 4 and are a different read-out, so they are skipped, not
resampled.

**Timings.** `bias` 13.3 s, `flat-bias` 13.2 s, `flat` 23.1 s, `science` 79.7 s over four frames, and 48.7 s and 47.5 s for
the two halves. The science recipe runs the full GMOS imaging chain: overscan, bias, flat, QE correction, mosaic, source
detection, WCS alignment, resampling to a common frame, cosmic-ray flagging, sky subtraction and stacking.

### Against the archive's own masters

Each comparison is over the 6,414,336 samples the two products share across twelve amplifiers, matched on `DETSEC`.

| our product | archive master | median level | median absolute difference | correlation above the level | bit-identical |
|---|---|---|---|---|---|
| `S20250906S0254_bias.fits` | `gS20250906S0254_bias.fits` | 0.638 ADU | **0.432 ADU** | **0.99997** | 0.0006% |
| `S20250917S0156_bias.fits` | `gS20250917S0156_bias.fits` | 0.603 ADU | **0.431 ADU** | **0.99997** | 0.0005% |
| `S20250917S0126_flat.fits` | `gS20250917S0126_flat.fits` | 0.948 | **0.00187** | 0.424 | 0.0018% |

Reading these honestly:

- **The two master biases agree to 0.43 ADU at the median.** A single GMOS bias frame carries about 4 ADU of read noise, so
  the two pipelines' answers differ by roughly a tenth of the noise on one frame. The correlation of 0.99997 is the figure
  that means something.
- **The tails are wide and the reason is cosmic rays.** The 99th percentile of the bias difference is 48 ADU and the largest
  is 328. Five frames is a thin stack to reject cosmic rays from, and IRAF and DRAGONS reject them differently, so a sample
  one pipeline rejected and the other kept differs by the whole event. This is a difference between the two pipelines, not an
  error in either, and it is not tuned away.
- **The two master flats agree to 0.092%** of the normalised level, which is the meaningful number for a flat.
- **The flat's correlation of 0.424 is not a defect and should not be read as one.** A normalised flat above its own median
  spans roughly 0.95 to 1.05, so the correlation is taken over a range a few per cent wide and is dominated by the pixel
  noise inside it. The median difference is the figure that describes this product; the correlation is recorded because the
  receipt records it for every comparison, and here it says nothing.

### The science stack, which has no archive product

The archive publishes no processed science product for this programme, so there is nothing external to check the stack
against and the check is internal: the two disjoint halves of the dither, sharing no exposure, reduced separately through the
same masters.

- Registered at **(-30, 18)** samples from the two products' own world coordinates. The same shift computed independently by
  astropy's WCS for the same two headers is (-30.4815, 17.9435), which the test suite asserts, so the projection here is
  checked against another implementation rather than against itself.
- The registration is **confirmed by the data**: of the nine whole-pixel shifts measured around it, the declared one is the
  peak (correlation 0.9097, against 0.9053 and 0.9045 for its nearest neighbours).
- Over the 6,665,280 samples of the 3180 by 2096 rectangle both hold: **correlation 0.8795** above the median level, median
  relative difference 0.258, 99th percentile 0.581. The median level is 2712 electrons.

What that does and does not establish. It shows the reduction is stable against which exposures went into it. It cannot show
the pipeline is right, because nothing here has a correct answer to check against. Read it as a repeatability figure, not an
accuracy one. Two numbers bound it further, and both are stated in the receipt:

- Each half is **two 25 s exposures**, so the difference between them is dominated by photon noise, not by the reduction.
- The true offset is **0.48 samples** from a whole number in x. Two images are compared on whole samples, so this comparison
  is made up to half a sample out of register and every agreement figure above is a **floor**. Nothing was resampled to
  improve it, because resampling would put an interpolation of our own between the two products and the measurement.

## Europa, and the other Galilean moons

Europa is this project's showcase body, and the answer for it is negative. All counts here are the archive's own, from
the [ledger](gemini-ledger.md); this section only says what they mean.

**Europa's public Gemini science frames are 340, and every one of them is a spectrum.** They are GNIRS 220 (the L-band
longslit set GN-2017A-Q-63), NIFS 72, TEXES 25 and GPI 23. Every Gemini *image* of Europa, from NIRI, GNIRS and NIFS alike,
is an `ACQUISITION` exposure: the pointing frame taken before an observation, real data of the moon and never science.

None of those four instruments is one this toolkit has proven. Three cannot be: TEXES is a visiting instrument with its own
reduction, GPI's pipeline is IDL, which is proprietary and not installed here, and NIFS has no DRAGONS support at all. The
fourth, GNIRS, **is** supported by the pinned DRAGONS for longslit spectroscopy, but nothing here has run it, and whether
that support covers the L-band camera GN-2017A-Q-63 used is **not verified**. So no Europa observation has been reduced,
and the brief's rule applies: a Europa observation is reduced only in a mode already proven, and there is none.

The other three moons are asked for beside it, because answering this for one moon and guessing for the rest would be worth
nothing. The useful result is that **Io and Ganymede do have frames in the exact mode proven here**: 40 GMOS-S science
frames for Io and 49 for Ganymede. Those are the obvious next slice, and they need no new capability. Callisto's frames are
NIFS 55 and NIRI 53, neither proven.

| moon | public science frames, by instrument | reducible here |
|---|---|---|
| Io | NIRI 6541, GMOS-S 40, NIFS 24, Hokupaa+QUIRC 7, IGRINS 6 | yes, through GMOS-S |
| Europa | GNIRS 220, NIFS 72, TEXES 25, GPI 23 | no |
| Ganymede | GMOS-S 49, NIRI 18 | yes, through GMOS-S |
| Callisto | NIFS 55, NIRI 53 | no |

## Limits

- **One instrument and one mode are proven: GMOS imaging.** Every other instrument's state is in the ledger, derived from
  what is pinned rather than declared. GMOS longslit spectroscopy, NIRI, F2, GSAOI and GNIRS are all supported by the pinned
  DRAGONS and none has been run here.
- **The comparison against the archive is between two pipelines**, not a reproduction. The archive's GMOS masters are IRAF
  products. A difference is a difference between IRAF and DRAGONS.
- **No archive product exists for any science frame of this programme**, so the science check is internal and bounded as
  described above.
- **The flat is 11.4 days from the science frames.** The archive processed no nearer `r` twilight flat at this binning.
- **Gemini's own archive is unusable from here**, so its calibration association service was never exercised and nothing is
  claimed about it. The association used instead is the archive's own, read from each master's header.
- **DRAGONS runs under Rosetta 2 on this machine**, because no `osx-arm64` build exists. Results have not been compared
  against a native `linux-64` run.
- The re-run trusts the archive's raw frames as it stores them. Nothing upstream of them is reproduced.
- Nothing is drawn. No Gemini observation has been turned into a lens or an object dataset.

## Re-running

```sh
source ~/.nvm/nvm.sh && nvm use 24
node tools/objects/gemini/toolchain.mts install
node tools/objects/gemini/toolchain.mts verify

node tools/objects/gemini/archive.mts comet-3i-gs2025bdd102 "GS-2025B-DD-102" r --days 15 --start 2025-09-05

node tools/objects/gemini/reduce.mts comet-3i-gs2025bdd102 .local/gemini/work bias
node tools/objects/gemini/reduce.mts comet-3i-gs2025bdd102 .local/gemini/work flat-bias
node tools/objects/gemini/reduce.mts comet-3i-gs2025bdd102 .local/gemini/work flat
node tools/objects/gemini/reduce.mts comet-3i-gs2025bdd102 .local/gemini/work science
node tools/objects/gemini/reduce.mts comet-3i-gs2025bdd102 .local/gemini/work science --half a
node tools/objects/gemini/reduce.mts comet-3i-gs2025bdd102 .local/gemini/work science --half b

node tools/objects/gemini/compare.mts comet-3i-gs2025bdd102 .local/gemini/work archive bias
node tools/objects/gemini/compare.mts comet-3i-gs2025bdd102 .local/gemini/work archive flat-bias
node tools/objects/gemini/compare.mts comet-3i-gs2025bdd102 .local/gemini/work archive flat
node tools/objects/gemini/compare.mts comet-3i-gs2025bdd102 .local/gemini/work halves

node tools/objects/gemini/archive-ledger.mts .local/gemini/work
node --test tools/objects/gemini/gemini.test.mts
```

`.local/gemini` is ignored by git; `--raw <dir>` takes the pinned frames from a directory that already holds them instead of
downloading.
