# SPHERE survey photographs

This recipe photographs a main-belt asteroid from the VLT/SPHERE imaging survey
of Vernazza et al. (2021), using the survey's deconvolved ZIMPOL frames. The lens
ships on the survey's own comparison figure, as the
[rule for ground-based lenses](../../../../tools/objects/surface-observations/README.md#observer-computed-cameras)
explains. Two commands do the work; Iris and Hebe are the worked examples.

## Before you start

- Read the body's `investigations.json` and the
  [investigation ledger index](../../../../docs/provenance/investigation-index.md).
  Most survey bodies have an unresolved `sphere-cross-frame-registration` entry.
  It says the frames show shape and shading, not markings. It does not block
  this route.
- Work in a dedicated worktree.

## Set up and measure

```bash
node tools/objects/sphere-survey/setup.mts <id>
```

This writes nothing in the package. In `output/sphere-survey/<id>/` it builds a
copy of the package's `source/` with the lens added, measures it, and writes
`setup.json`, `evidence/published-comparison.json` and the evidence image. Along
the way it:

- finds the body's figure in [`vernazza-2021-figures.json`](../../../../tools/objects/sphere-survey/vernazza-2021-figures.json)
  by its Horizons number, and reads the frame time printed over each column
  from the figure's pixels;
- lists the release's frames, and marks a column the release lacks as having no
  lens frame;
- keeps one apparition's camera-1 frames: the one the figure shows most. An
  apparition over the 32-frame bound keeps every series, thinned evenly, with
  the figure's frames always kept;
- takes every file from this machine when a copy exists, and downloads the rest
  from LAM with its public cookie;
- reads the spin record in the column order the published pole supports;
- writes both Horizons tables, derives every camera and measures the figure.

It stops with the reason when the body's pole is not the survey's own, when
the spin record and the paper describe different solutions, when the figure
uses another layout, or when LAM refuses a file.

## Decide

Look at `evidence/published-comparison.webp`. The lens ships when it shows our
outline on the paper's photographs and our model matching the paper's at the
same phase. Read each overlap against its same-shape score. The numbers are
reported, not a gate, and the registration stage's verdict is reported beside
them.

## Install and prepare

```bash
node tools/objects/sphere-survey/install.mts <id>
```

It reruns the setup and writes it into the package: the frames, mesh, tables
and records, the source bindings with placeholder evidence, download
operations, the lens control and reader text, the ledger decision and the
entries it closes, the README's source rows and generated evidence blocks, and
the credits. It copies missing pinned inputs from sibling checkouts by hash and
moves scene files no inventory owns into `output/stale-public/<id>/`. Then:

```bash
node tools/prepare-object.mts <id>
```

```bash
node tools/objects/report-registration.mts <id> --write
```

Commit, then run `pnpm author:sources <id> --evidence <commit>` and commit again.
Publish with `pnpm publish:runtime-assets --object=<id>` before merging.

## Survey figure conventions

These hold for Appendix B of the paper. The setup reads the labels of all 39
figures in the standard layout, and 289 of their 290 labels name a released
camera-1 frame; Amphitrite's 2019-08-16 07:21:27 does not.

- North is up and east is left. Scale bars are 100 or 200 km.
- Each column is labelled with its frame's exposure start to the second,
  followed by a rotational phase counted from the first column.
- Dark rows are SPHERE, then MPCD, then ADAM. Doris and Adeona have no MPCD row.
  The residual rows below, on grey, are not read.
- The red arrow is the spin axis. The comparison reads its angle and leaves it
  out of the body's outline.
- A figure with more epochs than fit one band continues in a second band below.
