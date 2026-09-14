# Irregular nebula experiments

Six official-image pairs test the compiler beyond planetary nebulae. They began as **image-only relative-emission experiments**; Orion and Carina now compare an evidence-addressed authored surface. No Helix ring geometry or planetary expansion law is transferred. The unknown depth comes from explicit priors, not new measurements.

| Target | Sources and coverage | What it tests |
| --- | --- | --- |
| [Orion · M42](../m42/README.md) | ESO optical + VISTA, main M42 complex | Bright core, asymmetric cavity, large contrast |
| [Lagoon · M8](../m8/README.md) | ESO optical + VISTA, differing wide footprints | Filaments and partial spectral overlap |
| [Carina](../carina/README.md) | Central optical field + much wider VISTA | Partial optical coverage and complex dust lanes |
| [NGC 6357](../ngc6357/README.md) | Wide DSS2 context + VISTA | Separating target emission from surrounding sky |
| [M78](../m78/README.md) | ESO optical + VISTA | Reflection/scattering that an emission-only model approximates |
| [Horsehead + Flame](../horsehead/README.md) | Wide DSS2 context + VISTA | An absorption failure case: the dark Horsehead is not positive emission |

The [catalogue](catalogue.json) binds these recipes to a downloaded six-object [CDS SIMBAD](https://simbad.cds.unistra.fr/simbad/sim-tap) subset. Its original response, coordinates, classes, bibliography and query are retained. SIMBAD's M8 and NGC 6357 entries identify open clusters; the source pictures show their surrounding nebular complexes. Catalogue centres identify objects; each image's AVM WCS supplies its own registration.

## First processing result · 2026-09-12

**Five completed experiments, one registration impasse. Visual acceptance is open for all five.** Each completed object has two lenses on shared opacity/geometry and 650 conditional compact lights. All depths in these five fields are unconstrained by measured velocities.

| Target | Matched stars | Held-out RMS, frame pixels | Emission components | Unassigned display signal |
| --- | ---: | ---: | ---: | ---: |
| M42 | 1,796 | 0.073 | 156 | 10.4% |
| M8 | 838 | 0.152 | 135 | 18.2% |
| Carina | 425 | 0.131 | 155 | 27.1% |
| NGC 6357 | 60 | 0.098 | 158 | 20.9% |
| Horsehead environment | 253 | 0.090 | 158 | 6.3% |
| M78 | 99 | 0.984 — failed | Not baked | Not fitted |

These numbers describe registration and normalized image fitting, not scientific shape accuracy. M78's maximum held-out error is 5.63 pixels, above the unchanged 1.5-pixel limit. More candidates, higher detection resolution and spatial quotas did not remove false correspondences. Its two downloaded originals remain inspectable at **publisher-only** placement in Alignment; no starless output or volume is certified.

The batch exposed and corrected two shared registration problems: spatial coverage was evaluated outside the common footprint, and a 6,000-brightest-star cap omitted matching optical/infrared constellations. A single 12,000-candidate retry fixes M8 and Horsehead while retaining successful smaller-pool fits. Residual tolerances and independent held-out stars are unchanged.

Browser inspection used Chromium 148.0.7778.96 at 1600×1050, DPR 1, default Detail 65%, Faint 35%, Depth 1×. All five load directly from validated offline receipts; both lenses, retained rotation, original overlay, star toggle and refresh pass without processing requests or script errors. M42 also passed cancelled-refit/refresh preservation. Front and oblique screenshots were inspected; they show real deficiencies:

- **Source separation:** residual saturated stars/halos become broad emission components, especially in wide infrared fields.
- **Coverage:** optical M42/Carina covers less sky than VISTA; missing color remains neutral with visible straight boundaries. NGC 6357's DSS context includes unrelated surrounding structures.
- **Detail and depth:** the fitted neutral field is too diffuse for some filaments, and image-only depth produces elongated cloudy forms. Oblique color projection streaks remain visible.
- **Physics:** Horsehead's surrounding emission can be approximated, but the dark silhouette is not reconstructed absorbing material. Reflection in M78 likewise needs a different forward model.

Next, isolate target-associated emission and residual stellar halos **without cropping original inputs**, improve continuous-field color integration, and test extinction/scattering constraints separately from positive emission. Revisit M78 with stronger independent star descriptors or catalogue registration, rather than trimming failed holdout points. Keep these five as fixed comparison cases during those changes.

Implementation validation: strict lab TypeScript and the lab build pass; the lab test run reports 294 passed, 2 skipped and no failures. All twelve original previews load, with M78 visibly marked unverified and its missing separation controls disabled. These checks cover the lab only; no production suites were run.

Completed result identities, in target order above: `fec6fa781e9ac155b5c53c48469afe7677c365baa818e3d346623883b0ae19b4`, `23abbe9ed2343dee93fd56ab13e5d758eefaefa696c530580371b45bced54f39`, `919868fcfa304c242380dcd6d4c6a1e20fd402e8cd16551f1e5f22cab16d496b`, `ce071ef9a3cd7dc267755f660bdaac0186a28499ef31678c15fd04af942b2fb7`, `fdc0523ce7248132545800b69d8afb6b45207a68e0b4c16db8ed7e04eb6363b2`. Each immutable local result records its exact recipes, compiler implementation hashes and source/evidence identities. Later implementation changes must not silently relabel these results as newly tested.

### Evidence-guided continuation

The newer [Orion](../m42/README.md#coherent-front-comparison--12-september-2026) and [Carina](../carina/README.md#coherent-front-comparison--12-september-2026) records retain their exact result identities, recipe/evidence pins and visual limitations. They replace global deep columns with locally tilted finite supports; Carina tests reuse with its own sky anchors and assumptions. Downloaded spectroscopy is not yet fitted. The other three completed candidates were rebuilt without changing their prior method so their local input/implementation receipts remain usable. M78's existing registration failure remains unchanged.

Final validation: 320 lab tests pass, two are skipped; strict lab TypeScript and the lab build pass. A mutation removing the local tilt fails the regression test. Chromium checks pass for all five completed candidates; Orion/Carina additionally include near-edge-on west and north views. Residual chromatic banding means visual acceptance remains open. See [Nebula Compiler Process Guidelines](../../docs/nebula-compiler-guidelines.md) for the reusable intake and next physical constraints.

## Sources and processing

The first batch uses **unchanged ESO Publication TIFF 4K downloads**, with every image's full footprint preserved. These are provider-generated publication variants, not the highest-resolution masters or calibrated scientific flux maps. Each recipe pins the downloaded bytes and dimensions and retains the master URL/dimensions. Native star removal means the complete downloaded publication grid; it does not mean a 4K image contains the master's angular resolution.

1. Download and verify both pinned source images.
2. Register their stars in the common sky frame. Hold out independent stars; require the same residual and spatial-coverage gates across the area both images observe. Preserve margins outside that overlap.
3. Run NOX once on each complete downloaded grid; retain original, starless and residual images.
4. Extract multiscale structure and fit the combined relative-luminosity target with an explicitly unmeasured depth prior.
5. Bake one field, identical neutral opacity for both image lenses, and conditional compact lights.
6. Validate all output resources, then expose the completed result in the existing lab without starting another job on navigation.

Sources have different wavelengths, stretches and depths of coverage. Missing optical coverage must not be stretched into the wider infrared view. Compact lights are image detections with modeled depth, not established members. A positive-emission fit cannot recover obscuring dust or illumination-dependent reflection physics; M78 and Horsehead deliberately make those limits visible.

## Reproduce the batch

Run from the repository root with Node 22.18+, pnpm and Python 3.9–3.12. Keep an existing lab server alive; the final server command is only for a clean start.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
python3 -m venv .local/open-star-removal/venv
.local/open-star-removal/venv/bin/python -m pip install tensorflow==2.16.2 numpy==1.26.4 opencv-python-headless==4.11.0.86 scipy==1.13.1
curl -fL https://github.com/charvey2718/nox/releases/download/v1.1.0/noxGeneratorColor.pb -o .local/open-star-removal/noxGeneratorColor.pb
node --experimental-strip-types labs/nebula/src/run.ts compile-candidates labs/nebula/models/inference-candidates/catalogue.json
pnpm exec vite --config labs/nebula/vite.config.ts --host 127.0.0.1 --port 4331 --strictPort
```

The command verifies matching caches before reuse and continues to the next object after an individual failure. It exits unsuccessfully if any candidate fails; **the current six-object batch is expected to report M78's registration failure**. `CANDIDATE_BATCH_COMPLETE` reports the actual completed count. A dated receipt under `.local/nebula-lab/candidate-runs` records every outcome. `--alignment-only` stops before new star removal; `--object=m42` selects one configured target. Neither option changes source registration tolerances.

All originals, removal products and baked textures stay in ignored `.local/`. Validated local result pointers under `compiler-published` let a clean browser load the offline results; they do not publish anything outside the machine. Saved browser edits/jobs take precedence. Changed pinned inputs require another compile.

Open [Orion alignment](http://127.0.0.1:4331/alignment?subject=m42) or [Orion reconstruction](http://127.0.0.1:4331/reconstruction?subject=m42&inspection=compiler), then select another object. Compare Original/Without stars/Residual first, followed by neutral, optical, infrared, Earth and oblique views. Numerical image agreement does not establish a correct 3D shape.
