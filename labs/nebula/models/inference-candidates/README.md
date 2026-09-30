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

The [catalogue](catalogue.json) binds these recipes to a downloaded six-object [CDS SIMBAD](https://simbad.cds.unistra.fr/simbad/sim-tap) subset, with its original response retained. SIMBAD's M8 and NGC 6357 entries identify open clusters; the source pictures show their surrounding nebular complexes. Catalogue centres identify objects; each image's AVM WCS supplies its own registration.

## Sources and processing

The batch uses **unchanged ESO Publication TIFF 4K downloads**, with every image's full footprint preserved. These are provider-generated publication variants, not the highest-resolution masters or calibrated flux maps. Each recipe pins the downloaded bytes and dimensions and retains the master URL.

1. Download and verify both pinned source images.
2. Register their stars in the common sky frame, holding out independent stars and requiring the same residual and spatial-coverage gates across the area both images observe.
3. Run NOX once on each complete downloaded grid; keep original, starless and residual images.
4. Extract multiscale structure and fit the combined relative-luminosity target with an explicitly unmeasured depth prior.
5. Bake one field, identical neutral opacity for both image datasets, and conditional compact lights.
6. Validate all output resources and expose the result in the lab.

Sources have different wavelengths, stretches and depths of coverage. Missing optical coverage must not be stretched into the wider infrared view. Compact lights are image detections with modeled depth, not established members. A positive-emission fit cannot recover obscuring dust or reflection physics; M78 and Horsehead make those limits visible.

## First processing result · 2026-09-12

**Five completed experiments, one registration impasse. Visual acceptance is open for all five.** Each completed object has two datasets on shared opacity and geometry and 650 conditional compact lights. All depths are unconstrained by measured velocities.

| Target | Matched stars | Held-out RMS, frame pixels | Emission components | Unassigned display signal |
| --- | ---: | ---: | ---: | ---: |
| M42 | 1,796 | 0.073 | 156 | 10.4% |
| M8 | 838 | 0.152 | 135 | 18.2% |
| Carina | 425 | 0.131 | 155 | 27.1% |
| NGC 6357 | 60 | 0.098 | 158 | 20.9% |
| Horsehead environment | 253 | 0.090 | 158 | 6.3% |
| M78 | 99 | 0.984 (failed) | Not baked | Not fitted |

These numbers describe registration and normalized image fitting, not shape accuracy. M78's maximum held-out error is 5.63 pixels, above the 1.5-pixel limit. Its two originals remain inspectable at **publisher-only** placement in Alignment; no starless output or volume is certified.

Browser inspection shows real deficiencies:

- **Source separation:** residual saturated stars and halos become broad emission components, especially in wide infrared fields.
- **Coverage:** optical M42 and Carina cover less sky than VISTA; missing color stays neutral with visible straight boundaries. NGC 6357's DSS context includes unrelated surrounding structures.
- **Detail and depth:** the fitted neutral field is too diffuse for some filaments, and image-only depth produces elongated cloudy forms. Oblique color projection streaks remain visible.
- **Physics:** the dark Horsehead silhouette is not reconstructed absorbing material. Reflection in M78 needs a different forward model.

Next: isolate target emission and stellar halos **without cropping original inputs**, improve continuous-field color integration, and test extinction and scattering separately from positive emission. Revisit M78 with stronger star descriptors or catalogue registration, rather than trimming failed holdout points.

The [Orion](../m42/README.md) and [Carina](../carina/README.md) records replace global deep columns with locally tilted finite supports. Downloaded spectroscopy is not yet fitted, and residual chromatic banding keeps visual acceptance open. See [Nebula Compiler Process Guidelines](../../docs/nebula-compiler-guidelines.md) for the reusable intake and next physical constraints.

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

The command reuses matching caches and continues past an individual failure, but exits unsuccessfully if any candidate fails; **the six-object batch is expected to report M78's registration failure**. `CANDIDATE_BATCH_COMPLETE` reports the completed count, and a receipt under `.local/nebula-lab/candidate-runs` records every outcome. `--alignment-only` stops before star removal; `--object=m42` selects one target. Neither changes registration tolerances.

All originals, removal products and baked textures stay in ignored `.local/`. Local result pointers under `compiler-published` let a clean browser load the offline results; they publish nothing outside the machine. Saved browser edits take precedence, and changed pinned inputs require another compile.

Open [Orion alignment](http://127.0.0.1:4331/alignment?subject=m42) or [Orion reconstruction](http://127.0.0.1:4331/reconstruction?subject=m42&inspection=compiler), then select another object. Compare Original, Without stars and Residual first, then neutral, optical, infrared, Earth and oblique views. Numerical image agreement does not establish a correct 3D shape.
