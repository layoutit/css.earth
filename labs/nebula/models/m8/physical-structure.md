# Lagoon physical interpretation

The selected approximation is one irregular emitting front with finite thickness. The local face-on background PDR around Herschel 36 motivates its orientation. The much wider image field still has authored geometry; it is not a measured gas volume. [The ledger](physical-evidence.json) separates observations, published models and authored choices, and [the depth recipe](depth-model.json) pins every executable coefficient.

## Sources studied

Seven complete author PDFs were retrieved, byte-pinned in [physical-sources.json](physical-sources.json), and read for the sections below. Full papers and rendered inspection pages remain in the ignored local cache. Original spectral cubes and LVM row-stacked arrays were not acquired or fitted.

| Primary source | Sections inspected and useful constraint | Limit affecting this model |
|---|---|---|
| [Arias et al. 2006, Hourglass cluster](https://doi.org/10.1111/j.1365-2966.2005.09829.x) | §§3.1, 3.7–3.8: local distance, patchy foreground extinction, HST morphology and HH slit evidence | Weak visible emission can conceal highly obscured material; RGB darkness cannot become empty space. |
| [Barbá & Arias 2007, Geysers](https://doi.org/10.1051/0004-6361:20066081) | §§2–3 and Table 1: continuum-subtracted Hα/[S II] images identify projected outflow candidates | Some spectroscopic confirmations were deferred; these narrow features do not define global expansion. |
| [Wright et al. 2019, NGC 6530 kinematics](https://doi.org/10.1093/mnras/stz870) | §§4–6 and Table 3: selected young stars expand asymmetrically | Stellar velocities and membership selections cannot supply gas depth or a spherical expansion law. |
| [Kahle et al. 2024, molecular clumps](https://doi.org/10.1051/0004-6361/202349009) | §§2, 5.1, 6.2; Tables 2, A.1, C.1: sparse molecular velocities, separate ridges and temperature/SED limits | Multiple EC components may be separate layers; on-off pointings cannot establish their interaction or depth order. |
| [Singh et al. 2026, LVM](https://doi.org/10.3847/1538-4357/ae563a) | §§III, V.4, VI.1–3: full-field line/extinction/density diagnostics and line-specific masks | The 97 MB PDF and figure repository are plotted evidence. Numerical fitting requires original flux, inverse variance, masks, wavelength and fibre positions. |
| [Tiwari et al. 2018, M8 PDR](https://doi.org/10.1051/0004-6361/201732437) | §§2, 3.2, 5.1; Figures 14–15: near-face-on background cloud plus a separate foreground veil around Her 36 | Figure 15 is schematic. The roughly 1.3 pc local field does not constrain the 129′ processing frame. |
| [Tiwari et al. 2020, M8 East](https://doi.org/10.1051/0004-6361/202038886) | §§2, 5.2–5.3, 6: bright ionization front, tracer-dependent structure and YSO distribution | The ≥0.26 km/s front speed is inferred from assumed ages and constant propagation, not measured proper motion. |

## Retained molecular measurements

The 37 entries in `physical-sources.json` transcribe Kahle's Table 2 and Table A.1. Both strongest reported velocity components remain separate. A missing second component and absent velocity uncertainty are `null`, never zero.

The table reports corrected IRAM positions for WC3, SE8 and SC5; their original APEX coordinates remain alongside them. These three use C¹⁸O/C¹⁷O J=1–0, while other entries use J=2–1. Coordinates are J2000 and velocities are in the paper's LSR frame; its precise LSR realization is unspecified. The varying 21–35″ beams cover isolated pointings, not intervening sky. Original Table 2 and Appendix A pages were visually checked, including their coordinate-correction footnote.

These rows are research constraints, not active fit terms. A future gas-velocity fit needs a compatible irregular-gas forward model, uncertainties and spatial validation. Assigning velocity channels directly to depth would invent the missing dynamics.

## Executable hypothesis

- A shallow continuous warp supplies the full-field support. Its gradient, curvature and 160″ characteristic thickness are authored.
- A 105″-radius window around the quoted Her 36 position locally approaches a face-on PDR. Its positive 100″ depth origin and 60″ thickness are authored; the window remains inside the paper's approximate 1.3 pc footprint at its adopted 1250 pc distance.
- An 80″-radius window around the independently quoted M8E-IR position supplies a local deformation. The 150″ depth, slope and 65″ thickness are authored, without using the inferred front speed.
- Positive multiscale supports fit the combined normalized projected light. Their depths follow the smooth surface rather than image intensity. Optical, near-infrared and mid-infrared lenses paint the same geometry and alpha.

The operator has one surface per sightline. It cannot represent a separate absorbing veil, overlapping molecular layers, closed cavities or general swept filaments. Dust scattering, extinction and radiative transfer remain absent. The resulting depth is a bounded visualization hypothesis, and the observer-side projection is the only fitted observable.

## Assessment boundary

Compare front, oblique and both side axes, with fixed framing and all three materials. Look for disconnected copies, thin-sheet banding, disappearing structure and lens-dependent geometry. Native NOX panels must retain diffuse knots while accounting exactly for the compact residual. Projection error measures relative display-light agreement; it cannot validate the depth hypothesis.

The previous two-source image-only Lagoon bake differs in sources and frame, so it is a historical visual baseline only. Its error statistics are not a matched numerical comparison to this three-source result. At most three geometry refinements are allowed; unresolved absorption or overlapping-depth requirements are a method limitation, not a reason to tune exposure until the mismatch disappears.

## Bounded result · 2026-09-13

Three bakes completed: the initial all-source fit, one weighted refinement, and replay of its saved recipe. The final controls are Detail 0.9, Faint emission 0.15 and Depth 1; source weights are optical 1, VISTA 0.15 and Spitzer 0.8. Downweighting the crowded VISTA diffuse residual reduces its contribution to peripheral blobs. These are authored display-reliability weights, without a photometric calibration claim. They do not crop sources or remove a lens. The final 444-support fit follows the same surface recipe; only three supports reach the local paper-guidance threshold.

Front, oblique, north-side and west-side views of every lens were inspected in Chromium. Lens switching retains the shared geometry and compact-light catalogue. Peripheral blobs, a thin curved-layer appearance, slice/grid banding and hard infrared footprint boundaries remain. The native panels retain substantially finer knots and filaments than the baked fit. The lower fit error concerns a differently weighted display target and is not evidence of improved physical depth. [Processing evidence](processing-evidence.json) binds the final result, native accounting, source coverage and browser receipts.
