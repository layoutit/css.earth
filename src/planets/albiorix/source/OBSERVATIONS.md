# Albiorix observation preparation

These are whole-disk measurements. They do not add resolved terrain or a compositional surface map.

The generic chart preparer checks the retained input SHA-256, units, shape and sample count. It preserves signed samples; error bars represent only the uncertainty defined below. PNGs and CSVs are prepared before runtime. No fitting, smoothing, digitization or new telescope reduction is performed.

## Albiorix · PRISM

JWST/NIRSpec PRISM · 2023-11-22. Archive point-source extraction, pipeline 2.0.1. Flux density with propagated 1σ errors; flagged samples are omitted from the plot and retained in the CSV. No solar-spectrum division or thermal subtraction has been applied, so this is not the published relative-reflectance spectrum. The combined archive product includes a dither reported to contain a background source; its flux may be contaminated.

- Input: `spectroscopy/jw03716-o032_t008_nirspec_prism-clear_x1d.fits`
- SHA-256: `3ff215367bf5e9c53c12ffd964b413b2739be281803bb2368c14b320db3cd1f1`
- Rows: 941; displayed quantity: Aperture flux density (µJy).
- Input-to-display scale: 1000000.0. Uncertainty: one-sigma.
- Plot window: x 0.6–5.4; y 0–50.
- Prepared outputs: `albiorix-nirspec-prism.png`, `albiorix-nirspec-prism.csv`.

Observation metadata:
```json
{
  "instrument": "JWST NIRSpec PRISM",
  "date": "2023-11-22",
  "time": "02:09:15.912",
  "sourceProduct": "jw03716-o032_t008_nirspec_prism-clear_x1d.fits",
  "pipeline": "2.0.1",
  "crdsContext": "jwst_1535.pmap",
  "archiveTargetName": "ALBIORIX",
  "targetRaDegrees": 332.8931337325089,
  "targetDecDegrees": -13.300640783798169,
  "dataQualityPolicy": "Omit any nonzero DQ from plot; retain all rows and flags in CSV.",
  "sourceType": "POINT",
  "extractionCenterPixels": [
    23,
    26
  ],
  "quantity": "Calibrated extracted flux density; not author-reduced reflectance."
}
```

## References

- [nirspec-prism](https://mast.stsci.edu/api/v0.1/Download/file?uri=mast%3AJWST%2Fproduct%2Fjw03716-o032_t008_nirspec_prism-clear_x1d.fits)

Shared source review and qualification: [B4 report](../../../../docs/moons/B4-OBSERVATION-CHARTS.md).
