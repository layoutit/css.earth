# Epimetheus observation preparation

These are whole-disk measurements. They do not add resolved terrain or a compositional surface map.

The generic chart preparer checks the retained input SHA-256, units, shape and sample count. It preserves signed samples; error bars represent only the uncertainty defined below. PNGs and CSVs are prepared before runtime. No fitting, smoothing, digitization or new telescope reduction is performed.

## Epimetheus · dither 1

JWST/NIRSpec · 2022-11-08, 22:15–22:29 UT. Dither 1: disk-integrated flux density; bars show the released 1σ statistical errors. Negative samples and instrumental outliers are retained. Background and calibration systematics are not included in these errors. This measures light from the whole unresolved moon, not a spatial composition map. Shorter wavelengths were excluded by the authors because of ring stray light.

- Input: `spectroscopy/JW1247_NIRSpec_Epimetheusflux_dither1.csv`
- SHA-256: `4265c379087b66a2f889a3196c305230fc2647170b9ee837fb92f649ab047f08`
- Rows: 730; displayed quantity: Flux density (µJy).
- Input-to-display scale: 1000000.0. Uncertainty: one-sigma.
- Plot window: x 1.0–5; y -2000–3000.
- Prepared outputs: `epimetheus-nirspec-dither-1.png`, `epimetheus-nirspec-dither-1.csv`.

Observation metadata:
```json
{
  "instrument": "JWST NIRSpec PRISM",
  "date": "2022-11-08",
  "observingWindow": "22:15–22:29 UT",
  "sourceRelease": "https://github.com/JWSTGiantPlanets/SaturnRingsMoons/tree/2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab",
  "dither": 1,
  "sourceUnits": {
    "x": "µm",
    "y": "Jy",
    "error": "Jy"
  },
  "doi": "10.1029/2023JE008236"
}
```

## Epimetheus · dither 2

JWST/NIRSpec · 2022-11-08, 22:15–22:29 UT. Dither 2: disk-integrated flux density; bars show the released 1σ statistical errors. Negative samples and instrumental outliers are retained. Background and calibration systematics are not included in these errors. This measures light from the whole unresolved moon, not a spatial composition map. Shorter wavelengths were excluded by the authors because of ring stray light.

- Input: `spectroscopy/JW1247_NIRSpec_Epimetheusflux_dither2.csv`
- SHA-256: `2ae3266b94c4fc01402b40c695e3c92a89ef34b31b1a1fac09ea9bf57218e95b`
- Rows: 700; displayed quantity: Flux density (µJy).
- Input-to-display scale: 1000000.0. Uncertainty: one-sigma.
- Plot window: x 1.5–5; y -2000–4000.
- Prepared outputs: `epimetheus-nirspec-dither-2.png`, `epimetheus-nirspec-dither-2.csv`.

Observation metadata:
```json
{
  "instrument": "JWST NIRSpec PRISM",
  "date": "2022-11-08",
  "observingWindow": "22:15–22:29 UT",
  "sourceRelease": "https://github.com/JWSTGiantPlanets/SaturnRingsMoons/tree/2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab",
  "dither": 2,
  "sourceUnits": {
    "x": "µm",
    "y": "Jy",
    "error": "Jy"
  },
  "doi": "10.1029/2023JE008236"
}
```

## References

- [nirspec-dither-1](https://github.com/JWSTGiantPlanets/SaturnRingsMoons/blob/2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab/JW1247_NIRSpec_Epimetheusflux_dither1.csv)
- [nirspec-dither-2](https://github.com/JWSTGiantPlanets/SaturnRingsMoons/blob/2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab/JW1247_NIRSpec_Epimetheusflux_dither2.csv)

Shared source review and qualification: [B4 report](../../../../docs/moons/B4-OBSERVATION-CHARTS.md).
