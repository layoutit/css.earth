# (159) Aemilia

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

Checked 2026-09-09. Selected **ISAM/SAGE model 102**, [original OBJ](http://isam.astro.amu.edu.pl/model.php?nr_planet=159&nr_modelu=102), pinned in the [input manifest](source/manifest.json). The archive does not declare a source release date; 2026-09-09 is the retrieval date. ISAM, Astronomical Observatory of Adam Mickiewicz University; SAGE model 102; Marciniak et al. (2018), A&A 610, A7; Bartczak and collaborators.

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

The shared recipe targets at most 800 native PolyCSS `u` raster triangles with 128 px cells and 1350 m simplification allowance. The independent source test preserves OBJ hashes, coordinates, connectivity, physical scale and pole. Actual simplification, scalar correspondence and browser evidence belong to the separate qualification records; source topology alone does not prove visual fidelity.

The source-preserving reducer uses `regularize: false`. The optional triangle-quality bias produced one retained face centroid 1366.159 m from the source, beyond the unchanged 1350 m transfer limit. Disabling that option keeps 800 closed faces and gives an independently checked trial maximum of 979.090 m over 8192 samples in each direction. The retained-centroid correspondence check is also enforced in the body test. Trial measurements are separate from final baked-product qualification; they are sampled distances rather than an exhaustive surface-error bound.

[Source test definitions](https://github.com/layoutit/css.earth/blob/943c34c8bac83509725d55ab91b48832fd65a4e8/tests/objects/unit/aemilia/source.test.mts).

## Known problems

Nonconvex SAGE light-curve reconstruction with a published occultation volume-equivalent diameter of 135 ±7 km. An alternative pole remains possible. Neutral gray marks unavailable imagery; rotation phase is illustrative.

No registered global reflectance mosaic is supplied by these releases. The neutral gray marks missing imagery. Fine relief and albedo are unresolved.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<a id="159-aemilia-source-and-interpretation"></a>
<a id="shape-and-scale"></a>
<a id="source-survey"></a>
<a id="preparation-and-qualification"></a>

<details>
<summary>Methods and source notes</summary>

**Shape and scale**

Original OBJ SHA-256:

```text
4d412ad36155b974bdc0d1d676d426449c60f883b18f64a7ee609bdc753d08c9
```

Photometry constrains the broad nonconvex shape; basin depths and fine relief are not directly resolved. A publication volume scale from the matching nominal SAGE pole family is applied uniformly; byte identity with the paper fit is not separately established. Diameter uncertainty does not bound local shape errors. No global reflectance mosaic, craters or regolith texture is inferred. The original body frame and connectivity are retained. Absolute display phase is arbitrary. Select ISAM SAGE model 102, the nonconvex pole 1 family from Marciniak et al. (2018). Its original OBJ pins target 159, method SAGE, pole (138.85848,65.93886) and period 24.478724 h. The published paper finds SAGE pole 1 marginally preferred overall by thermal fits, while all convex/SAGE solutions fit the four-chord occultation similarly well. Table 4 explicitly supplies a 135 ±7 km volume-equivalent occultation diameter for SAGE pole 1; Table 7 TPM 137 ±8 km is consistent. SAGE here uses disk-integrated photometry, not resolved images. Pole 2 remains possible. This source supersedes DAMIT 1869 convex 130 ±7 km in this package; the archive model and its raw 140-km size are retained as an excluded comparison.

The original OBJ is consumed directly through existing `wavefront-obj` and `source-meshoptimizer` support; no format conversion, new renderer or radial replacement is used. Original coordinates and all 7680 triangles are retained as the source. The 3842 vertices and 11520 edges form one closed oriented genus-zero surface. Independent volume sums both give 19.225830895673912 source units³. Scale is 40.616728183750467 km/source unit, yielding 135 km volume-equivalent diameter. Radius minus 67.5 km is a shape scalar, not gravitational height.

The source header declares +Z-axis pole (138.85848,65.93886)° and 24.478724 h, gamma 210° at JD2447278.77327. The paper's SAGE frame uses the principal inertia axis as +Z. Original axes are retained; display phase is arbitrary. Pole conversion uses J2000 obliquity 23.439291111°. Fixed scene position comes from pinned JPL Horizons heliocentric ICRF elements at 2026-09-03TT, with TDB approximated as TT under 2 ms.

**Source survey**

See the [investigation ledger](investigations.json) for the recorded sources, decisions and reopening conditions.

</details>
