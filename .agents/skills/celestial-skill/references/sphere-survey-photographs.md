# SPHERE survey photographs

This recipe photographs a main-belt asteroid from the VLT/SPHERE imaging survey
of Vernazza et al. (2021), using the survey's deconvolved ZIMPOL frames. The lens
ships on the survey's own comparison figure, as the
[rule for ground-based lenses](../../../../tools/objects/surface-observations/README.md#observer-computed-cameras)
explains. Iris is the worked example: read its
[`published-comparison.json`](../../../../src/objects/iris/source/preparation/published-comparison.json),
[`observer-cameras.json`](../../../../src/objects/iris/source/preparation/observer-cameras.json)
and its `zimpol` lens in `terrestrial.json` beside these steps.

## Before you start

- Read the body's `investigations.json` and the
  [investigation ledger index](../../../../docs/provenance/investigation-index.md).
  Most survey bodies have an unresolved `sphere-cross-frame-registration` entry.
  It says the frames show shape and shading, not markings. It does not block
  this route.
- Eleonora and Nemesis cannot use it yet. Their released spin records describe a
  different solution from the survey's published pole, and
  `spin-record-reading.test.mts` keeps both entries open.
- Work in a dedicated worktree. If the comparison says no, discard the package
  changes and record the numbers in the ledger as unresolved.
- Take every file below from a sibling worktree or R2 by hash before
  downloading it.

## Sources

| Input | Where |
| --- | --- |
| Frames | `https://observations.lam.fr/astero/Data/<n><Name>/Deconv/`, files `d<n><Name>_<UTC start>_zpl_science_imaging_cam1.fits`. LAM answers HTTP 417 without its public cookie, so send `CesAM_LAM_opens_the_door=1`. A file can fail on a cold request until the directory listing has been fetched once. |
| Mesh | The ADAM model, `https://observations.lam.fr/astero/3Dshape/<n>_<Name>_adam.obj`, as the lens's `radialTerrainAlternatives` entry. |
| Spin record | The release's parameter file, usually pinned already as `reference/release-parameters.txt`. Its name varies, for example `3_Juno_param.txt` and `9_Metis_param`. |
| Published pole | `reference/model-properties.json`, `poleEclipticJ2000Degrees`, from the paper's Table A.1. |
| Paper | Vernazza et al. (2021), A&A 654, A56, [doi:10.1051/0004-6361/202141781](https://doi.org/10.1051/0004-6361/202141781), CC-BY-4.0, pinned as `reference/vernazza-2021.pdf`. The object numbers below hold for its 25,270,498 bytes, SHA-256 `85c45bbcf5705a5173fa1da7593aba777f3c083c61bb6a88ecf15a6513a7725f`. |

## Steps

1. **Choose the frames.** Keep one apparition, and take every camera-1 frame
   from its nights, at most 32. The figure's columns show which epochs the
   authors used. A handful of frames from one short window is one rotational
   phase, not several looks.
2. **Declare the inputs.** Add the frames, the ADAM mesh and the spin record to
   `source/manifest.json` with their pins, then their download operations to
   `source/preparation/acquisition.json`, then run `pnpm pin:documents <id>`.
   Keep that order. An acquisition target must already be in the manifest, and
   an `acquire` run restores `acquisition.json` from its pin, discarding
   unpinned edits.
3. **Add the lens.** Copy Iris's `zimpol` entry into
   `source/preparation/terrestrial.json` and replace its frames. The recipe
   fails validation without `selection`, `levelMatching`, `transfer`,
   `photometry` and `display`.
4. **Write `source/preparation/observer-cameras.json`.** State the spin record
   with the column order its published pole supports. The loader refuses the
   other order and names the one to use.
5. **Write the Horizons tables** with
   `node tools/objects/sphere-horizons.mts <id> --write`.
6. **Derive the cameras** with
   `node tools/objects/observer-cameras.mts <id> --write`.
7. **Name the figure** in `source/preparation/published-comparison.json`. Take
   the figure and object number from the table below. State `width` and
   `height` as 0 and `sha256` as 64 zeros; the first `--write` adopts the
   figure's real values. Rows count down the dark band: `image` is 0, `model`
   is the ADAM row, and `count` is the band's dark rows. Render the figure and
   read each column's label. Map it to the lens frame whose exposure starts at
   that second, or to null for an epoch the lens does not use. Give `band: 1`
   to columns in a second band.
8. **Measure** with `node tools/objects/published-comparison.mts <id> --write`.
   Look at the figure it adopted, then at `evidence/published-comparison.webp`.
   Read each overlap against that column's same-shape score.
9. **Decide.** The lens ships when the evidence image shows our outline on the
   paper's photographs and our model matching the paper's at the same phase.
   The numbers go in the ledger entry `<lens>-published-comparison` with the
   figure and the DOI. They are reported, not a gate. Give the entry status
   `included` and no `revisitWhen`, and set the observer-cameras record's
   `publishedComparison: { ledgerEntry }`. Run `pnpm investigations:index`
   after any ledger edit.
10. **Add the lens control and reader text.** Copy Iris's lens control in
    `source/content/object.json` and its dataset entry in `text.json`. Text
    preparation checks every body, so one missing dataset stops them all.
11. **Prepare** with `node tools/prepare-object.mts <id>`, then write the
    registration block with `node tools/objects/report-registration.mts <id> --write`.
    Delete stale assets from an earlier run first; they fail as an
    "Unowned canonical asset".
12. **Bind the sources.** Run `pnpm author:sources <id>`, commit, then run
    `pnpm author:sources <id> --evidence <commit>` and commit again. The second
    run records the body's provenance again, because the manifest changed.
13. **Publish** the runtime assets with
    `pnpm publish:runtime-assets --object=<id>` before merging.

Run `spin-record-reading.test.mts`, `observer-cameras.test.mts`,
`published-comparison.test.mts` and `report-registration.test.mts` before
opening the PR.

## Survey figure conventions

These hold for Appendix B of the paper, checked on Iris, Hygiea, Doris,
Adeona, Elektra and Kleopatra.

- North is up and east is left. Scale bars are 100 or 200 km.
- Each column is labelled with its frame's exposure start to the second,
  followed by a rotational phase counted from the first column.
- Dark rows are SPHERE, then MPCD, then ADAM. Doris and Adeona have no MPCD row.
  The residual rows below, on grey, are not read.
- The red arrow is the spin axis. The comparison reads its angle and leaves it
  out of the body's outline.
- A figure with more epochs than fit one band continues in a second band below.

## Figure table

Bands lists the columns in each dark band; figures marked "other layout" have
more rows and are not read by the tool.

| Figure | Body | PDF page | Object | Size (px) | Bands | Dark rows |
| --- | --- | --- | --- | --- | --- | --- |
| B.1 | (1) Ceres | 19 | 1072 | 2440 × 3054 | other layout | — |
| B.2 | (2) Pallas | 20 | 1081 | 1614 × 2466 | 6 + 5 | 3 |
| B.3 | (3) Juno | 21 | 1082 | 1614 × 1233 | 6 | 3 |
| B.4 | (4) Vesta | 22 | 1083 | 2882 × 3046 | other layout | — |
| B.5 | (6) Hebe | 23 | 1084 | 1614 × 1233 | 6 | 3 |
| B.6 | (7) Iris | 23 | 1085 | 1598 × 1233 | 6 | 3 |
| B.7 | (8) Flora | 24 | 1086 | 1118 × 1233 | 4 | 3 |
| B.8 | (9) Metis | 24 | 1087 | 1598 × 1233 | 6 | 3 |
| B.9 | (10) Hygiea | 25 | 1088 | 1598 × 2466 | 6 + 6 | 3 |
| B.10 | (11) Parthenope | 26 | 1089 | 1358 × 1233 | 5 | 3 |
| B.11 | (12) Victoria | 26 | 1090 | 1358 × 1233 | 5 | 3 |
| B.12 | (13) Egeria | 27 | 1091 | 1598 × 1233 | 6 | 3 |
| B.13 | (15) Eunomia | 28 | 1092 | 2084 × 2463 | 8 + 7 | 3 |
| B.14 | (16) Psyche | 29 | 1093 | 1838 × 2466 | 5 + 7 | 3 |
| B.15 | (18) Melpomene | 30 | 1094 | 1598 × 1233 | 6 | 3 |
| B.16 | (19) Fortuna | 30 | 1095 | 2318 × 1233 | 9 | 3 |
| B.17 | (21) Lutetia | 31 | 1096 | 4450 × 2946 | other layout | — |
| B.18 | (22) Kalliope | 31 | 1097 | 2318 × 1233 | 9 | 3 |
| B.19 | (24) Themis | 32 | 1098 | 1598 × 1233 | 6 | 3 |
| B.20 | (29) Amphitrite | 33 | 1099 | 1598 × 2466 | 6 + 6 | 3 |
| B.21 | (30) Urania | 34 | 1100 | 1118 × 1233 | 4 | 3 |
| B.22 | (31) Euphrosyne | 34 | 1101 | 1838 × 1233 | 7 | 3 |
| B.23 | (41) Daphne | 35 | 1102 | 1118 × 1233 | 4 | 3 |
| B.24 | (45) Eugenia | 36 | 1103 | 1358 × 2466 | 5 + 5 | 3 |
| B.25 | (48) Doris | 37 | 1104 | 638 × 752 | 2 | 2 |
| B.26 | (51) Nemausa | 37 | 1105 | 1598 × 1233 | 6 | 3 |
| B.27 | (52) Europa | 38 | 1106 | 1598 × 2466 | 6 + 6 | 3 |
| B.28 | (63) Ausonia | 39 | 1107 | 1598 × 1233 | 6 | 3 |
| B.29 | (87) Sylvia | 39 | 1108 | 2080 × 1230 | 8 | 3 |
| B.30 | (88) Thisbe | 40 | 1109 | 1598 × 1233 | 6 | 3 |
| B.31 | (89) Julia | 40 | 1110 | 2076 × 1230 | 8 | 3 |
| B.32 | (128) Nemesis | 41 | 1111 | 1358 × 1233 | 5 | 3 |
| B.33 | (130) Elektra | 41 | 1112 | 1838 × 1233 | 7 | 3 |
| B.34 | (145) Adeona | 42 | 1113 | 878 × 752 | 3 | 2 |
| B.35 | (173) Ino | 42 | 1114 | 1358 × 1233 | 5 | 3 |
| B.36 | (187) Lamberta | 43 | 1115 | 1358 × 1233 | 5 | 3 |
| B.37 | (216) Kleopatra | 44 | 1116 | 1598 × 2466 | 6 + 5 | 3 |
| B.38 | (230) Athamantis | 45 | 1117 | 878 × 1233 | 3 | 3 |
| B.39 | (324) Bamberga | 46 | 1118 | 2078 × 2463 | 8 + 7 | 3 |
| B.40 | (354) Eleonora | 47 | 1119 | 1838 × 1233 | 7 | 3 |
| B.41 | (511) Davida | 47 | 1120 | 1838 × 1233 | 7 | 3 |
| B.42 | (704) Interamnia | 48 | 1121 | 1838 × 2466 | 7 + 6 | 3 |
