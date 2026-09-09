# Continue from here

Updated 2026-09-10. Research sources and unimplemented methods are in [RESEARCH.md](RESEARCH.md). The current reproducible pipeline is in [METHOD.md](METHOD.md).

## Current handoff: LMC into the extragalactic app

1. Keep lab work committed on `work/nebula-live-session`; preserve the live lab and all local source/removal/result caches.
2. Work on `feat/local-group`, currently in the separate `cssEarth-main-sync` checkout. Fetch and merge current main there, resolving conflicts without dropping existing extragalactic catalogues or navigation.
3. Capture the user's actual saved UI values for **Horálek optical, NASA WISE and ESO VISTA**. Include material appearance, cloud cutoff/softness, live brightness/axis balance, component selection and catalogue star visibility/exposure/size. Automated test previews are not user choices. Record any draft-versus-applied difference explicitly.
4. Pin each selected native removal result, registration/placement, density/stars, appearance and inspection settings. Generate three reproducible LMC lenses using the same geometry and star realization.
5. Integrate the lenses into the app's existing object/sidebar mechanism and shared world renderer. Do not introduce a separate LMC page owner or runtime image processing. Preserve existing M31 and SMC renderings and the other extragalactic objects.
6. Verify actual LMC world placement, orientation, scale, lens switching and retained camera. Verify stars and labels in context and byte preservation for untouched M31/SMC sources. Open the resulting local app for the user.

## Next experiment: reconstruct a cloud without a simulation

This is proposed research, not an implemented feature or an instruction to launch a large job now.

1. Read the Wenger 2012 method and 2013 follow-up in full. Check available code and licensing before reuse. Record exact algorithmic assumptions; do not infer them from an abstract.
2. Choose **one** roughly symmetric planetary nebula with a high-quality, sufficiently wide observation and published morphology/distance. A shell or bipolar example is a better first test than Orion/Tarantula.
3. Acquire original imagery, calibration/WCS, credits and any useful spectra/kinematic model. Pin original bytes and preserve source coverage. Remove catalogue stars separately and inspect removal around real nebular knots.
4. Build a small offline emitting-volume fit with explicit symmetry/inclination/depth assumptions. Fit the source-facing projection, then inspect front, oblique and side views. Do not start with a new general reconstruction framework.
5. Success: recognisable connected structure in oblique views, reasonable image agreement, no photograph-shaped extrusion, explicit ambiguity and a bounded reproducible bake. Limit the first prototype to one baseline and at most two adjustment rounds; stop and document the owning limitation if the direction fails.
6. Only after that visual decision, adapt the volume to the existing prepared-object/baking contract and add more object classes. Catalogue star depths and volume inference remain distinct.

## Separate follow-ups

- **Slice stability:** address sampling/compositing at its owning layer. Keep measured handoff thresholds fixed; global dimming or per-image color tuning must not disguise geometry artifacts.
- **Tarantula detail:** use a registered local high-resolution observation and investigate a connected depth model. Preserve LMC-scale context; avoid replicating the same knot across every depth slice.
- **Orion/irregular dust:** check independent distance/extinction and spectral constraints first. Symmetry-based planetary-nebula assumptions are not automatically appropriate.
- **Quality and delivery:** measure native-to-delivery detail loss, payload, retained element count and frame time before increasing resolution or layer count.

## Do not lose these boundaries

- The currently accepted shape reference is the exact Alignment density cloud. Older photo-derived benchmarks are historical experiments.
- Source registration and the image-to-simulation visual fit are different; preserve both.
- Candidate photos change the material, not the star catalogue or the model's extent.
- A plausible volume is not a measured gas-density reconstruction. Record priors and uncertainty.
- Keep processing explicit and server-owned; preserve refresh, progress and cancellation behavior.
- Keep local artifacts local. Production/public promotion requires its own explicit scope.

## Handoff checkpoint

- Lab research, controls export and offline volume-lens promotion are committed on the lab branch. The extragalactic branch has merged main and includes those commits.
- The generic runtime and focused sidebar support a fixed bank of image lenses, one retained catalogue point layer, per-lens appearance and a star toggle.
- The isolated handoff check contains all three sources: 144 selected slices and 943 shared stars each. Output hashes, identical density alpha, distinct image colors, and matched cloud/star cutoff were verified. A real Chrome check verified retained nodes, lens switching, star visibility and distant-point fade. These are **automated fixture settings**, not accepted user values.
- **Still pending:** the user must click Save lens settings in their Reconstruction browser. Resolve their saved result IDs and settings, preview unapplied material drafts if requested, create the production LMC recipe, promote the three lenses, and check them in the shared app. The app still uses the earlier LMC image bank until that installation. M31/SMC and catalogue data remain unchanged.
- Existing XYZ slice stability limitations remain documented; the new bank loader does not solve them.
- Final implementation checks: lab suite 153/153, focused sidebar/navigation suite 64/64, volume lens tests and real Chrome fixture passed; the shared site built all 408 pages. Broader renderer/shell suites are not clean: this checkout needed its pinned object JSON restored, and existing planetary depth/paging/profile fixtures and missing source originals still need separate triage. Do not report the whole repository test suite as passing.
