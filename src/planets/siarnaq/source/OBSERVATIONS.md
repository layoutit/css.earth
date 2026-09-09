# Siarnaq observation preparation

These are whole-disk measurements. They do not add resolved terrain or a compositional surface map.

The generic chart preparer checks the retained input SHA-256, units, shape and sample count. It preserves signed samples; error bars represent only the uncertainty defined below. PNGs and CSVs are prepared before runtime. No fitting, smoothing, digitization or new telescope reduction is performed.

## Siarnaq · PRISM

JWST/NIRSpec PRISM · 2023-11-22. Archive point-source extraction, pipeline 2.0.1. Flux density with propagated 1σ errors; flagged samples are omitted from the plot and retained in the CSV. No solar-spectrum division or thermal subtraction has been applied, so this is not the published relative-reflectance spectrum. Extraction and background systematics are not included in the plotted error bars.

- Input: `spectroscopy/jw03716-o033_t009_nirspec_prism-clear_x1d.fits`
- SHA-256: `da3cd8f6c90a7288ff1e22fe049ba6556783c381fbda32b6ea48f003d4d73b70`
- Rows: 941; displayed quantity: Aperture flux density (µJy).
- Input-to-display scale: 1000000.0. Uncertainty: one-sigma.
- Plot window: x 0.6–5.4; y -2–6.
- Prepared outputs: `siarnaq-nirspec-prism.png`, `siarnaq-nirspec-prism.csv`.

Observation metadata:
```json
{
  "instrument": "JWST NIRSpec PRISM",
  "date": "2023-11-22",
  "time": "03:28:46.549",
  "sourceProduct": "jw03716-o033_t009_nirspec_prism-clear_x1d.fits",
  "pipeline": "2.0.1",
  "crdsContext": "jwst_1535.pmap",
  "archiveTargetName": "SIARNAQ",
  "targetRaDegrees": 332.59246151976856,
  "targetDecDegrees": -13.62996704598575,
  "dataQualityPolicy": "Omit any nonzero DQ from plot; retain all rows and flags in CSV.",
  "sourceType": "POINT",
  "extractionCenterPixels": [
    11,
    6
  ],
  "quantity": "Calibrated extracted flux density; not author-reduced reflectance."
}
```

## References

- [nirspec-prism](https://mast.stsci.edu/api/v0.1/Download/file?uri=mast%3AJWST%2Fproduct%2Fjw03716-o033_t009_nirspec_prism-clear_x1d.fits)

Shared source review and qualification: [B4 report](../../../../docs/moons/B4-OBSERVATION-CHARTS.md).
