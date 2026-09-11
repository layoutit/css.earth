# Continue from here

Updated 2026-09-11. Research sources and method status are in [RESEARCH.md](RESEARCH.md). The current reproducible pipeline is in [METHOD.md](METHOD.md).

**Active next decision:** inspect and filter the 2D structure candidates from the three aligned ESO Helix observations. Mark useful, uncertain and rejected evidence, and compare suspicious compact features with Original / Without stars / Residual in **Alignment**. The user authorized this stage on 2026-09-11. The [compiler notes](docs/nebula-compiler.md) separate the current observation stage from the historical cropped Hubble benchmark and describe the later physics constraints. No new volume is accepted or fitted by reviewing candidates.

**M2–9 baseline:** the [image-to-volume experiment](models/m2-9/README.md) remains available. Front/oblique/side views show connected lobes, with remaining ring artifacts, background and color/brightness differences. It is not promoted; see [planetary-nebulae.md](docs/planetary-nebulae.md).

**Helix comparison:** [two completed trial recipes](models/helix/README.md) share one full-native Hubble/CTIO image and NOX separation. One-axis fitting fails from the side; the published-diameter/orientation disk/ring prior gives distinct components but is oversimplified and omits outer signal. Neither passes visual acceptance. Next, constrain the component thicknesses and halo or test a joint component fit; higher image resolution alone cannot fix the current depth assumptions.

## Completed handoff: LMC into the extragalactic app

1. Keep lab work committed on `work/nebula-live-session`; preserve the live lab and all local source/removal/result caches.
2. Work on `feat/local-group`, currently in the separate `cssEarth-main-sync` checkout. Fetch and merge current main there, resolving conflicts without dropping existing extragalactic catalogues or navigation.
3. Capture the user's actual saved UI values for **Horálek optical, NASA WISE and ESO VISTA**. Include material appearance, cloud cutoff/softness, live brightness/axis balance, component selection and catalogue star visibility/exposure/size. Automated test previews are not user choices. Record any draft-versus-applied difference explicitly.
4. Pin each selected native removal result, registration/placement, density/stars, appearance and inspection settings. Generate three reproducible LMC lenses using the same geometry and star realization.
5. Integrate the lenses into the app's existing object/sidebar mechanism and shared world renderer. Do not introduce a separate LMC page owner or runtime image processing. Preserve existing M31 and SMC renderings and the other extragalactic objects.
6. Verify actual LMC world placement, orientation, scale, lens switching and retained camera. Verify stars and labels in context and byte preservation for untouched M31/SMC sources. Open the resulting local app for the user.

## Next experiment: reconstruct a cloud without a simulation

The checklist below records the research path. A small M2–9 baseline now covers the 2013 method, explicit assumptions and a first XYZ bake; it is not a production feature or authorization for large jobs.

1. Read the Wenger 2012 method and 2013 follow-up in full. Check available code and licensing before reuse. Record exact algorithmic assumptions; do not infer them from an abstract.
2. Choose **one** roughly symmetric planetary nebula with a high-quality, sufficiently wide observation and published morphology/distance. A shell or bipolar example is a better first test than Orion/Tarantula.
3. Acquire original imagery, calibration/WCS, credits and any useful spectra/kinematic model. Pin original bytes and preserve source coverage. Remove catalogue stars separately and inspect removal around real nebular knots.
4. Build a small offline emitting-volume fit with explicit symmetry/inclination/depth assumptions. Fit the source-facing projection, then inspect front, oblique and side views. Do not start with a new general reconstruction framework.
5. Success: recognisable connected structure in oblique views, reasonable image agreement, no photograph-shaped extrusion, explicit ambiguity and a bounded reproducible bake. Limit the first prototype to one baseline and at most two adjustment rounds; stop and document the owning limitation if the direction fails.
6. Only after that visual decision, adapt the volume to the existing prepared-object/baking contract and add more object classes. Catalogue star depths and volume inference remain distinct.

## Separate follow-ups

- **LMC registration and sky handoff (first):** [the scale audit](docs/lmc-scale-audit.md) identifies the inherited 2.8 kpc simulation offset, orientation differences, unmatched display brightness and panorama depth. Projection math passes. Register against observations before changing physical size.

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
- **User handoff received:** one Save lens settings click at `2026-09-09T23:12:20.083Z` exported all persisted images. VISTA comes from the active displayed result; Horálek from the saved completed personal job; WISE from its saved applied density context (no newer personal appearance/job). The active density draft equals the applied filter. Exact recipe and selection evidence are stored in `models/lmc/app-lenses.json` and `models/lmc/app-lens-settings.json`.
- **Installed:** the app LMC descriptor now selects the three prepared volume lenses. Each has the same 144 slices and 943 star positions; geometry, every alpha byte, star presentation and output hashes were checked. Colors remain different per image. Total promoted bank plus provenance is about 3.88 MB. Old LMC prepared slabs are superseded; their source/provenance and current M31/SMC/catalogues remain unchanged.
- Existing XYZ slice stability limitations remain documented; the new bank loader does not solve them.
- Final implementation checks: lab suite 153/153, focused sidebar/navigation suite 64/64, volume lens tests and real Chrome fixture passed; the shared site built all 408 pages. Broader renderer/shell suites are not clean: this checkout needed its pinned object JSON restored, and existing planetary depth/paging/profile fixtures and missing source originals still need separate triage. Do not report the whole repository test suite as passing.
- Latest-main follow-up: merged navigation optimization PR #50; 98 renderer and 95 focused shell checks passed, and the updated build produced 814 pages including navigation responses. The synced extragalactic checkout now serves localhost:4210. Restored 2,617 hash-verified scene assets for the previously available 16 bodies; Chrome verified Sun plus shared-universe readiness with no errors. Lab remains on 4331. The received browser settings have now been promoted into the LMC descriptor; the final app check is recorded below.


## Installed app verification

The actual app at `http://127.0.0.1:4210` loads the LMC volume bank in the existing Sun/shared-world owner. The useful framed URL is recorded in the local browser report at `.local/nebula-lab/volume-lens-browser/app-report.json` in the extragalactic checkout.

- Three front and three oblique views inspected. Switching keeps the 1,296 cloud DOM nodes (renderer composites), 943 catalogue nodes, sidebar buttons, world pose and camera token. No additional LMC resources are requested during switches.
- Catalogue stars toggle without recreating points; unresolved points fade away. A saved WISE focus/camera URL restores WISE and the same world pose; a link without a lens choice selects VISTA.
- Fixed two integration defects found in the real app: the planet control binder now queries its own information panel, and the star switch reuses the visible shared switch styling outside the settings drawer.
- Actual-browser flow has no script or HTTP errors. The 414 affected object-control checks, 16 LMC/focus/source checks and 814-page site build passed. The ownership regression fails when its scope fix is removed.
- Checked source hashes and preserved M31, SMC, Local Group and cluster bytes. The live lab remains available on 4331. No native image processing was repeated for this promotion.
- This verifies installation and interaction; existing oblique whitening/banding in the lab’s slice representation remains unresolved research, not a newly passed stability gate.
