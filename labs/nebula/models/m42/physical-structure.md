# Orion: structure and velocity evidence

Research intake: 12 September 2026. The image-only baseline at `6b589ae09` has no Orion spectroscopy or physical scaffold. This note records evidence and the next experiment; it does not claim that these constraints already drive the compiler.

## Why the current depth fails

Without a scaffold, the compiler centers every emission component at zero depth and gives even small projected features a substantial common minimum depth. The color sampler repeats the same image coordinates along that depth. A recognizable observer projection therefore becomes a smeared extrusion from the side. More texture resolution or sharpening cannot establish the missing geometry.

The compact-star brightness defect is independent: the baseline normalized peaks, whitened colors, imposed an opacity floor and drew fixed screen-size disks. That must be corrected using source-relative display light and angular footprints, independently of any new depth hypothesis. Image-detected stars still have unmeasured model-assigned depths and uncertain membership.

## Primary evidence to use

| Source | What it constrains | How to use it |
|---|---|---|
| [Wen & O’Dell 1995, *A Three-Dimensional Model of the Orion Nebula*](https://doi.org/10.1086/175123); [O’Dell et al. 2009, full text](https://arxiv.org/html/0810.4375v1) | An irregular main ionization front on the observer-facing side of the molecular cloud; the Bright Bar is nearly edge-on. Orion-S is a distinct embedded molecular feature. | Model an illuminated surface with a finite ionized layer, local folds and a cavity. Do not map all faint image structure onto a single thick central plane. |
| [Henney, Arthur & García-Díaz 2005, photoevaporation models](https://arxiv.org/html/astro-ph/0504221) | Hydrodynamic front/flow models compared with emission measure, density and line velocities. Curvature and viewing inclination influence observables. | Forward-predict gas velocity along the surface normal. A velocity is not a depth coordinate. The paper’s idealized front does not prescribe the entire wide-field nebula. |
| [García-Díaz et al. 2008, optical velocity atlas](https://arxiv.org/abs/0802.0518) | Position–position–velocity spectra of [O I], [S II], [N II], [S III], Hα and [O III], at approximately 3″ × 2″ × 10 km/s resolution. | Separate ionization layers and localized outflows using resolved line components. A spectral cube is not a spatial density cube. |
| [Weilbacher et al. 2015, MUSE](https://arxiv.org/abs/1507.00006); [AIP data release](https://doi.org/10.17876/data/2023_3) | Public WCS-bearing line-flux, extinction, electron-density and velocity maps over approximately 5.9′ × 4.9′ of the Huygens region, sampled at 0.2″. | Start with the compact derived FITS maps. Their footprint covers only the bright core of our approximately 60–90′ images; no extrapolation to the whole cloud. Fine sampling does not imply resolved multiple velocity components. |
| [Pabst et al. 2019, SOFIA [C II]](https://doi.org/10.1038/s41586-018-0844-1) | Velocity-resolved observations over about one square degree at 16″ resolution; interpretation as a wind-swept Veil shell expanding at about 13 km/s. | Constrain the extended neutral/PDR foreground separately from the bright ionized front. This tracer does not supply the emissivity of the optical photograph. |
| [O’Dell & Abel 2025, *Large Scale Wind Driven Structures in the Orion Nebula*](https://arxiv.org/html/2507.02147v1) | Combined [C II], H I, optical and UV interpretation: outer shell/Veil B, an inner shell, and a central high-ionization bubble. Reported expansion values are 15 km/s maximum for the outer shell and 27 km/s for the inner shell. | Keep component-specific motion hypotheses. This study challenges the simple limb-brightened outer-shell interpretation; retain that alternative rather than treating one hemisphere as measured truth. |

The 2009 ionization-front reconstruction infers star-to-front distance from illumination, density and Hα brightness under stated assumptions. Its cited approximately 0.2 pc star/front separation and approximately 0.1 pc constant-density emitting-layer thickness are local model scales, not uniform dimensions for our photograph. Its adopted distance is 440 pc. Preserve original distance assumptions before rescaling physical sizes.

The [2020 Huygens-shell study](https://arxiv.org/html/2003.01840v1) gives distinct photoevaporation estimates for [N II] and [O III] (7 ± 4 and 12 ± 4 km/s), and a nearer ionized layer at about 0.4 pc from the main ionizing star. These are component/model-dependent quantities. Its central bubble and foreground layer must not be confused with the much larger Veil shell.

## Coordinate and measurement rules

The [physical source manifest](physical-sources.json) pins seven downloaded MUSE maps by URL, SHA-256 and byte count, with inspected FITS metadata. These files supply **no per-pixel uncertainty or quality-mask extensions**. Exact zeros, nonfinite values, density sentinels and velocity outliers require a documented validity policy. Six maps contain celestial WCS; the Hα flux map does not. Some physical units/normalizations must be recovered from the publication before numerical fitting. The files are research inputs, not ready-made density constraints.

The wider [Higgins et al. SOFIA release](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/652/A77) is accessible: a 3.63 GB position–position–velocity FITS cube covering about 1.15 square degrees of Orion A. Only its header has been retrieved and verified so far. The released cube has an 18″ beam, 3.525″ pixels and 0.3 km/s channels in the LSRK frame; the manifest distinguishes that header hash from a full-file hash. Full voxel/noise qualification remains outstanding.

The García-Díaz author-hosted atlas endpoint was inaccessible during this intake. The [Kreckel et al. 2024 LVM early-science field](https://arxiv.org/abs/2405.14943) covers Orion B/Belt objects and excludes M42; keep it as a Horsehead/Flame lead, not an Orion A replacement.

- Register FITS celestial WCS to the same ICRS/tangent plane as the optical and VISTA inputs; retain native footprint, beam, pixel scale and masks.
- Retain the line, velocity reference frame, uncertainty and instrumental resolution. MUSE’s published velocity maps are barycentric; the optical papers above often use heliocentric velocities, while radio work often uses LSR. The 2025 study states an 18.1 km/s LSR-to-heliocentric offset for its Orion data; this is not a global conversion constant.
- Compare observed line emission to the corresponding modeled component. Broadband RGB, molecular/PDR emission and recombination-line surface brightness are different observables.
- Electron density inferred from a line ratio is local diagnostic information, not a line-of-sight distance or total column. Extinction adds ordering constraints; it does not uniquely determine the missing volume.
- Keep foreground/back-scattered velocity components distinct from direct emission. Do not assign all velocity differences to radial expansion.

## Recommended next experiment

1. Overlay the spectroscopic footprints and line maps on the existing aligned images. Verify astrometry and identify valid signal before fitting.
2. Fit a shallow, spatially varying ionization-front surface in the covered core, with a separately parameterized thickness and photoevaporative flow. Add distinct foreground shell/cavity hypotheses using the literature. Leave uncovered depths explicitly unconstrained.
3. Forward-project each hypothesis into the actual measurements: line brightness, line-of-sight velocity and extinction where available. Withhold spatial regions or complete slit positions; compare against the current centered-depth baseline without loosening gates.
4. Condition small-scale emission on those surfaces and components. Texture/color remains an independent lens. Include an absorption/scattering model before interpreting dark lanes or reflection-dominated outskirts as recovered density.
5. Inspect the same observer projection, sides and intermediate rotations with shared stars, stable light and explicit missing coverage. Better front-image agreement alone cannot qualify the 3D model.

Success means improved agreement with independent physical observations and a coherent rotating volume. It does not mean a uniquely recovered Orion gas distribution. Do not replace the current model with an arbitrary thinner extrusion and call the geometry solved.
