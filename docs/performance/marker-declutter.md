# Marker declutter and a fixed marker order

A headless Chrome trace of a zoom out from the Sun to the farthest zoom (48 wheel notches, 2026-09-30) was idle for most
of its 28 seconds. Its slow stretch was notches 8 to 10, 84 to 582 AU out, where the whole Solar System shrinks to a few
pixels around the Sun. There the page drew 246 to 363 context markers, their centres inside about 40 by 12 pixels.
Counted by their boxes, 5,523 to 21,391 pairs of them overlapped. Every one was published, restyled and composited each
frame, though almost all lay under others.

## Change

- **A marker under another is not drawn** (`packages/renderer/src/universe/world-context/marker-declutter.ts`). After
  label admission, the planner keeps markers in order: the focus, the selection and any hovered or highlighted body;
  then by annotation tier; then those with an admitted label or circle; then by the frame's priority. A marker whose
  drawn dot overlaps a kept one is hidden, and takes no clicks; it returns once clear by 15% more, so a zoom does not
  blink dots. Tier ranks before an admitted label: a label is admitted only once measured, and only a drawn marker is
  measured, so ranking labels first let a labelled moon hide its planet's dot for good. Until this change, crowding hid
  only captions and circles.
- **A fixed marker order** (`createDepthOrder` in `prepared-world-context.ts`). Each body stacks behind the selected
  body's detail when it is farther along the view, in front of it otherwise, so a dot behind a translucent focus (a
  galaxy's image, an atmosphere) stays under it. On each side the order is the bodies' annotation priority, the larger
  body first on a tie. The camera-depth sort it replaces re-ranked every body on each turn's release; a half turn at
  582 AU swapped the order of 13,679 overlapping pairs.
- **A system card lays out only the rows in view** (`site/shell/maps-shell.css`). Past about 580 AU the card lists the
  Sun's system: 549 rows, 682 KB of HTML, about five shown at once. Inserted mid-zoom, the list laid out 7,649 objects
  in one frame. Its rows now take `content-visibility: auto`.

## Results

| | Main | This change |
| --- | --- | --- |
| Markers drawn at 220 AU | 385 | 162 to 165 |
| Markers drawn at 578 AU | 246 | 65 |
| Overlapping pairs swapped by a half turn at 578 AU | 13,679 | 31 |
| Slow stretch frame, median / 95th percentile / worst | 6.6 / 13.7 / 29.1 ms | 5.5 / 12.4 / 13.0 ms |
| Largest layout of the zoom | 7,649 objects | 596 objects |

![The Sun's marker pile at 220 AU, main left and this change right, 3x](marker-declutter/pile-220-au.jpg)

The five reference views (Earth, Sun, Milky Way, Nearby Universe, Observable Universe) at threshold 0: Sun, Nearby
Universe and Observable Universe are identical. Earth changes 17 pixels, two faint dots under brighter ones. Milky Way
changes at its centre, where the neighbouring stars' dots no longer draw over the Sun's:

![The Sun from the Milky Way's default view, main left and this change right, 8x](marker-declutter/sun-from-the-milky-way.jpg)

The Solar System card renders the same pixels with and without `content-visibility`, at its top and 3,000 px down.

## Limits

Headless Chrome on an M-series Mac; no iPad trace. Timings are one run each, and a single frame varies between runs.
Which of Saturn's and Rhea's captions wins their collision at 220 AU depends on the zoom's timing, on main and with
this change alike.
