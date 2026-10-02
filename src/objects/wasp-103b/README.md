# WASP-103 b

The Temperature dataset explores a published **climate simulation**, with seven pressure levels on one 0–3,900 K color scale. Lower pressure means higher atmosphere. This is the model's gas temperature, not an observed brightness-temperature map or a photograph.

## Source and processing

[Kreidberg et al. (2018), AJ 156, 17](https://arxiv.org/abs/1805.00029), section 6, describes the SPARC/MITgcm calculations. The selected [numeric table](https://github.com/lkreidberg/2017_wasp103/blob/425f2e8fe694760266398257a71eaa991ab322fd/Figures/GCM_From_Vivien/PTprofiles-WASP-103b-TiO-fix-3-Drag3-NEW-OPA-nit-1036800.dat) contains 64 longitudes × 30 latitudes × 53 pressure levels. We retain the original bytes through the [acquisition recipe](source/preparation/acquisition.json).

Columns 2–5 are longitude in degrees, latitude in degrees, pressure in bar and temperature in kelvin. Longitude zero is the substellar meridian; east is positive. The [authors' plotting code](https://github.com/lkreidberg/2017_wasp103/blob/425f2e8fe694760266398257a71eaa991ab322fd/Figures/fig7_model_comparison.py) selects this file at 0.11542 bar for the GCM panel of published Figure 8. Despite the `Drag3` filename, the paper describes that comparison as the 10⁴ s drag model. Its 923.14–3,359.4 K range agrees with section 6's rounded 920–3,360 K and section 6.1's 3,359 K reference.

The shared [table reader](../../../packages/bake/src/objects/raster/lonlat-slice-table.ts) selects exact native pressure levels, verifies a complete periodic grid and interpolates temperature between the released geographic coordinates. It does no vertical interpolation, model fitting or figure digitization. The [raster recipe](source/preparation/raster.json) then applies one false-color palette and prepares lossless textures, pole tiles, minimaps and the default navigation marker. Its simulation metadata produces the shared **Simulation** qualification rather than observational imagery status. Runtime uses the shared retained scene and dataset-step control, starting paused at the selected pressure.

Selected pressures are 0.00011051, 0.00088933, 0.010131, 0.11542, 0.92882, 10.581 and 85.152 bar. Display labels round those values; the default is 0.11542 bar. The table stops at ±81.562° latitude. Grey polar caps show that missing coverage; no temperatures are extrapolated.

## Geometry and limits

The simulation solves on a sphere. We preserve that geometry, scaled to Gillon et al. (2014)'s 1.528 Jupiter-radius transit size. Its mass and orbit are preserved in the [astronomy record](../../../packages/astronomy/data/bodies/wasp-103b.json); synchronous rotation is the model assumption. The separate [CHEOPS tidal-deformation inference](https://arxiv.org/abs/2201.03328) is not the geometry of this GCM.

The paper's nominal assumptions include solar composition, cloud-free gas and TiO/VO opacity, with Rayleigh drag in the selected comparison. The simulation does not uniquely reproduce the observations: section 6 describes a nightside that is too cold. The pressure slider explores this published model, including levels outside the observations' sensitive range. It is not a time sequence or a set of independently observed atmospheric layers.

## Evidence

The [reader tests](../../../site/test/lonlat-slice-table.test.mts) check all 1,920 native nodes of the reference slice, the paper's independent temperature anchors, coordinate interpolation, the longitude seam, missing polar coverage and rejection of malformed grids.

The browser record identifies the tested revision, camera and limits. The inspected desktop globe and phone controls show the reference level. All seven levels were selected in both directions while the same 457 prepared globe nodes remained mounted. The phone view at 390 × 844 CSS pixels had no horizontal overflow. This establishes rendering and interaction behavior, not observational agreement or a performance benchmark.

Focused checks passed: six numeric-reader/qualification and step-validation tests, seven shared playback tests, five discovery tests, six scene-lifecycle tests, five package-consistency checks and the 1,865-case runtime-package suite. Bake, objects, renderer, preparation and shell typechecks passed. Package validation checked both new inventories and source coverage; the source-restoration check passed. The runtime suite and playback results precede the final catalogue qualification and remain applicable because the runtime and texture bytes are unchanged. The final reader, discovery and type checks were rerun after that change. Full application build and all-project suites were left to CI.

[Investigated alternatives](investigations.json) · [Inputs](source/manifest.json) · [Credits](NOTICE.md) · [Delivered files](inventory.json)
