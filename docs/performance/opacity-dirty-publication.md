# Dirty publication and animation advancement

The manual `Trace-20260910T094503.json.gz` contains a 127.255 ms main-thread
task at +2973.431 ms. Its callback is the point-field `finishTransition` timer.
The largest sampled JS location inside that task is the numeric opacity
publisher. The locally retained bundle identifies both functions; the manual
trace has no independent captured-byte manifest.

## Cause

`finishTransition` retires outgoing point entries. Each call to `visible(false)`
notified the shared opacity clock. Outside a camera transaction, that clock
immediately flushed **all active publishers**, and each publisher scanned
**all active entries**. Wall time advances during the timer, so these scans also
wrote changing opacity values to surviving fades repeatedly before the next
paint. Retiring N entries with N surviving fades produced quadratic work.

The repair separates two operations at both ownership levels:

- A setter publishes only dirty entries, preserving immediate final values.
- An animation-frame tick advances active fades once, after camera callbacks.

Batching still combines multiple changes to an entry before publication, but
linear behavior no longer depends on every caller remembering to open a batch.
Other owners' active fades are not advanced by an unrelated setter. Retargeting
still samples wall time; fade deadlines, ease curves and multiplicative opacity
factors are unchanged. No prepared geometry, texture, DOM topology, color,
visibility policy, CSS animation or WAAPI behavior is added.

## Deterministic scaling evidence

The previous and repaired publisher sources are saved beside the executable
operation-count harness in `output/playwright/opacity-dirty-publication/`.
Both run the point-retirement call pattern with wall time advancing between
setters. These are setter counts, not browser frame-time measurements.

| Retiring / surviving entries | Previous writes | Repaired writes |
| ---: | ---: | ---: |
| 16 / 16 | 392 | 16 |
| 64 / 64 | 6,176 | 64 |
| 256 / 256 | 98,432 | 256 |
| 512 / 512 | 393,472 | 512 |

The renderer type check and all 451 renderer tests pass. The regression tests
also verify that another publisher is not advanced, surviving fades continue on
the next frame, settled entries stop ticking, immediate setters remain immediate,
and the authored easing and reversal behavior are preserved.

## Browser qualification

The isolated performance build contains 814 pages and 406 verified prepared
object asset banks. Overview and hovered-Mars screenshots at 1995 × 1236 have
zero differing pixels. All 649 orbit segments, annotations, opacity values,
DOM counts and drawn layer areas match the prior build. No browser opacity
animations were present.

Native Sun → Mars → Earth → Sun navigation, dragging, galaxy zoom-out and return
completed without page errors. The world, input surface and document identities
were retained; checkpoints each had one camera. These correctness checks are in
`comparison.json`, `pixels.json` and `interaction.json` beside the harnesses.

The verified build is now served on **4246**. Refresh before the next manual
recording. The old static build remains in the artifact directory's
`baseline-site/`, and `promotion.json` pins the before/after HTML hashes.

The user owns performance tracing. Operation counts and correctness checks do
not establish a dropped-frame improvement; that remains for the next user trace.
