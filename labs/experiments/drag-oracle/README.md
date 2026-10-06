# Drag oracle

Earth's drag is meant to feel like dragging a CesiumJS globe. This lab puts the two side by side and gives both the same
pointer stream, so a change to the drag can be checked against Cesium instead of by feel.

- Left: CesiumJS 1.145.0 with its own `ScreenSpaceCameraController`. No cssEarth code runs on this side.
- Right: this checkout's drag controller (`packages/renderer/src/navigation/input/camera-input.ts`) and engine math
  (`packages/engine/src/navigation/pole-drag.ts`). A second Cesium globe draws its orientation and takes no input.

Both stand at the same pole, distance and field of view. Cesium keeps north up; cssEarth leans Earth's pole 8° on
screen, so the two are compared through that turn about the line of sight.

## Run it

```bash
node labs/experiments/drag-oracle/run.mts serve
```

Open http://127.0.0.1:4455/ and drag either globe. The readout is the angle between the two orientations. The buttons
replay fixed strokes on both. CesiumJS loads from jsDelivr, so the page needs the network.

```bash
node labs/experiments/drag-oracle/run.mts stress --count=4000
```

Runs seeded random drags on both, headless, and reports how far apart they end: random views, distances, strokes on
and off the globe, flicks, holds, and one to four pointer samples a frame. Each frame runs on a clock stepped by hand
and nothing is drawn, so 4000 drags take about 20 seconds. `--chain=3 --nosync` runs three drags in a row without
bringing the two together between them. The command fails when a drag differs by more than 0.1° and Cesium itself
repeats that drag when nudged by 0.001 px.

```bash
node labs/experiments/drag-oracle/run.mts trace 1 235
```

Prints one of those drags frame by frame: where the pointer was, each side's latitude and longitude under the eye, and
whether Cesium was panning or turning off the globe.

```bash
node labs/experiments/drag-oracle/run.mts record
```

Rewrites `packages/engine/src/navigation/pole-drag.cesium.json`: what Cesium does in each frame of twelve drags. The
engine and renderer tests check the drag against it. Run it again only when the Cesium version or the recorded seed
changes.

## What it found

Measured on 2026-10-04.

| Drag code | Drags | End more than 0.1° from Cesium | Median distance from Cesium |
|---|---|---|---|
| `main` before this change | 4,000 | 3,842 | 26.6° |
| With Cesium's pan, turn off the globe, hold at the poles and inertia | 16,000 | 10 | 0.000° |

All 10 are drags Cesium does not repeat itself under a 0.001 px nudge: a press exactly on the limb, or a coast that
spins tens of degrees a frame beside a pole. Three drags in a row without re-sync, 6,000 drags: 3 end more than 0.1°
apart, all of that kind.

Four rules of Cesium's had to be matched, each found by a drag that differed:

1. One turn a frame, by that frame's whole pointer movement. Cesium's pan in two steps is not its pan in one.
2. From the first frame the pointer is off the globe, the drag turns by viewport share until release.
3. A pole stops 0.0001 rad short of the line of sight. With the eye within 0.01 of a pole in each of its two equatorial
   coordinates, a square about the pole, a tilt toward the pole does nothing.
4. Only a press shorter than 0.4 s coasts. Each frame replays half the pointer movement of the frame before the last,
   multiplied by `exp(-2.5 t)`.

## Limits

- The right side runs the shipped controller with a trackball mirrored from the app (`ours.mts`). It is not the app's
  page: the body is centred, and the sidebar offset is not represented.
- Both sides use a sphere. cssEarth's pan uses one; Cesium's default is the WGS84 ellipsoid.
- Below 2.3 radii Cesium answers a press off the globe by looking around. cssEarth has no such mode, and the stress run
  starts those presses on the globe.
- Under the real clock the two sides read time from different sources, so a coast can end a few tenths of a degree
  apart, more beside a pole. The stress run gives both the same clock.
