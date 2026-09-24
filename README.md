# Wheel zoom motion refactor: evidence

Tested revisions: `main` at `f9ecb8c44c` and the change at `1659b716e2` (refactor/wheel-zoom-glide).

## Oracle (`scenarios.mts`, `oracle-report.json`)

```sh
jankmonster oracle --file src/renderers/css/navigation/prepared-wheel-zoom.ts --before f9ecb8c44c --after 1659b716e2 \
  --scenarios scenarios.mts --mutants 12
```

This uses Jankmonster's `oracle` command (alowpoly/jankmonster `d66d70e`). Each side's `prepared-wheel-zoom.ts` is bundled with esbuild, and 14 scenarios run against both, each in its own process. The scenarios use a fake surface and frame clock, the site's runtime policy, and a camera clamped between two distances. They cover: a wheel notch dollying then gliding to rest; line and page delta modes; notches in a row; trackpad swipes; a wheel notch after a trackpad swipe; a pinch; a reversal mid-dolly; a new notch during a glide; both bounds; frames straddling the interval; stop, disable and re-enable; ignored events; and destroy mid-dolly. Every rotation, prevented default and `stats()` snapshot is recorded.

The result: 14 of 14 identical, all 47 changed code lines run on the change and all 60 on main, and 12 of 12 automatic mutants of the changed lines caught. A hand-planted reset of the carried `direction` and `travelRate` at the end of a glide-less dolly was also caught by "a wheel notch after a trackpad swipe", the one scenario where that carry-over is observable.

## In the app (`app-pixelmatch.txt`, `app-*.json`)

These use headless Chromium against the same local dev server with each revision's renderer, captured twice per revision. The flows are: four wheel notches in on Earth (to its near bound), two notches out, and Mars in then out. Zooming in to the bound gives the same distance and 0 changed pixels at threshold 0.1 across all four runs. The other two depend on real-browser event timing: two runs of main differ by up to 7,636 pixels, and main against the change stays inside that range. The oracle covers those paths deterministically.
