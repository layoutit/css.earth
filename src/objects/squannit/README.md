# Squannit

Squannit is Moshup’s companion, formerly 1999 KW4 Beta.

## Sources

[Investigation ledger](investigations.json): recorded source decisions, evidence and conditions for revisiting them.

JPL radar shape model of 1999 KW 4 Beta, with finite resolution and uneven radar coverage. The original mesh is retained before simplification. Display phase is arbitrary; libration is not reproduced. The grid marks unmapped visible-light terrain.

- [PDS JPL radar shape model collection](https://sbn.psi.edu/pds/resource/jplradarshape.html)
- [PDS JPL radar shape data directory](https://sbnarchive.psi.edu/pds4/non_mission/gbo.ast.jpl.radar.shape_models_V1_0/data/)

## Evidence

The prepared surface displays both sides of its existing 800 native triangles. This prevents rear-face suppression from exposing fine raster edge cracks in Chrome. It adds no faces and changes no source vertex, scale, atlas or texture. The source-mesh simplification remains at an estimated 2.0273 m error within its retained 4 m budget; that estimator is not a guaranteed maximum surface distance. The original 2,292-face OBJ remains pinned and unchanged.

[Source test definitions](../../../tests/objects/unit/squannit/source.test.mts).

## Known problems

Original 2006 mesh connectivity and scale are retained. No color or albedo texture is supplied.

PDS model XML and beta-spin CSV requests returned HTTP 403 during the source review. Their epoch/Euler conventions and exact equivalence to the acquired author OBJ remain unresolved.

Later mutual-event photometry favors roughly 1.3 times the original radar model’s linear scale. This view retains the original 2006 mesh dimensions. Scheirich et al. (2021), [Table 4 and pages 14–15](https://arxiv.org/pdf/1912.06456v2), rescale the secondary shape to 130% to fit mutual-event depths, giving a volume-equivalent diameter of 0.59 ± 0.04 km (formal 1-sigma uncertainty; actual uncertainty may be higher). Their discussion identifies low signal-to-noise in the secondary radar echoes as a possible source of underestimated size. The displayed radius remains 0.22550434622701193 km, derived from the original mesh volume.

The fixed-epoch orbit is evaluated from Scheirich et al. (2021), Table 4 and section 2.2, with the phase-bearing source parameters retained in source/orbit/published-parameters.json. The 2026 scene extrapolates the 2000–2019 photometric fit. Summed individual phase sensitivities are about 55 degrees at this epoch; this is not a formal confidence interval, and no independent 2026 position product was acquired. The older radar pole checks the orbital plane but does not verify the extrapolated current phase. Geometry retains the original 2006 OBJ scale independently of the later photometric size preference. No current attitude or libration is predicted.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<a id="squannit-source-model"></a>
<a id="selected-geometry"></a>
<a id="assumptions"></a>
<a id="source-interpretation-limits"></a>
<a id="orbit-and-orientation"></a>
<a id="survey-and-sources"></a>
<a id="retained-orbit-qualification"></a>
<a id="retained-triangle-coverage"></a>

<details>
<summary>Methods and source notes</summary>

**Selected geometry**

Native mesh scale cross-checked against published full extents 0.57 × 0.46 × 0.35 km.

**Orbit and orientation**

The [validation records](source/validation) identify the parent-relative state and any fit interval. The display uses meridian zero.

**Survey and sources**

Source decisions and the historical review they came from are recorded in the [investigation ledger](investigations.json).

</details>
