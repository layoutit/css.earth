# Omega Centauri MGE prior

[photometric-mge.json](photometric-mge.json) transcribes the eight projected Gaussian
components from [D’Souza & Rix (2013), Table 1](https://wwwmpa.mpa-garching.mpg.de/mpa/publications/preprints/pp2013/MPA3537.pdf).
The recipe pins both the complete source PDF bytes and [physical-evidence.json](physical-evidence.json).
The numerical extract is retained; the PDF remains a downloadable source, not a
committed artifact. [Shape evidence](shape-evidence.md) explains the selected and
competing measurements.

## Transcription and units

- Preserve the tabulated central amplitudes and projected axis ratios exactly.
  Multiply every major-axis sigma in arcmin by60 to obtain `sigmaArcsec`.
- The table amplitudes are central projected surface brightness, confirmed by
  [Watkins et al. (2013), Table 1](https://academic.oup.com/mnras/article/436/3/2598/1258888).
  Do not apply another1/q correction. The sampler divides all amplitudes by their
  sum; their relative weights remain fixed.
- Use angular coordinates in arcseconds throughout the depth sampler. For physical
  interpretation, multiply by `distancePc × π/(180×3600)` to obtain parsecs. The
  recipe's5426±47pc distance changes scale, not the observed angular shape or the
  original paper's dynamical fit, which assumed5500±200pc.
- Use the observation recipe's ICRS center for every lens and the prior. This explicitly
  re-centers the older radial model; it is not a new center measurement.

## Oblate deprojection

Let `q′` denote the projected minor/major ratio, `i` the inclination (0° face-on),
`σ` the major-axis width and `Σ₀` its relative projected central amplitude. Each
axisymmetric Gaussian has:

```text
q² = (q′² − cos² i) / sin² i
ρ₀ = Σ₀ q′ / (√(2π) σ q)
ρ(R, z) = ρ₀ exp[−(R² + z²/q²) / (2σ²)]
```

Sum the eight components. Reject any inclination for which `q′² ≤ cos² i`;
never clamp an impossible intrinsic ratio. The most flattened component requires
`i > 43.603810°`. The selected50° follows the published model convention.

The sky frame is **x west, y north, z away from Earth**. With major-axis PA measured
east of north and authored tilt sign `s=+1`, the unit symmetry axis is:

```text
a = (sin i cos PA, sin i sin PA, s cos i)
zIntrinsic = dot(a, position)
R² = dot(position, position) − zIntrinsic²
```

The projected major axis is `(-sin PA, cos PA, 0)`. Reversing the line-of-sight tilt
produces the same projected ellipse; the image does not identify which pole is
nearer. The recipe records that choice instead of presenting it as a measurement.

## Conditional image light and finite support

The shared sampler truncates each component at ellipsoidal radius6σ. This authored
numerical bound is not a measured tidal radius. Geometry and relative density are
common to all image lenses. Preserve the images' integrated starlight and attach
image material to finite 3D emitters conditioned on this prior.

The current candidate separates a smooth envelope from positive image residuals.
The envelope uses the MGE density at every depth, with a slowly varying gain fitted
at an 8-pixel Gaussian smoothing scale and authored fraction 0.95. Its floor is zero;
512 depth samples retain the central 99.6% of the image-weighted profile. Coarse
smoothed lens chromaticity colors only this envelope. Up to 4096 residual features
receive one conditional depth each and retain finite XYZ material; no full source
photograph is repeated through depth. These numerical settings are authored display
choices, not additional measurements of the cluster.

The unchanged 512-pixel fit grid and minimum projected sigma of 0.9 fit pixels cannot
recover native stellar widths or all crowded core texture. Compact replay retains
the density, gain grid, coarse lens colors and finite supports explicitly. Actual
bake and byte-identical replay acceptance remain separate from analytic fit checks.

The result remains relative display emission under a smooth axisymmetric hypothesis.
It does not supply measured member-star depths, population-specific mass segregation,
a calibrated luminosity field, an N-body simulation or a solution to central
counter-rotation. Source JSON and hash checks establish transcription and identity;
registration, actual baking, side-view inspection and promotion require separate
recorded results.
