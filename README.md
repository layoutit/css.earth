# One frame clock per window: evidence

Tested revisions: `main` at `1868931acb` and the change at `1c9a1ef8b4` (refactor/frame-clock-per-window).
The owner count was measured on `3baaf4cbfe`, whose clock code is identical to main's.

## The share count never reached zero (`owner-count.txt`, `owner-count-probe.mjs`)

With a temporary log in `createOpacityClock`, a headless run loads Earth and flies to Mars, Saturn and back. The owner
count goes 6, 9, 11, 15. 23 shares are taken and 8 released, and the clock is never destroyed. So on a real page the
last-owner `destroy()` never ran.

## Jankmonster (`unreleased-acquisitions-main.json`, `unreleased-acquisitions-change.json`)

Jankmonster's new `unreleased-acquisition` lead compares bindings made by the same factory. On main it flags the four
`createOpacityClock` shares that are never released while four peers are: the dolly's reveal clock, world-camera
picking, prepared activation and the world context's own clock. On the change those four are gone. The three other
leads (a scene lifetime and two navigation bindings) are the same on both sides and not part of this change.

## In the app (`capture.mjs`, `compare.mjs`, `app-comparison.txt`, `runs/`)

Headless Chromium against the local dev server, with each side's renderer built from its own source, run twice per
side. The flow: load Earth, drag, three wheel notches, hover, then fly to Mars, Saturn and back to Earth. After each
step settles, it counts the browser frames requested in two idle seconds (a counter wrapped around
`requestAnimationFrame`, which saw frames in every step) and takes a screenshot.

- Idle frames are 0 at every step on both sides: the clock stops requesting frames without being released.
- Every frame is 0 changed pixels against main-1 at Pixelmatch threshold 0.1. At threshold 0, the three frames after
  a flight differ by 4 to 28 pixels, and main's two runs differ from each other by the same amount.

`saturn-after-flights.png` is the change on arrival at Saturn's system after flying from Earth by way of Mars. It is pixel-identical to main at threshold 0.1.
