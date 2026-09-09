# Himalia observation preparation

These are whole-disk measurements. They do not add resolved terrain or a compositional surface map.

The generic chart preparer checks the retained input SHA-256, units, shape and sample count. It preserves signed samples; error bars represent only the uncertainty defined below. PNGs and CSVs are prepared before runtime. No fitting, smoothing, digitization or new telescope reduction is performed.

## Himalia · G235M

JWST/NIRSpec G235M · 2024-01-31. Archive point-source extraction, pipeline 2.0.1. Flux density with propagated 1σ errors; flagged samples are omitted from the plot and retained in the CSV. No solar-spectrum division or thermal subtraction has been applied, so this is not the published relative-reflectance spectrum. Reflected sunlight and thermal emission both contribute, particularly beyond 4 µm.

- Input: `spectroscopy/jw04028-o001_t001_nirspec_g235m-f170lp_x1d.fits`
- SHA-256: `9ad5cbbdfabd252908847c97984784f18133d22c31ed67feb2bc6c16f14cbc86`
- Rows: 1425; displayed quantity: Aperture flux density (µJy).
- Input-to-display scale: 1000000.0. Uncertainty: one-sigma.
- Plot window: x 1.6–3.2; y 500–3000.
- Prepared outputs: `himalia-nirspec-g235m.png`, `himalia-nirspec-g235m.csv`.

Observation metadata:
```json
{
  "instrument": "JWST NIRSpec G235M",
  "date": "2024-01-31",
  "time": "16:18:49.599",
  "sourceProduct": "jw04028-o001_t001_nirspec_g235m-f170lp_x1d.fits",
  "pipeline": "2.0.1",
  "crdsContext": "jwst_1535.pmap",
  "archiveTargetName": "HIMALIA",
  "targetRaDegrees": 35.29486267069264,
  "targetDecDegrees": 13.371665359081087,
  "dataQualityPolicy": "Omit any nonzero DQ from plot; retain all rows and flags in CSV.",
  "sourceType": "POINT",
  "extractionCenterPixels": [
    25,
    26
  ],
  "quantity": "Calibrated extracted flux density; not author-reduced reflectance."
}
```

## Himalia · G395M

JWST/NIRSpec G395M · 2024-01-31. Archive point-source extraction, pipeline 2.0.1. Flux density with propagated 1σ errors; flagged samples are omitted from the plot and retained in the CSV. No solar-spectrum division or thermal subtraction has been applied, so this is not the published relative-reflectance spectrum. Reflected sunlight and thermal emission both contribute, particularly beyond 4 µm.

- Input: `spectroscopy/jw04028-o001_t001_nirspec_g395m-f290lp_x1d.fits`
- SHA-256: `965f2f8579c36626509e10487d71b7addf932493c9b148a920b95d81f352c774`
- Rows: 1341; displayed quantity: Aperture flux density (µJy).
- Input-to-display scale: 1000000.0. Uncertainty: one-sigma.
- Plot window: x 2.8–5.3; y 500–2000.
- Prepared outputs: `himalia-nirspec-g395m.png`, `himalia-nirspec-g395m.csv`.

Observation metadata:
```json
{
  "instrument": "JWST NIRSpec G395M",
  "date": "2024-01-31",
  "time": "15:58:38.656",
  "sourceProduct": "jw04028-o001_t001_nirspec_g395m-f290lp_x1d.fits",
  "pipeline": "2.0.1",
  "crdsContext": "jwst_1535.pmap",
  "archiveTargetName": "HIMALIA",
  "targetRaDegrees": 35.293584942155164,
  "targetDecDegrees": 13.371268322964251,
  "dataQualityPolicy": "Omit any nonzero DQ from plot; retain all rows and flags in CSV.",
  "sourceType": "POINT",
  "extractionCenterPixels": [
    26,
    26
  ],
  "quantity": "Calibrated extracted flux density; not author-reduced reflectance."
}
```

## References

- [nirspec-g235m](https://mast.stsci.edu/api/v0.1/Download/file?uri=mast%3AJWST%2Fproduct%2Fjw04028-o001_t001_nirspec_g235m-f170lp_x1d.fits)
- [nirspec-g395m](https://mast.stsci.edu/api/v0.1/Download/file?uri=mast%3AJWST%2Fproduct%2Fjw04028-o001_t001_nirspec_g395m-f290lp_x1d.fits)

Shared source review and qualification: [B4 report](../../../../docs/moons/B4-OBSERVATION-CHARTS.md).
