# Interaction work: PR2 wrap-up review

Reviewed PR2 head: `8524ce3ba6bd93aaa0b81a47701dda553179ab1b`.
Unmerged experiment checkout: `main` at `d97c12a`, with existing local changes.
Scope: the accumulated camera/interaction work, pending local experiments,
the capture/comparison tools, and compatibility with the current shared runtime.
This is not a new scientific-accuracy certification of the object assets.

The current PR already contains the accepted interaction integration and the
newer eleven-object runtime. Copying the original dirty checkout onto it would
regress both. This follow-up preserves the PR's product runtime and adds focused
release regressions, corrected consumed-input pairing, and an explicit
readback-free timing diagnostic.

## Findings and disposition

### 1. Release-history regression in the unmerged local work — high

`src/platform/google-earth-drag-inertia.mjs`, `estimateGoogleEarthDragThrow`:
the local experiment changes the release comparison from movement deltas two
slots apart to adjacent deltas (`history.length - 3` becomes `- 2`). The recovered
release routine at `0x005ae6ea` compares the newest delta with index `min(count - 1, 2)` in its
delta history. The press is represented by a zero delta in our position ring.

These are discriminating cases, not a test that merely repeats the formula:

| Last three movement deltas | Existing PR2 | Unmerged local version |
| --- | --- | --- |
| 10, 20, 20 pixels | Coasts | Stops |
| 10, 20, 10 pixels | Stops | Coasts |

Both implementations were executed against these inputs. Preserve PR2's rule;
the added test checks both outcomes before and after the history ring wraps.
Do not import the reversed local assertions.

### 2. The oracle dropped a consumed release movement — high, fixed

`pair-rendered-motion-inputs.mjs` assumed that a release position entered motion
history only when inertia launched. The stopped interrupted-flight recording
actually has five consumed positions; the paired report kept only four and
replaced the true release position with the preceding drag position.

The missing release delta is approximately (21, 21) pixels. Compared with the
delta two slots earlier, approximately (21, 22), it falls below the 2.5-pixel
release threshold and explains the native stop. Dropping it makes the browser
launch a coast and creates roughly 146 degrees of spurious endpoint error.

Pairing now uses the complete observed non-throwing history and verifies every
position against delivered input, including the release. Its motion-only path
reads through the recorded input history rather than ending at the pre-gesture
pixel snapshot. A regression runs the actual pairing CLI on a fixture with a
distinct consumed release position and verifies that position is retained.
Provenance verification follows the original capture directory when the paired
report is saved separately.

The corrected interrupted-flight replay stops without launching inertia, with
the product runtime unchanged. This fixes a bad oracle input; it does not erase
the remaining trajectory mismatch.

### 3. Suppressing every release after interrupted flight — high

The local `pointerThrowSuppressed` flag in `cubic-sky-runtime.mjs` survives from
pointer-down until release whenever that press interrupted flight. This prevents
an entirely new accelerating drag from starting inertia. A single interrupted
trace that ended without a coast does not justify this universal rule. Finding 2
explains the observed stop using the existing release rule, without such a flag.

Keep PR2's current ownership behavior. A new lifecycle test starts flight,
interrupts it, performs a fresh accelerating drag, and verifies one cancellation,
one release-driven coast, and one pending animation callback.

### 4. Timing and pixel evidence were conflated — high

The late timing captures disable native image readback during input, but their
browser counterpart still continuously records compositor images. That is not
a like-for-like instrumentation comparison. The pending runner rewrite also
removes the existing input-step-bound capture and frame-by-frame comparison.

Keep the existing video runner. Add `motion-only` to the browser capture tool:

- Real CDP input and the natural browser animation clock, unchanged from `normal`.
- No screencast during the measured gesture; images only at the boundaries.
- Observe the browser through rest with idle controllers, not a fixed clip length.
- Require the reference's pixel capture to finish before its first accepted input.
- Read all reference matrix observations through its recorded rest endpoint.
- Explicitly label the result as motion evidence, not video; the video comparator
  rejects this mode.

The analysis also uses consumed input times when supplied, so release/interruption
labels describe the camera's consumed events rather than earlier posting receipts.
Unit tests cover reference readback rejection and browser clock/readback handling.

### 5. Partial off-axis measurements extrapolated as a full response — medium

The unmerged camera-center response is measured through 324.127 ms but adds a
zero-offset endpoint at about 3.65 seconds. The swoop response similarly joins a
short measurement to the main zoom with an unmeasured smooth bridge. These may
be useful experiments; they are not evidence of the full native response.

Keep the accepted complete 123-frame primary response already in PR2. Do not
import the partial off-axis extension, its 50-fold swoop-factor change, or the
dependent transport until a complete off-axis reference validates them.

### 6. No established full natural-clock parity tolerance — unresolved

Controlled input-step captures establish a different claim from independently
scheduled real-time interaction. Earlier phase-sweep results do not establish
an unavoidable error floor: reference/browser readback was asymmetric, input
transport differed, and native-versus-native timing repeatability has not been
calibrated for this final capture setup.

The new timing diagnostic must report observed rotation error and input delivery
lag separately. Neither a passing behavior test nor a matching resting endpoint
is a per-frame parity pass. Surface tessellation/pixel differences remain separate
from camera orientation, projected-center and radius errors.

## Validation

Validation is run in an isolated worktree of the exact PR head, with its own
server on port 4297 and the canonical prepared inputs. The original dirty
checkout and the PR owner's checkout remain untouched. No native application
was launched, patched, restarted or stopped during this review.

- Source acquisition verification: all eleven implemented objects pass.
- Full tests: 823 pass (278 platform, 166 shell, 379 object-package tests).
- Production build and asset assembly: pass.
- Complete installed-Chrome browser chain at DPR 1 and DPR 2: pass, Chrome
  `152.0.7977.76`. Includes 22 shared-owner cases, 22 prepared-camera cases,
  143 conformance cases, 22 playback cases, six compound-selection cases,
  actual back/forward restoration, and all eleven object smoke tests.
- Fresh readback-free timing diagnostics: five captures over four scenarios,
  run serially after the browser suite, with freshly reconstructed input pairs.
  All reach rest with zero active motion; all five provenance checks pass.
- Exact calibration source, 59 native upload bindings and 34 regenerated tiles
  were verified for the pilot; decoded source SHA-256:
  `b266eedc321311c3eaed81fbf2c23bde9af6d5cb04547fad43dc78bb35bb5efb`.

These are observed full-orientation errors, not an acceptance tolerance. The
maximum uses the union of the two observed clocks, holding only past samples;
input delivery lag remains included and reported separately.

| Scenario | Maximum error | Resting error | Maximum input lag |
| --- | --- | --- | --- |
| Drag replaces coast, repeat 1 | 18.556 degrees | 1.980 degrees | 15.887 ms |
| Drag replaces coast, repeat 2 | 18.556 degrees | 3.550 degrees | 16.740 ms |
| Click stops coast | 16.032 degrees | 0.672 degrees | 9.560 ms |
| Drag interrupts flight, corrected release | 10.140 degrees | 6.697 degrees | 14.953 ms |
| Repeated double-click | 0.702 degrees | 0.251 degrees | 4.692 ms |

The interrupted-flight reference trace SHA-256 is
`7dd4adae6a8f87be2b6a78617f6e82976c28d0266aff4ae258dcdb2e5d066fb5`.
The same retained trace was used before and after correcting its paired inputs;
there was no new native recording or camera-pose replay.

Local execution logs and reports are under
`output/review/interaction-wrap/` and
`output/playwright/pr2-review-motion-only/` in the review worktree. Generated
recordings, native binaries, recovered source, and source asset banks are not
part of the commit.

The intended delivery is a small additive PR2 follow-up, not a replacement of
its runtime refactor. Full independent-clock parity remains unproven; this
review does not raise a tolerance or claim that remaining drift is unavoidable.
