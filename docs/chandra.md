# Chandra

Chandra X-ray Observatory observations reach this project as Chandra Data Archive products. This guide describes how one archive observation is pinned, reprocessed here from its level-1 products on the observatory's own software, and checked against the archive's own level-2 product. The route is the one [Hubble](hubble.md), [JWST imaging](jwst-imaging.md) and [interferometric imaging](interferometric-imaging.md) follow: pin, re-run, compare, write a receipt.

Nothing is drawn from Chandra data yet. What exists is the toolkit and its proof on three observations: the Crab Nebula on ACIS-I, Polaris on ACIS-I in very faint mode, and Jupiter on HRC-I, which is also the check that a moving target's own frame is right. What it will not pin, and why, is stated with the rest.

X-ray data differ from the other archives in one way that shapes the whole route: a Chandra product is a **list of events**, not an image. Standard data processing changes each event's calibrated quantities and drops events that fail a filter, so two runs are not row for row, and a comparison has to match events before it can compare them.

## Stages

1. **Install the software.** `node tools/objects/chandra/toolchain.mts install` builds the pinned environment under `output/toolchains/chandra` (ignored by git): CIAO, `ciao-contrib` (which carries `chandra_repro`) and the CALDB, from the Chandra X-ray Center's own conda channel and conda-forge. The environment is created from [packages.lock](../tools/objects/chandra/packages.lock), an `@EXPLICIT` list of every package URL with its md5, so nothing resolves at install time; `solve` re-resolves [toolchain.json](../tools/objects/chandra/toolchain.json)'s requests and rewrites the lock. `verify` prints the CIAO and CALDB releases. The environment records the digest of the descriptor and the lock, and a run refuses an environment built from other pins.
2. **Pin.** `archive.mts <program id> <obsid>...` asks the archive what the observation holds. Every FITS file under the observation's directory is pinned by URL, byte count and, once downloaded, sha256, keeping the archive's own path: the level-1 inputs (the level-1 event list, aspect solution and quality, bad pixels, mask, mission timeline, filters, parameter block, bias maps, ephemerides) and the level-2 products the archive's own run produced (the level-2 event list, the binned images, a grating spectrum when there is one). Alongside them it records what the observation is — instrument, detector, grating, read and data mode, target, proposal, sequence, start and stop, livetime, dataset DOI — and how the archive's own run was configured: its processing version and every randomisation, CTI, gain and calibration-file card the level-2 header states. Those come from the level-1 and level-2 event headers, read over a range request rather than downloaded, and are checked against the archive catalogue: a disagreement stops the pin. The program is written to `tools/objects/chandra/programs/<id>.json`.
3. **Reprocess.** `reprocess.mts <program id> <obsid> <work>` downloads the pinned inputs into `<work>/archive` under the archive's own `primary/` and `secondary/` paths (because `chandra_repro` reads an observation as the directory the archive lays out), and runs `chandra_repro` from the pinned CIAO against the pinned CALDB, writing to `<work>/repro`. Its inputs are read, never written. The run is under a resident-memory ceiling applied to the whole process group, because `chandra_repro` spawns the CIAO tools as separate executables. Beside the level-2 event list the run writes its own [product record](../packages/telescope/src/product-record.ts) (`<name>.fits.product.json`): the pinned level-1 files by role, URL, byte count and sha256; the parameters `chandra_repro` was given, which are the same list the run passes it; the CIAO and CALDB releases that ran it and the digest of the toolchain pins they came from; and every FITS file the run wrote, pinned as it wrote it. Its evidence list is empty: what a later check establishes is added by that check. A re-run is skipped only when that record says this same run made the products and they are still the files it made.
4. **Compare.** `compare.mts <program id> <obsid> <work>/repro` matches the two event lists on what the instrument telemetered and no processing rewrites (for ACIS the chip, the exposure frame and the chip coordinates; for HRC the time and the chip coordinates), and refuses the comparison unless that key is unique in both lists, which is what makes the join an identity rather than a guess. It then reports how many events both lists keep and how many each keeps alone; for every scalar column the two share, the share that agree exactly and how far the rest are apart; the distance between the two placements of each matched event, in sky pixels and arcseconds; and both lists binned into one sky counts grid, so an event one list drops shows as a bin that differs. Beside them it records every processing card the two headers state differently, and the CIAO and CALDB releases the re-run used, taken from the product record beside the event list, never from the software installed on the machine running the comparison, which may be another environment entirely. An event list with no record beside it is not compared. The comparison then adds one `archive-agreement` entry to that run's record, naming the product it checked, the receipt it wrote, and what event-by-event agreement with the archive's own list does and does not establish. One receipt per product, beside the program.

Receipts written since the record was introduced are `cssearth-chandra-reproduction@2` and carry a `productRecord` field: the record's file name beside the product and the digest of the run it describes, so a receipt's `reprocessedWith` can be traced to the run that made the event list. The three checked-in receipts are `@1` and carry no `productRecord`; they were written on the machine and the day of the re-runs they describe (below), so their `reprocessedWith` is that run's environment, and they are left as they are.

`solar-system.mts`, which re-projects the archive's own level-2 list into the frame that moves with the body, is a producing stage under the same rule. It writes a record beside the object-centred list it makes: the archive product and the three files the frame is built from (the spacecraft orbit ephemeris, the body ephemeris and the aspect solution) at their pinned digests, and the CIAO and CALDB that ran `sso_freeze` here. Its receipt then states each list's environment from the record beside that list, the re-processed one and the frozen one separately, and refuses a list that has no record rather than reporting the software installed where the receipt is written. Where the body landed against its JPL Horizons disc goes back on both records as `geometric-registration` evidence. Those receipts are `cssearth-chandra-solar-system@2`, with a `frozenWith` environment and the two `productRecords` they were read from; the checked-in Jupiter receipt is `@1`, written by the run it describes, and is left as it is. The ledger accepts both versions and reads each receipt rather than its file name, so an object-centred frame counts as checked only when its receipt parses and names that program, obsid and target.

The level-2 event list carries its status as a `32X` bit column, which the repository's shared binary-table reader does not cover, so the event-table layout is read by [events.mts](../tools/objects/chandra/events.mts) over the HDU bounds that reader already checks.

## Measured

Measured on 19 September 2026 with the pins in [toolchain.json](../tools/objects/chandra/toolchain.json), on an Apple silicon Mac.

**Software.** CIAO 4.18.0 (8 December 2025) with `ciao-contrib` 4.18.2 and CALDB 4.12.4, from the Chandra X-ray Center's conda channel; Python 3.12, numpy 2.3.5. Licence GPL-3.0. The channel publishes a native `osx-arm64` build, so nothing is emulated. The environment is 7.1 GB, of which CALDB is 6.1 GB; 217 packages, 2.5 GB of downloads, 14.5 minutes to install.

CIAO 4.18.0 declares `numpy >=2.3.5,<3`, but its `pycrates` imports `numpy.chararray`, which numpy 2.5 removed: with conda-forge's current numpy 2.5.3 `import pycrates` fails with `ImportError: cannot import name 'chararray'`. The descriptor therefore holds numpy below 2.4.

Why this observation. The Crab Nebula is a shipped object (`m1`) with 102 archived Chandra pointings within 0.25° of its catalogue position. The obvious slice would be the observation behind Weisskopf et al., "Discovery of Spatial and Spectral Structure in the X-Ray Emission from the Crab Nebula", *ApJ* **536**, L81 (2000), [doi:10.1086/312733](https://doi.org/10.1086/312733). **That observation is obsid 168**, verified: the preprint ([arXiv:astro-ph/0003216v2](https://arxiv.org/abs/astro-ph/0003216)) states "On 1999 August 29, during orbital calibration, Chandra obtained a 2667-s observation of the Crab Nebula, using the High-Energy Transmission Grating (HETG) and the Advanced CCD Imaging Spectrometer spectroscopy array (ACIS-S) of 6 CCDs", "Acquired in the timed-exposure graded mode at 3.241 s/frame". Obsid 168's own header says DATE-OBS 1999-08-29, ACIS-S/HETG, DETNAM ACIS-456789 (6 CCDs), TIMED/GRADED, EXPTIME 3.2 s, ONTIME 2650.0 s. The only other Crab observation of that date, obsid 170, is continuous-clocking, which the paper is not describing.

obsid 168 is still a poor first slice: its `DATAMODE` is `GRADED`, so only the event grade was telemetered and most of what `chandra_repro` does has nothing to work on; its level-1 event list is 189 MB; and it carries a grating, which this route refuses to pin (below). obsid 2798 is TIMED/FAINT, which exercises the whole chain, its archive level-2 product was made by the same processing run as its level-1 inputs (both ASCDSVER 10.9.4, both dated 2021-03-26) so that product is a fair oracle, and the Crab's severe ACIS pile-up matters less in a halo pointing than on-axis.

**[Crab Nebula halo](../tools/objects/chandra/programs/m1-crab-halo.json)**, obsid 2798, proposal 03500419, DOI 10.25574/02798: ACIS-I (chips 0123), no grating, TIMED/FAINT, 20.0 ks of livetime on 14 April 2002, 835,193 events in the archive's level-2 list. 23 level-1 input files, 73,835,466 bytes; 3 archive level-2 products, 29,577,891 bytes.

The re-run took **39.1 seconds** at **0.72 GiB** of resident memory, on CIAO 4.18.0 against CALDB 4.12.4 — five years newer than the archive's own run (ASCDSVER 10.9.4, 26 March 2021). [Receipt](../tools/objects/chandra/programs/m1-crab-halo.acisf02798N004_evt2.reproduction.json).

**Every event the archive kept is in the re-run, and none was lost.** All 835,193 archive events matched on chip, frame and chip coordinates; the re-run keeps 123 more (0.015%) and drops none.

**What the instrument telemetered comes through untouched.** `time`, `node_id`, `tdetx`, `tdety`, `pha_ro` and the 32 `status` bits are bit-identical in all 835,193 matched events.

**Sky positions barely move.** 95.8% are bit-identical. The median difference is 0; the 99th percentile is 0.00049 sky pixels (0.00024″) and the largest is 0.468 sky pixels (0.230″), less than half a pixel. Detector coordinates behave the same way (`detx` 97.1% identical, largest difference 0.468 pixels).

**The calibrated energies differ, and that is the finding.** `energy` is identical in 25 of 835,193 events (0.003%): the median difference is 1.82 eV, the 99th percentile 7.19 eV, the largest 50.85 eV. `pi` is identical in 84.6% and never differs by more than 4 channels; `pha` is identical in 63.9% and never by more than 13. `fltgrade` and `grade` are identical in 99.9994% — 5 and 4 events of 835,193 differ.

Nothing was tuned to close that gap, and the two runs are **not** using different calibration files: both headers name the same `GAINFILE` (`acisD2000-01-29gain_ctiN0008.fits`), `CTIFILE` (`acisD2000-01-29ctiN0009.fits`), `TGAINFIL`, `GRD_FILE`, `THRFILE` and `SUBPIXFL`, and the same switches (`CTI_CORR = T`, `CTI_APP = PPPPPBPBPP`, `PIX_ADJ = EDSER`, `RAND_SKY = 0`, `RAND_PI = 1`). CALDB 4.12.4 selects, for 2002 ACIS data, exactly the files the 2021 run used. What `acis_process_events` does state in its own parameter file is that the pulse height is randomised before the gain is applied — `rand_pha = yes`, "Randomize the pha value used in gain calculations", with `rand_seed = 1` — and `rand_pi = 1.0` widens the PI assignment. Which of that randomisation, and which of the five years of software between DS 10.9.4 and CIAO 4.18.0, accounts for the energy differences is **not verified** here.

**Only three header cards differ between the two products**: `ASCDSVER` (CIAO 4.18.0 against 10.9.4), `BPIXFILE` and `FLTFILE` — the re-run makes its own bad-pixel list and its own good-time filter, which is what `chandra_repro` does. That, with the new filter, is where the 123 extra events come from: the re-run's livetime is 19,982.34 s against the archive's 19,980.29 s.

**Binned to a counts image**, on a common 3-sky-pixel grid of 722 × 719 blocks: 284,461 of 519,118 blocks hold counts, 518,987 blocks (99.975%) hold exactly the same count in both, no block differs by more than one count, and the total absolute difference over the whole image is 131 counts out of 835,316.

**Trap, measured.** The `CALDBVER` card in the re-run's product reads `4.9.4`, the same as the archive's: `acis_process_events` inherits it from the level-1 input and does not rewrite it. It does not state the CALDB a re-run used, so the receipt records that separately, in `reprocessedWith`.


### ACIS-I, VFAINT: [Polaris](../tools/objects/chandra/programs/polaris-vfaint.json), obsid 6431

ACIS-I (chips 012367), no grating, TIMED/VFAINT, 9.8 ks, 2006-02-09. All 62,471 archive events matched; the re-run keeps 28 more and drops none. `time`, `node_id`, `tdetx`, `tdety`, `pha_ro` and `status` bit-identical; sky positions move at most 0.42 sky pixels. Four header cards differ, one more than the FAINT slice: `CTIFILE`. CALDB 4.12.4 selects `acisD2005-01-01ctiN0012.fits` for this 2006 observation where the archive's 2020 run used `acisD2005-01-01ctiN0009.fits` — a real change in the calibration, not in this toolkit. [Receipt](../tools/objects/chandra/programs/polaris-vfaint.acisf06431N003_evt2.reproduction.json).

### HRC-I, and a moving target: [Jupiter](../tools/objects/chandra/programs/jupiter-hrci.json), obsid 18676

HRC-I, no grating, 9.3 ks, 2017-03-27. **The re-run is exact.** 990,546 events in both lists, all matched on time and chip coordinates, none added, none dropped. Every shared column is bit-identical except `dety` and `y`, which differ in one event of 990,546 by 0.001 sky pixels. The binned counts image agrees in every one of its blocks. The re-run carries three columns the archive's product does not — `ocx`, `ocy` and `PathLength` — because `chandra_repro` now runs `sso_freeze` for a moving target. Three header cards differ: `ASCDSVER`, `BPIXFILE`, `FLTFILE`. [Receipt](../tools/objects/chandra/programs/jupiter-hrci.hrcf18676N003_evt2.reproduction.json).

**The object-centred frame** ([receipt](../tools/objects/chandra/programs/jupiter-hrci.18676.solar-system.json)). Chandra's event coordinates are fixed sky, so a planet drifts across them. JPL Horizons, asked for Jupiter as seen from Chandra itself — observer `500@-151`, which it resolves to "Chandra Observatory (spacecraft) (-151)" — gives an apparent diameter of **44.015″** at this observation and a motion of **54.59″** between its start and end. The body therefore drifts 1.24 of its own diameters across the fixed-sky list, and the object-centred frame should gather it back.

Measured, on a 0.1318″ sky pixel, with a flat background taken from an annulus 6 to 12 body radii out:

| | counts within one body radius | background-subtracted excess |
| --- | ---: | ---: |
| object-centred (`ocx`, `ocy`) | 491 | 31.5 |
| fixed sky (`x`, `y`) | 464 | 3.6 |

The object-centred frame concentrates the source **8.8×** inside Jupiter's Horizons disc. Running `sso_freeze` here, by hand, on the *archive's* own level-2 event list — the CIAO tool, the archive's product, the archive's ephemerides (`jupiterf606960000N001_eph1`, `orbitf606917105N001_eph1`, `pcadf18676_000N001_asol1`) — gives 491 counts and 31.5 excess as well, to the digit: two independent paths to the same frame. It took 2.9 s.

The centroid inside the disc is 1.07″ from the frame centre in the object-centred list and 0.21″ in the fixed-sky one, but with ~31 net counts on ~460 of background that statistic is background-dominated and says nothing; the enclosed excess is what carries the result.

### Refused: any grating

`archive.mts` will not pin an observation with HETG or LETG. `chandra_repro` needs the grating's zero-order position, and its default takes that position from the archive's own level-2 event list — which would make the re-run depend on the product it is being compared against. The independent option, `tg_zo_position=detect`, found no source on either grating observation tried: obsid 169 (ACIS-S/HETG, Crab Pulsar) and obsid 12228 (HRC-S/LETG, Crab Pulsar) both stopped with "No sources detected" under CIAO 4.18.0. A pin attempt reports that reason and stops.

### The archive ledger

[Chandra archive ledger](chandra-ledger.md) and [data/chandra/ledger.json](../data/chandra/ledger.json) are generated by `node tools/objects/chandra/archive-ledger.mts`: the archive's own counts by instrument, grating and exposure mode; the 34 shipped objects Chandra observed, a Solar System body matched on the names the archive gives it and everything else on a 0.25° box about the position this repository states, with background, blank-sky, offset and calibration fields excluded by name; and each mode's state read off the pinned programs and their receipts. Tests check the checked-in ledger against the programs and the guide against the ledger.

## Limits

- Three configurations are proved end to end: ACIS TIMED/FAINT, ACIS TIMED/VFAINT and HRC-I. The ledger says so from the receipts, not from this list.
- **Gratings are refused**, for the measured reason above. Nothing dispersed is pinned, so no grating column (`tg_lam`, `tg_m`, `tg_part`) is ever compared.
- **Continuous-clocking mode is not proved.** The only CC observation of a shipped object to hand, obsid 170, carries HETG and is refused with every other grating observation. Nothing in the comparison blocks CC: its event key was measured unique on obsid 170's own level-1 list — 1,827,297 events, 1,827,297 distinct `(ccd_id, expno, chipx, chipy)`, no duplicate — so a non-grating CC slice would be reprocessed and compared like any other. None was run.
- **GRADED data mode is not proved** for the same reason: obsid 168 and obsid 169, the GRADED observations of a shipped object, both carry HETG.
- HRC-S is not proved. The one HRC-S observation tried, obsid 12228, carries LETG.
- The comparison reads both event lists whole and caps them at 1 GiB each. A long ACIS observation's level-2 list can pass that; it would have to be read in blocks.
- Events are matched on what the instrument telemetered: chip, frame and chip coordinates for ACIS, time and chip coordinates for HRC. Each key column is rank-compressed over both lists, so the key is exact; a key that repeats within one list stops the comparison rather than guessing.
- Only scalar columns are compared. A Chandra event list holds no vector columns besides the status bits, which are compared as the integer they spell.
- The reproduction is of standard data processing only — `chandra_repro`, level 1 to level 2 — plus `sso_freeze` for a moving target. No spectral extraction, no response matrices, no source detection, no exposure correction.
- The object-centred check is a counts measurement on one observation. Jupiter in 9.3 ks of HRC-I gives about 30 net counts inside its disc, so it shows the frame works and could not measure a small error in it.
- The blank-sky background event files (`acis_bkg_evt`, `hrc_bkg_evt`, 3.5 GB together) are not installed, because `chandra_repro` does not read them.
- The ledger's object match is a box, not a field of view: a pointing 0.24° from M31's centre counts for M31 whether or not the detector covered it.
- Nothing here is drawn. No Chandra observation has been turned into a lens or an object dataset.
- `download_chandra_obsid`, the CXC's own retrieval script, is not used: the toolkit pins files by URL, bytes and digest so a receipt names exactly what it read.

## Re-running

```sh
source ~/.nvm/nvm.sh && nvm use 24
node tools/objects/chandra/toolchain.mts install && node tools/objects/chandra/toolchain.mts verify
node tools/objects/chandra/archive.mts m1-crab-halo 2798
node tools/objects/chandra/reprocess.mts m1-crab-halo 2798 .local/chandra/m1-crab-halo
node tools/objects/chandra/compare.mts m1-crab-halo 2798 .local/chandra/m1-crab-halo/repro
node tools/objects/chandra/archive.mts jupiter-hrci 18676
node tools/objects/chandra/reprocess.mts jupiter-hrci 18676 .local/chandra/jupiter-hrci
node tools/objects/chandra/compare.mts jupiter-hrci 18676 .local/chandra/jupiter-hrci/repro
node tools/objects/chandra/solar-system.mts jupiter-hrci 18676 .local/chandra/jupiter-hrci
node tools/objects/chandra/archive-ledger.mts
node --test tools/objects/chandra/chandra.test.mts
```

`.local/chandra` is ignored by git; `--raw <dir>` takes the pinned files from a directory that already holds them instead of downloading, and `--max-rss-gib <n>` moves the memory ceiling. Polaris is the same three commands with `polaris-vfaint 6431`.
