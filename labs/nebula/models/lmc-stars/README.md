# Published LMC massive stars

Measured angular positions and Johnson V photometry from [Bonanos et al. (2009), AJ 138, 1003](https://arxiv.org/abs/0905.1328), [CDS/VizieR J/AJ/138/1003](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/138/1003). Original fixed-width tables, their byte pins, and the original column description are retained in `source/`.

The publication compiles 1,750 massive LMC stars with literature spectral classifications. Table 3 has 1,268 counterparts with optical/infrared photometry. Preparation selects finite published Johnson V ≤ 16 inside the native SMASH footprint. This incomplete massive-star sample provides named LMC stars, rather than arbitrary points or a foreground field. The separate OGLE V column is not substituted for missing Johnson V.

J2000 angular positions are held fixed at the lab epoch: the catalogue does not provide motion propagation here. Individual distances are unmeasured. Preparation reconstructs the exact coherent, extended-channel cloud sampler from its pinned photograph, decomposition recipe and observer-ray stellar prior. It samples each star's depth from the **joint cloud emission × full stellar density** along that star's measured ray. For calibrated tangent coordinates `(x0,y0)`, each proposed depth maps to `(x,y,z)=(x0*(1+z/D),y0*(1+z/D),z)`.

The conditional weight is `maxRGB(cloud emission) × decoded stellar density × (1+z/D)^2`; the last term is the solid-angle volume factor. A fixed SHA-256 source-ID quantile samples a piecewise-linear CDF over 1,536 depth intervals. Every chosen point is checked against the actual positive cloud emission and stellar density, including an explicit guard against interpolating through a zero-support gap. There is no plane, invented thickness, jitter or fallback point. All 943 selected sightlines have valid joint support; none is excluded in this pinned preparation. This is a **cloud-contained display realization**, not a recovered stellar distance or evidence that a particular real star belongs to a particular emitting structure.

Each point also contains its actual positive-emission part IDs and the normalized projected cloud signal from the same pinned, orientation-corrected target used by the cloud cutoff tool. These prepared values let the viewer hide or attenuate stars consistently when their supporting parts or projected cloud signal are removed. The source stars and density remain unchanged. No authored photo alignment or 3× scale is applied.

Colors approximate the published B−V through the existing catalogue display-color conversion, without extinction correction; missing B uses white. CSS point size and opacity use an authored magnitude response, not measured stellar diameters or calibrated flux. Source classifications do not guarantee every individual historical membership assignment. No new license assertion is made for the scientific catalogue; retain author and CDS credit.

From the repository root:

```sh
pnpm install
python3 labs/nebula/src/acquire-lmc-stars.py
node --experimental-strip-types labs/nebula/src/run.ts prepare-lmc-stars
node --experimental-strip-types labs/nebula/src/run.ts test lmc-stars
```

The runtime only projects prepared XYZ and displays retained CSS points. The viewer applies its shared east-left presentation once and controls this independent layer's visibility and opacity.
