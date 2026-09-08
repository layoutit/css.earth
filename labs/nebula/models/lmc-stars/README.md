# Published LMC massive stars

Measured angular positions and Johnson V photometry from [Bonanos et al. (2009), AJ 138, 1003](https://arxiv.org/abs/0905.1328), [CDS/VizieR J/AJ/138/1003](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/AJ/138/1003). Original fixed-width tables, their byte pins, and the original column description are retained in `source/`.

The publication compiles 1,750 massive LMC stars with literature spectral classifications. Table 3 has 1,268 counterparts with optical/infrared photometry. Preparation selects finite published Johnson V ≤ 16 inside the native SMASH footprint. This incomplete massive-star sample provides named LMC stars, rather than arbitrary points or a foreground field. The separate OGLE V column is not substituted for missing Johnson V.

J2000 angular positions are held fixed at the lab epoch: the catalogue does not provide motion propagation here. Individual distances are unmeasured. Stars follow the **same fitted depth plane as the reconstructed cloud**, pinned through its object and source provenance. For calibrated tangent coordinates `(x0,y0)`, preparation uses `z = interceptKpc + xSlope*x0 + ySlope*y0`, then `(x,y) = (x0,y0)*(1+z/D)`. The stored plane coefficients already include the cloud model's compression. No authored photo alignment or 3× scale is applied: stars remain on their measured Earth rays. This depth assignment is a shared model hypothesis, not measured stellar distance or proof that each star is embedded in a particular emitting cloud structure.

Colors approximate the published B−V through the existing catalogue display-color conversion, without extinction correction; missing B uses white. CSS point size and opacity use an authored magnitude response, not measured stellar diameters or calibrated flux. Source classifications do not guarantee every individual historical membership assignment. No new license assertion is made for the scientific catalogue; retain author and CDS credit.

From the repository root:

```sh
pnpm install
python3 labs/nebula/src/acquire-lmc-stars.py
node --experimental-strip-types labs/nebula/src/run.ts prepare-lmc-stars
node --experimental-strip-types labs/nebula/src/run.ts test lmc-stars
```

The runtime only projects prepared XYZ and displays retained CSS points. The viewer applies its shared east-left presentation once and controls this independent layer's visibility and opacity.
