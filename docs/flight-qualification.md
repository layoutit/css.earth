# Flight qualification, 7 September 2026

The expanded native-input runs exposed a replacement-flight delay and a search
ownership bug. Both now have shared lifecycle fixes. These results do not
establish consistently smooth frame delivery or full merge readiness.

## Sustained interaction

Immutable performance build `244d0cb9953e08d6eec1ccbc9db265e51736797d`, Chrome
Canary 155.0.8043.0, 1995 × 1236 CSS pixels, motion animation off. Three independent
documents ran sequentially against the static preview server. The operator
shortened the original six-chain plan after chain three; the other three were
not run. No source/build mutation occurred during their interaction phases.

| Seed | Start | DPR | Selections | Drags | Dataset changes | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 2800682729 | Jupiter | 1 | 30 | 62 | 6 | Passed |
| 2685674292 | Saturn | 2 | 30 | 63 | 6 | Passed |
| 1555659821 | Mercury | 1 | 30 | 57 | 6 | Passed |

Totals: 90 initial selections, 15 additional replacement selections, 182 curved
drags, 300 coarse wheel actions, 30 fine wheel bursts, 18 dataset changes, and
15 deliberate flight interruptions. Arrivals visited 37 distinct bodies. Input
used 58 marker picks, 17 label picks, 12 orbit picks, and 3 sidebar picks.

All three documents retained their universe and input nodes, returned to one
detailed scene after navigation, and recorded no application/transport errors
or reloads. Six orbit probes selected a different body than the harness's
intended chord; each published selection reached its destination. Overlapping
corridors and intervening motion mean this is selection/arrival evidence, not
proof that every intended orbit won hit testing. The actual app input was
prohibited from using `elementsFromPoint` throughout the runs.

Artifacts: `output/playwright/navigation-stress-static-244d0cb9/<seed>/` contains
reports, action coordinates and camera states, traces, diagnostics, screenshots,
and derived metrics. Low-priority analysis of a completed trace briefly overlapped
later chains; these runs are not a controlled before/after performance benchmark.

## Measured issue and fix

During replacement of an activating destination, the router retires that detail.
The departure branch then lacked a scene camera owner and waited for preparation
before starting movement. Observed delays included Jupiter → Europa at 624 ms,
Eris → Iapetus at 809 ms, and Saturn → Daphnis at 539 ms.

Commit `4fa34b72` lets the retained application world publish departure when the
detail owner is absent. It uses the last drawn pose and the existing target-detail
hold, without introducing a second flight or fabricated detail scene. The focused
regression fails on the old implementation and passes with this change; the
38 navigation/router checks pass.

The real-browser regression selects during activation, holds the replacement's
exact prepared bank, and checks both the first-motion mark and actual retained
world transform changes before releasing the bytes. The old production build
failed the 1.2-second blocked-bank check. The corrected build is exercised on
Jupiter → Europa, Pluto → Charon, and Saturn → Daphnis at DPR 1 and 2. All six cases passed with no application errors; first motion
was 22.3–25.7 ms, with changed world transforms and no detail bank available.
These are publication timings, not physical display latency. Results live
in `output/playwright/replacement-qualified-4fa34b72/report.json`.

The stress matrix precedes this final fix; its 90 selections are not claimed as
post-fix coverage. The focused browser replay qualifies the changed branch.

## Remaining limits

Full-presentation gaps during sustained drags still exceed a 60 Hz frame budget.
Examples in these recordings: Phoebe p95 29.15 ms, Haumea at DPR 2 p95 31.83 ms,
Phobos p95 48.21 ms. These are individual drag intervals, not aggregate FPS.
RequestAnimationFrame timing alone was not used as delivered-frame evidence.
A texture-paging experiment worsened Charon's full-presentation p95 from about
17 ms to 28–29 ms and increased downloads; it was removed from the PR.

The broader source/preparation gate remains incomplete: this checkout lacks
pinned inputs and the preparation suite also reports separate assertions.
The production-shaped build and focused renderer/platform/shell/package checks
are useful evidence, not substitutes for that gate. The PR remains a draft.
