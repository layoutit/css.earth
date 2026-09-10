# Varda

Varda is a distant binary-system primary whose outline was measured as it eclipsed a star. Its companion’s orbit helps orient this model, but Varda’s depth remains uncertain.

One published allowable triaxial model, with semiaxes 389, 353 and 248 km. The line-of-sight depth is unconstrained; these best-fit values illustrate a solution rather than a uniquely measured body shape. Assumes the spin pole aligns with Ilmarë’s orbit: J2000 RA 272.6° and declination −10.8°. This is a model prior; rotational phase and meridian are illustrative. The grid marks unmapped terrain.

Source: [Proudfoot et al. (2026), occult3d reanalysis of Souami et al. (2020) occultation chords](https://arxiv.org/abs/2605.28636). Checked 2026-09-09. Numerical extraction and its assumptions are pinned in source/measurements.json. Scene epoch is fixed at 2026-09-03. Shadows and Orbit default off.

## Source survey

- Included: Updated satellite orbit and a triaxial example model Most recent qualified numeric fit found; explicit depth degeneracy is retained. https://arxiv.org/abs/2605.28636
- Included-as-observations-only: Five measured occultation chords and several Maclaurin interpretations The 2026 study rules out the older mirror-orbit interpretation supporting the spheroidal fit if spin and satellite orbit are aligned. https://doi.org/10.1051/0004-6361/202038526
- Excluded: Astrometry and occultation light curves These are unresolved time-series measurements; no spatial surface mosaic or additional terrain is implied. https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/643/A125
- Excluded-from-runtime: Published analysis software and numerical-model provenance The existing ellipsoid preparer consumes the published numbers; no new fitting or rendering technique is introduced. https://github.com/benp175/occult3d

Reproduce numeric inputs with `python3 docs/distant-worlds/author.py`. The existing terrestrial preparer and meshoptimizer produce retained PolyCSS native u raster triangles.
