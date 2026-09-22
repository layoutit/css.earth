# Spitzer

Spitzer observations re-made from the level-1 frames the archive itself mosaicked, and checked pixel by pixel against the archive's own level-2 product.

Read this first: **the observatory's own software did not run here.** Every other telescope route in this repository re-runs the observatory's pipeline. This one could not, and the honest lesser route is what is built instead. What that changes is set out under [What this route is not](#what-this-route-is-not).

## MOPEX, measured

Spitzer's own post-BCD software is MOPEX: it makes the mosaics and does the point-source photometry. It is a public download from IRSA and needs no account.

Measured on 2026-09-19, macOS 15 (Darwin 24.6.0), Apple silicon:

- `mopex18_5_0-mac64.dmg` downloaded, 240,297,151 bytes, sha256 `a715cd75f272e4054ddd85a460f85946c324dbd6939bc2351e66abb75a98d4f9`.
- Its executables are `Mach-O 64-bit executable x86_64` (`mosaic_int`, `mosaic_coadd`, `mosaic_geom` and the rest of the 104 programs in `mopex.app/Contents/Resources/platform/mac/bin`).
- Rosetta 2 is installed on this machine: `arch -x86_64 /usr/bin/true` succeeds.
- The binaries still did not run. macOS Gatekeeper refuses the unsigned, quarantined distribution and raises the system dialog `"mopex" is damaged and can't be opened`, which kills the process. The first attempt here read the binaries' exit status through a pipe and so read the exit status of `head`, not of the binary; the process was in fact being killed. That mistake is recorded because it is how a Gatekeeper refusal can look like a silent success.
- Running them would mean stripping the quarantine attribute, re-signing the binaries, or changing the machine's security assessment policy. None of that was done. The disk image was unmounted and the 363 MB download deleted.

So: **obtainable without a login, yes; runnable here, no.** IRS spectroscopy (SPICE, CUBISM, IRSCLEAN) was not attempted either, for the same signing reason and a harder pipeline, and this toolkit does not claim IRS.

## What runs instead

A pinned Python environment: numpy, astropy, reproject, scipy, installed with `--no-deps` from `requirements.lock` so nothing is resolved at install time. `toolchain.json` and the lock are hashed together, and a run refuses an environment built from other pins.

```
node tools/objects/spitzer/toolchain.mts install     # measured 27 s
node tools/objects/spitzer/toolchain.mts verify
```

Measured versions: numpy 2.5.3, astropy 8.0.1, reproject 0.21.0, scipy 1.18.1, python 3.12.14; pins `57d10b4f335a`.

## The stages

```
node tools/objects/spitzer/archive.mts  ngc3132-4416768 4416768 --channels 1,2,3,4
node tools/objects/spitzer/mosaic.mts   ngc3132-4416768
node tools/objects/spitzer/compare.mts  ngc3132-4416768
node tools/objects/spitzer/archive-ledger.mts --write
```

For an observation returned by the shared capability query, the same stages are available through the checked dispatcher:

```
node tools/cli/run-typed-module.mjs tools/objects/telescopes/qualify.mts --target bennu --telescope Spitzer --mode 'IRAC Map' --observation 21415424 --channel 1
```

It first requires that the canonical target, mode and AOR occur together in the committed archive index. It then runs the
Spitzer-owned pin, mosaic and comparison functions and refreshes only repository-owned ledger state; it does not repeat or
redate the archive survey.

**`archive.mts`** finds the observation in the Spitzer Heritage Archive at IRSA and pins it. Per IRAC channel: the archive's own mosaic (`maic`) with its uncertainty (`munc`) and coverage (`mcov`), and every level-1 frame as its corrected image (`cbcd`), uncertainty (`cbunc`) and imask (`bimsk`). Each file by URL, byte count and sha256, with the archive's own MD5 checked where the catalogue publishes one. What the observation is, is recorded twice, from the catalogue and from the FITS headers, and a disagreement refuses the pin.

**`mosaic.mts`** drives `mosaic.py` in the pinned environment: read each frame with its own SIP distortion, drop what the imask flags, resample onto the archive's grid with `reproject_exact`, drop an output pixel from a frame that covers less than half of it, put the frames on one background level, average with equal weight per contributing frame. It writes a `cssearth-telescope-product@1` record beside the output naming the exact inputs, parameters, versions and toolchain digest. A second run with the same record and the same bytes does no work.

**`compare.mts`** checks all four files against their pins before it reads a sample: our mosaic against the record that made it, and the archive's mosaic, uncertainty and coverage planes against the program that fetched them. That check is inside the comparison itself, not in its caller, because the uncertainty plane is the denominator of the headline result: swap it for a valid FITS file with inflated errors and an unchecked comparison would report perfect agreement. It then reads both mosaics with this repository's own FITS reader, row block by row block, and writes the receipt with a product record beside it. The `archive-agreement` evidence itself goes onto the MOSAIC's record, the one the producing stage wrote, so a consumer holding the product finds the check with `evidenceFor(record, mosaic, 'archive-agreement')` without knowing this toolkit exists; its wording says in as many words that the re-mosaic is not the observatory's own. Adding it is refused if the mosaic on disk is no longer the file its record made. The receipt records the digest of every file it actually read, taken from the bytes on disk and never copied out of the program, and the ledger counts a receipt only when those three digests are the ones its program pinned.

**`archive-ledger.mts`** writes [the Spitzer archive ledger](spitzer-ledger.md). Its JSON retains every returned AORKEY,
programme, mode, title, start time and available end time. The grouped counts are reproduced from those records and refused
when they disagree. The capability query can therefore expose actual candidate observations and make a definite time refusal
when a requested interval contains none of them.

### Access

The archive is public and needs no account. Two IRSA services are used and they are not equal in standing:

- the archive's file tree at `https://irsa.ipac.caltech.edu/ibe/data/spitzer`, a plain indexed HTTPS directory;
- the Heritage Archive's own search backend at `.../applications/Spitzer/SHA/sticky/CmdSrv`, which is what the archive's web application calls. The documented `servlet/DataService` interface that IRSA's help pages still describe returned **HTTP 404 on 2026-09-19** from both `sha.ipac.caltech.edu` and `irsa.ipac.caltech.edu`, so it is gone. What is used instead is an application backend, not a published API; it may change without notice, and everything it returns is validated in `archive.mts`.

## What was proved

**Observation.** AOR 4416768, NGC 3132 (the Southern Ring nebula, an object this repository ships), IRAC Map, programme 68 (PI Fazio), observed 2003-12-20. 24 level-1 frames per channel, four channels, one archive mosaic per channel of 2361 x 1036 pixels at 0.600 arcsec, pipeline version S18.25.0. 300 files pinned, 190 MB of archive data plus 39 MB of re-made mosaics on disk.

**Membership, read not assumed.** The AOR is in IRAC High Dynamic Range mode: at each of 12 pointings it took a 1.2 s frame and a 30 s frame. The archive's mosaic carries `FRAMTIME = 30.0`, so it combined 12 frames, not 24. Using all 24 puts the mosaic 72% high. The stage reads the mosaic's frame time and selects on it, and refuses if no pinned frame matches.

**Agreement.** Each channel's re-mosaic against the archive's own product, over the pixels the archive covers, measured 2026-09-19:

| Channel | Pixels compared | Median ratio | Median difference, as a share of the level | Inside the archive's own 1 sigma | Difference in sigma, median / p95 / p99 | Within 5% | Correlation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ch1, 3.6 um | 809,858 | 0.999860 | 0.37% | 99.08% | 0.035 / 0.202 / 0.793 | 95.00% | 0.9943 |
| ch2, 4.5 um | 798,233 | 1.000105 | 0.55% | 99.05% | 0.032 / 0.434 / 0.796 | 90.29% | 0.9999 |
| ch3, 5.8 um | 808,130 | 1.006903 | 3.38% | 98.35% | 0.368 / 0.661 / 7.261 | 82.01% | 0.8767 |
| ch4, 8.0 um | 802,563 | 0.999987 | 0.12% | 98.68% | 0.042 / 0.171 / 3.277 | 98.85% | 0.9833 |

"Inside the archive's own 1 sigma" is the column that means most: it is the archive saying how well it claims to know each pixel, and our mosaic falls inside that claim for 98% of them in every channel.

Nothing is bit-identical, and nothing should be: two different pipelines.

**Bennu qualification.** AOR 21415424, archive programme 289, observed 2007-05-08, supplies the checked channel-1 program
`bennu-21415424`. Ten of its eleven pinned level-1 frames match the archive mosaic's 12 second frame time. The re-mosaic covers
1,038,727 pixels; 99.49% of the compared pixels fall within the archive uncertainty, the median absolute difference is 1.187%
of the median level, and the correlation is 0.964104. This qualifies those exact bytes and that reduction route. It does not
establish that every one of Bennu's eleven indexed IRAC Map AORs, or another IRAC channel, is adequate for a question.

**Geometry.** The run resamples onto the archive's grid, so it does not choose one. It reports the grid the frames imply on their own, from `find_optimal_celestial_wcs`, beside it: 716 x 603 at 1.223 arcsec for channel 1, against the archive's 2361 x 1036 at 0.600 arcsec. The archive oversamples by about two; the frames' native scale is recovered to within 0.1%.

### The mask bug, and what the picture showed

The first version of this route rejected every pixel with any imask bit set. That looked cautious and was wrong. The picture
showed it: two hard vertical lines and two rows of repeating ticks through the bright stars, which are the shapes of column
pulldown and muxbleed. They were not artifacts that survived. They were holes, drawn in the renderer's colour for a pixel with
no data, over 2.57% of the pixels the archive covers; a detector column falls on nearly the same sky in every frame of a small
dither, so once every frame's copy is thrown away nothing fills it.

The imask file states what its own bits mean, in its own header, for the pipeline version that wrote it. Bits 4, 5, 6 and 7
are saturation corrected in pipeline, muxbleed, banding and column pulldown: artifacts that were found and removed in the
corrected frame this stage reads. Rejecting them throws away good pixels. What is rejected now is stray light (3), crosstalk
(8), radhit (9) and latent image (10), which contaminate and are not corrected, and flat field not applied (11), not linear
(12), uncorrected saturation (13) and bad or missing (14), where the value is not a measurement.

Measured on channel 1, against rejecting every non-zero bit: holes 2.57% to 0.33%, inside the archive's uncertainty 98.11% to
99.08%, correlation 0.9842 to 0.9943. Channel 2 went from 0.9666 to 0.9999. Channels 3 and 4 did not move: at 5.8 and 8.0 um
the pipeline had flagged only bits this policy already rejected. The lines and the tick rows are gone from the picture.

### Choices settled by measurement

Each of these was run and compared, not argued:

| Choice | Alternative measured | Result |
| --- | --- | --- |
| Equal weight per frame | Inverse-variance (1/unc squared) weights | Inverse variance was worse: on channel 1, median ratio 1.22 against 1.000 |
| No sigma clip across the stack | 3 sigma and 2.5 sigma clips | Clipping raised the correlation to 0.9903 but dropped agreement inside the archive's uncertainty from 98.1% to 92.2% and "within 5%" from 93% to 80%, because with 12 frames it rejects real structure |
| Drop a frame's contribution below half overlap | Keep every partial overlap | Without the threshold, channel 1's correlation was 0.56 instead of 0.98: exact overlap divided by a sliver of area is noise |
| Reject imask bits 3, 8, 9, 10, 11, 12, 13, 14 | Reject every non-zero bit | Rejecting the corrected artifacts too left holes in 2.57% of the archive's covered pixels instead of 0.33%, and cost 1 point of agreement inside the archive's uncertainty on channel 1 and 3 on channel 2 |
| Three passes of zero-mean background matching | None | Channels 1, 2 and 4 did not move (their frames' levels differ by 0.001 to 0.007 MJy/sr). Channel 3's frames differ by 0.585 MJy/sr, as large as the signal, and matching moved it from 71.1% to 98.35% inside the archive's uncertainty, at the cost of a 0.7% shift in that channel's overall level and "within 1%" falling from 37% to 5% |

The channel 3 trade is the one unexplained-looking number in the table above and it is not hidden: that channel is 3.4% off in median absolute difference and 0.7% off in level, worse than the others, while being the same 98% inside the archive's stated uncertainty. Its frames have a background that varies by the size of the signal, the archive's pipeline corrects that with an overlap correction and a sky model, and this route has only the additive part of that.

## What this route is not

- **It is not the observatory's pipeline.** MOPEX did not run. Evidence is `archive-agreement` of an unofficial re-mosaic, and the receipts say so in their `limits`.
- **It does not choose a geometry.** The output grid is the archive's, which is what makes a pixel-by-pixel comparison possible.
- **It rejects no outliers across frames.** The archive's pipeline rejects radiation hits where frames overlap; this does not, which is where the p99 tail lives.
- **It retains the documented stray-light mask.** Bits 3 and 8–14 reject a pixel; corrected-artifact flags alone do not. Some covered archive pixels remain missing here, as explained below.
- **It covers IRAC imaging only.** MIPS is not run. IRS needs SPICE or CUBISM and is not claimed.

## Files

| What | Where |
| --- | --- |
| Pinned environment | [`tools/objects/spitzer/toolchain.json`](../tools/objects/spitzer/toolchain.json), [`toolchain.mts`](../tools/objects/spitzer/toolchain.mts), [`requirements.lock`](../tools/objects/spitzer/requirements.lock) |
| Pin an observation | [`tools/objects/spitzer/archive.mts`](../tools/objects/spitzer/archive.mts) |
| Re-make the mosaic | [`tools/objects/spitzer/mosaic.mts`](../tools/objects/spitzer/mosaic.mts), [`mosaic.py`](../tools/objects/spitzer/mosaic.py) |
| Compare and receipt | [`tools/objects/spitzer/compare.mts`](../tools/objects/spitzer/compare.mts) |
| Ledger | [`tools/objects/spitzer/archive-ledger.mts`](../tools/objects/spitzer/archive-ledger.mts), [`docs/spitzer-ledger.md`](spitzer-ledger.md) |
| Pinned observation and receipts | `tools/objects/spitzer/programs/` |
| Tests | [`tools/objects/spitzer/spitzer.test.mts`](../tools/objects/spitzer/spitzer.test.mts), 14 tests, no network |

### Three gaps in the colour example

The three small grey patches to the right of NGC 3132's central star are missing samples in channel 4 (8.0 µm), not dark features of the nebula. They cover 24 output pixels: rows 512–514 and columns 1177–1195 in zero-based mosaic coordinates. Channels 1 and 2 have data there. Each patch is covered by six channel-4 frames, but all six carry mask value 31, including the stray-light flag (bit 3). The archive mosaic retains values there with coverage about 5.8.

The [IRAC handbook, section 7.1.1](https://irsa.ipac.caltech.edu/data/SPITZER/docs/irac/iracinstrumenthandbook/34/) specifies fatal mask 32520 (bits 3 and 8–14). [Section 5.2.1](https://irsa.ipac.caltech.edu/data/SPITZER/docs/irac/iracinstrumenthandbook/29/) explains that stray-light masking can leave gaps with small dithers. We retain that documented mask. A matched experiment found that dropping bit 3 improved channel-4 correlation from 0.98325 to 0.99840, but reduced agreement within the archive uncertainty in channels 1 and 2. Agreement with one mosaic is insufficient evidence to reinterpret a contamination flag. The colour renderer shows missing samples in grey; no interpolation or archive pixels fill these gaps.
