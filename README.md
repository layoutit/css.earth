# View readout refactor: evidence

Tested revisions: `main` at `19ad051f6c` and the change at `d96165227b` (refactor/view-readout). Only `site/view-readout.mts` differs.

## Oracle (`scenarios.mts`, `oracle-report.json`)

```sh
jankmonster oracle --file site/view-readout.mts --before 19ad051f6c --after d96165227b --scenarios scenarios.mts --mutants 12
```

This uses Jankmonster's `oracle` command (alowpoly/jankmonster `c754555`). The 12 scenarios drive `createViewReadout` with a linkedom sidebar, a fake window with timers and animation frames, and a fake camera looking at a prepared focus (M42). After every step they record the date, coordinate, distance and scale groups (hidden or not), their texts, the ruler and measure widths, the titles, and the pending timers and frames. The scenarios cover:

- no camera;
- camera moves throttled to one render per 100 ms;
- a flight started while a timer or a frame is pending, and a flight started twice;
- arrival;
- a hidden page with a pending frame or timer, then visible again;
- playback;
- the scene element leaving;
- resize and an overview scope change;
- `destroy()` with a frame or a timer pending, and twice;
- setters while hidden and after `destroy()`;
- clearing the camera.

The result: 12 of 12 identical, all 18 changed lines ran on the change and all 16 on main, and 11 of 12 automatic mutants caught. The survivor turns `render()`'s `aborted || hidden` guard into `&&`. It cannot change behaviour: `render()` only runs from an animation frame, and hiding the page and `destroy()` both cancel that frame first.

Not covered: the surface path (a body without a prepared focus), which needs the surface geometry module. This change does not touch it.

## In the app (`capture.mjs`, `runs/`, `app-comparison.txt`)

Headless Chromium against the local dev server, with main's file swapped in for the main runs, twice per side. The steps: Earth loaded, 400 ms into a flight to Mars, arrival at Mars, and `/earth/?focus=m42`. All four runs record the same readout:

- Earth: altitude 24,964 km, 1,000 km scale.
- Mid-flight: date kept, coordinates and scale hidden, altitude "—".
- Mars: altitude 112,911 km, 5,000 km scale.
- M42: distance 77.21 ly, 5 ly scale, no coordinates.

The readout strip is 0 changed pixels against main-1 at Pixelmatch threshold 0.1, except the mid-flight frame. There main-2 and change-1 both differ by 20 pixels, so that frame depends on flight timing.
