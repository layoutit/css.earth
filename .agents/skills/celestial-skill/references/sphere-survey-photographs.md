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
- reads the spin record in the column order the survey's Table A.1 pole
  supports. A body whose own published pole belongs to another solution, such
  as a DAMIT model, gets the survey's pole in its lens record;
- gives the ADAM mesh, an OBJ in kilometres, the body's own mesh settings,
  raising the simplification error bound to the next 100 m above what the ADAM
  mesh reaches at the face target when the body's bound falls short;
- writes both Horizons tables, derives every camera and measures the figure.

It stops with the reason when the spin record and the paper describe
different solutions (Eleonora, Nemesis and Thisbe), when the figure uses
another layout, or when LAM refuses a file. Table A.1 prints Thisbe's pole past
the pole, latitude 116°; the setup folds it to the direction its printed
obliquity confirms before comparing.
`--leave-out=<frame-id>,…` leaves named frames out of the selection; a frame
the figure shows cannot be left out.

## Decide

Look at `evidence/published-comparison.webp`. It shows each figure column's
photograph with the outline of the paper's model in amber and ours in cyan. The
lens ships when our outline follows the paper's at the same phase. The install
checks this for every column: over a full turn in 10° steps, the best match to
the paper's model must be at our phase, one step from it, or better by less
than the same-shape loss, which happens on nearly round outlines. Otherwise it
refuses and names the column.

![The weakest figure column of each body installed on 2026-09-18](sphere-survey-photographs.webp)

Above, each body installed on 2026-09-18 appears once, at the column where our
outline overlaps the paper's model least, beside that column's same-shape
ceiling. Read each overlap against its same-shape score. The numbers are
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

Install and prepare one body at a time: the text step checks every package,
so a body installed but not yet prepared stops every other body's preparation.
A body whose preparation fails must be reset before the next one runs.

Preparation stops with "Observation level fit exceeds its authored gain
budget" when a frame needs more than a 4× level adjustment against the first
frame, which anchors the display. The error names each frame beyond the budget
against the first frame or the median frame, so it shows whether the first
frame is the odd one (Davida's is, and every other frame is named against it)
or a few others are. Reset the package, then install again leaving out the
fewest frames that bring the rest within the budget of the first remaining
frame, never one the figure shows, with the measured reason:

```bash
node tools/objects/sphere-survey/install.mts <id> --leave-out=<frame-id>,… --because="<measured reason>"
```

The reason goes into the ledger decision, the `surface-imagery` entry and the
README's known problems.

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
