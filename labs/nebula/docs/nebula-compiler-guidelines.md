# Nebula Compiler Process Guidelines

Choose and combine methods from the available evidence. The lab is one reusable pipeline; object recipes supply observations, physical constraints and declared assumptions. A shell is one possible component, not the default geometry of every nebula. This guide is the maintained intake protocol; [METHOD](../METHOD.md) describes processing and [the literature assessment](novelty-assessment.md) records precedents and unresolved novelty claims.

Working name: **Evidence-Guided Nebula Reconstruction**. Alternatives: **Constraint-Based Nebula Reconstruction** or **Nebula Compilation Workflow**. The name describes a reproducible workflow; it does not assert a novel reconstruction algorithm.

## Select the physical problem

| Evidence / object | Useful method | What stays unknown | Current lab owner / precedent |
| --- | --- | --- | --- |
| Independent particle or volume model | Preserve its support; paint registered image material | Whether simulated stars trace actual gas/dust | LMC density method; [research](../RESEARCH.md) |
| Demonstrable axial symmetry | Joint emission/orientation fit under the declared symmetry | Front/back allocation, weakly constrained axis, absorption | M2–9; [Wenger 2012/2013 method](planetary-nebulae.md) |
| Resolved emission lines plus plausible motion law | Forward-project geometry and gas velocity into spectra/PV data | Geometry–velocity degeneracy and unobserved components | Helix [joint fit](joint-fit.md); SHAPE in [precedents](novelty-assessment.md) |
| Ionization front, illuminated molecular surface | Curved finite layer plus local folds/cavities; compare line emission, density and flow | Uncovered surface shape, layer thickness and illumination assumptions | Orion [evidence](../models/m42/physical-evidence.json); Wen & O’Dell / Henney models |
| Filament, pillar, lobe, knot or connected ridge | Connected support or swept/profile component with local thickness | Projected crossings, topology and depth order | Geometry family to implement where needed; 2D ridges alone do not supply 3D paths |
| Dust extinction or reflection dominates | Joint emission, absorption/scattering and illuminating-source model | Grain physics, unseen backlight and foreground ordering | Research extension; Lintu and hybrid methods in [precedents](novelty-assessment.md) |
| Images only, no independent depth | Compare bounded authored hypotheses; preserve morphology and uncertainty | Physical depth and member-star distances | Image-only compiler baseline; no claim of recovered density |

These methods can coexist in one object: an irregular front, separate embedded cloud, filament, local flow and foreground layer need different evidence. Reuse registration, source separation, fit diagnostics and baking. Do not invent a separate application or object-name branch for each combination.

The current compiler supports the image-only prior, a joint velocity scaffold, or one evidence-addressed irregular height surface. The last two are deliberately exclusive until a compatible forward model exists. Multiple overlapping surfaces, absorption, scattering and general swept filaments are extensions, not completed processing layers. Orion and Carina currently exercise the single-front method; their downloaded spectroscopy remains research input.

## Agent-assisted evidence intake

1. **Bound the target.** Name the object/region, sky frame, full image footprints and intended output. Separate a small named structure from its host complex. Keep the live lab and completed caches intact.
2. **Search primary material.** Find original papers and data releases for morphology, spectral cubes/slits, extinction, density/temperature diagnostics, distances/parallaxes, proper motions, magnetic fields and simulations. Start with the most relevant coverage; do not accumulate papers without a usable constraint. Preserve alternatives and newer revisions.
3. **Acquire the smallest useful product.** Prefer released maps/catalogues over enormous raw cubes for an initial experiment. Record publisher/product/version, URL/DOI, rights, exact downloaded hash/bytes, native dimensions, units, WCS/epoch, beam/PSF, spectral frame/resolution and dates. Header-only, inaccessible and fully downloaded are different statuses.
4. **Qualify the actual data.** Inspect arrays, units, masks, sentinel values, invalid samples and errors. Missing uncertainty stays missing. A sampled pixel is not the instrumental resolution. Register the real footprint onto the image frame before using the values; array dimensions alone cannot establish astrometry.
5. **Write an evidence ledger.** Every constraint has an ID, source IDs, value/unit, uncertainty when supplied, spatial/spectral scope and limitations. Classify it as `observed`, `published-model` or `authored`. A paper-derived shape is still a conditional model. Keep a digitized figure distinct from original measurements and pin its digitization transform.
6. **Write the runnable recipe separately.** Choose supported generic methods and exact authored parameters, citing evidence IDs and a rationale. Pin ledger/source identities. A number suggested by a paper is not validated outside that paper’s footprint. Record unsupported regions, alternative shapes and the selected distance conversion.
7. **Compile a bounded comparison.** Reuse completed alignment/NOX. Compare with the previous baseline using the same sources, target and display. Inspect observer, oblique and side views; refine only the failing stage. Keep qualitative visual improvement separate from quantitative physical agreement.

Paper reading and recipe assistance can use bounded specialist agents when authorized. They return checked source/coverage records and candidate constraints; they must not silently invent observations, run expensive processing or install object-specific logic into shared algorithms.

## Evidence is not interchangeable

- **Images:** outreach RGB supplies relative appearance, not calibrated gas mass or a common-band flux sum. Different wavelength images from Earth do not provide new camera angles.
- **Spectroscopy:** retain each tracer, resolved component and velocity frame. Forward-model velocities with an explicit physical hypothesis. A velocity channel is not a spatial depth plane; a foreground absorption component is not interchangeable with background line emission.
- **Extinction and diagnostics:** a column or line-ratio density constrains the line of sight under assumptions. It does not uniquely determine a 3D position or total density. Fit the measured observable, not an invented volume derived from its color scale.
- **Distances and motion:** retain epoch, frame, uncertainties and membership. Proper-motion vectors describe identified features at stated epochs; converting angular motion to speed needs a distance. Pattern speed may differ from material speed.
- **Simulations:** retain units, initial conditions, time, particle type and observer transform. A stellar-mass distribution is not gas density. Registration to a simulated realization is an authored correspondence even when both datasets are independently scientific.
- **Morphology:** a detected contour proposes projected structure. Connected ridges, cavities, shells and crossings require explicit 3D interpretation. Enforce shared continuity through the support model, not through brightness-to-depth embossing or a stack of identical photo columns.

## Trace each result

| Record | Must identify |
| --- | --- |
| Source manifest | Immutable products, credit, data meaning, native grids and coverage |
| Physical evidence ledger | Measurements versus published models versus authored choices; citations and uncertainty |
| Runnable depth/fit recipe | Selected methods, evidence IDs, exact numeric settings, local scopes and unsupported assumptions |
| Processing receipt | Source/recipe/ledger/code hashes, actual stages, validity/coverage reports and output identities |
| Model README | What was run, what improved, failed visual/physical gates and next useful constraint |

Shared TypeScript readers must reject unknown methods, dangling evidence/source IDs, nonfinite parameters, invalid units/frames and unsupported operations before processing. Changing an evidence ledger or recipe must invalidate the affected cached fit. Derived textures/maps remain ignored; retain enough source records and configuration to reproduce them.

All image lenses share geometry and alpha. Compact lights preserve the same observed sky coordinates and declared depth assignment. Runtime only decodes prepared results. Keep ingestion, geometric reasoning, image material and renderer concerns independently owned.

Thin surfaces need an explicit rendering check: choose physical slab spacing from the supported feature scale, within the prepared-bank limit. Weight each slab's material color by the same emission sub-samples used for its neutral geometry. Sampling the image only at an empty slab midpoint can create false color bands. This correction changes material preparation, never the cloud support or alpha. Keep finite resolution and source coverage visible in the receipt.

## Bounded acceptance

For the first trial, define the baseline, fixed cameras and a concrete expected improvement. Use targeted checks and at most three fix rounds. A front-image match alone cannot validate depth; compare neutral connectivity, side thickness, feature duplication and lens consistency. Quantitative physical fitting additionally needs qualified inputs, a corresponding forward observable, uncertainty handling and withheld spatial regions or complete pointings.

If the required evidence or forward model is absent, the result remains an authored visualization. Record that limitation and continue with a useful bounded comparison; do not fabricate data or loosen scientific gates to make the result appear accepted. A compiled file, a coherent rotating cloud and a physically validated reconstruction are three distinct outcomes.
