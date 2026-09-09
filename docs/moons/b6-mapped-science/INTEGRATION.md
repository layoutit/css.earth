# Main integration after the B6 captures

Integrated main `eecf9d5879433ed6398529274670a0ef73d47b04` (PRs #73–#75) into
the B6 branch after the original browser captures. PR #75 added three comets
and refreshed marker-atlas references. Its generated references conflicted with
the new B6 prepared transports for Europa, Callisto and Charon.

The resolution preserves both changes: all six scientific datasets from B6,
and main's `heliocentricView.bodyMarker` and `systemMarkers` fields. The resulting
three transport hashes were recomputed with the existing serializer. The Moon
had no overlap. [Resolved field record](integration/merge.json).

All four scene files and retained runtime trees still match current main.
Every scientific input and runtime asset retains its original B6 bytes. The PR
adds no renderer, site, camera or navigation code changes relative to main.

The new overview component in main also exposed a checker false positive:
native Node imports in Astro frontmatter were treated as browser dependencies.
The audit now identifies imports in the compiler's actual frontmatter AST and
excludes only native server builtins from browser dependency traversal. The same
imports inside a client script or a client module still fail. Shell expressions,
relative source imports and ownership checks continue to be inspected.

| Combined-tree check | Result |
| --- | --- |
| Affected body, source/runtime closure, preparation and router tests | [100 passed](integration/b6-integrated-tests.log) |
| Four generic object packages and shared runtime ownership | [Passed](integration/packages.json) |
| Astro server/client ownership regression and existing shell AST checks | [3 passed](integration/b6-astro-audit-regression.log) |
| Shared packages, renderer including declarations, preparation build | [Packages](integration/b6-integrated-build-packages.log), [renderer](integration/b6-integrated-build-renderer.log), [preparation](integration/b6-integrated-build-preparation.log): passed |
| Four JSON transport pins | Existing restoration tool reports four reused, zero writes |

The broader ownership test file was attempted but could not qualify its full
registry cases: this selected checkout lacks prepared JSON transports for
objects outside the four-moon cohort. The final focused Astro checks and all
four real package audits pass. No full-registry pass is claimed.

The [visual review](VISUAL-REVIEW.md) retains its original capture base and
hashes. Scientific pixels are unchanged, but the shared shell and marker atlas
changed upstream, so those screenshots do not qualify the integrated UI.
Integrated browser captures, the full production build, the aggregate suite,
full-registry ownership and all-object source/browser gates remain pending.
The PR stays in draft.

## Follow-up after merge

PR #76 merged at `34da5b07` on 2026-09-09. The B7 branch rechecked the four B6 bodies on that main: 17 DPR1 view/lighting cases passed and six scientific views were visually inspected. The [current-main evidence](../b7-cassini-atlas/evidence/b6-current-main/index.json) closes this selected DPR1 rendering gap. Public Settings access remains blocked because current main hides its button; the harness exercised existing hidden bindings and records that limitation. Full-registry and deployment readiness are not inferred from these captures.
