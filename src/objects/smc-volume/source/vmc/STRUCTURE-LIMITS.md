# Why the raw VMC preview looks tubular

Status: diagnostic catalogue rendering, **not an accepted reconstruction of the SMC's physical density**.

## Coverage and population matter

[Subramanian & Subramaniam (2012), section 6.4](https://arxiv.org/html/1109.3980v1#S6.SS4) explains that restricted sky coverage combined with full line-of-sight sampling can yield a strongly elongated sample even for a rounder parent galaxy. Their equal-extent RR Lyrae analysis gives 1:1.33:1.61; this is a coverage-conditioned diagnostic, not a universal shape to impose on our different VMC sample.

The paper separately corrects magnitude dispersion for intrinsic population width, photometric errors and extinction. Its optical-band correction cannot simply be copied into our near-infrared catalogue.

[Tatton et al. (2021)](https://doi.org/10.1093/mnras/staa3857) finds spatially distinct distance populations. Any uncertainty treatment must preserve supported multimodality rather than flatten all stars onto an ellipsoid.

## Measured in this trial

For the 489,760 rows pinned by `crossmatch-receipt.json`, covariance of the physical Cartesian positions gives principal-axis standard-deviation ratios **1:1.201:4.052**. The central 80% spans approximately 3.19 × 2.89 × 11.62 kpc in the local frame. These are properties of the selected tracer sample.

A deliberately equal ±3.2 kpc window about its coordinate-wise median retains 238,880 rows and gives **1:1.251:1.920**. This selection necessarily reduces apparent elongation: it diagnoses sensitivity to the window, not the true shape, and has not been applied to the renderer.

The volume retains extreme photometric distances and the stepped survey footprint. Gaussian display smoothing is not distance-error deconvolution. No simulated particles, fitted image scale or fitted orientation enter this preview.

## Next physical inference

1. Keep the raw catalogue view as a diagnostic and preserve all source measurements.
2. Model the sky footprint, matching completeness and selection separately from stellar density; mark unobserved space as unknown.
3. Fit regional magnitude distributions with a near-infrared red-clump luminosity/population model, photometric and extinction uncertainties, and foreground/contamination terms. Allow multiple distance components where supported.
4. Forward-project candidate 3D distributions through that same selection and uncertainty model, then compare with held-out observations and wider-field independent tracers.
5. Only then infer a physical stellar distribution. Gas, dust and young stellar structures require their own constraints before applying the photographs as material.

Do not repair the appearance by compressing Z, extending unsupported stars laterally, or cropping to an arbitrary round shape.
