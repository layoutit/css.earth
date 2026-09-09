# Pandora observation preparation

These are whole-disk measurements. They do not add resolved terrain or a compositional surface map.

The generic chart preparer checks the retained input SHA-256, units, shape and sample count. It preserves signed samples; error bars represent only the uncertainty defined below. PNGs and CSVs are prepared before runtime. No fitting, smoothing, digitization or new telescope reduction is performed.

## Pandora · dither 1

JWST/NIRSpec · 2022-11-08, 22:15–22:29 UT, in the Epimetheus pointing. Dither 1: disk-integrated flux density; bars show the released 1σ statistical errors. Negative samples and instrumental outliers are retained. Background and calibration systematics are not included in these errors. This measures light from the whole unresolved moon, not a spatial composition map. Shorter wavelengths were excluded by the authors because of ring stray light.

- Input: `spectroscopy/JW1247_NIRSpec_Pandoraflux_dither1.csv`
- SHA-256: `1ee81d367d7afa232058b3970af604e7bb309cc130c119d6757c241ff4fa6b8b`
- Rows: 700; displayed quantity: Flux density (µJy).
- Input-to-display scale: 1000000.0. Uncertainty: one-sigma.
- Plot window: x 1.5–5; y -4000–2000.
- Prepared outputs: `pandora-nirspec-dither-1.png`, `pandora-nirspec-dither-1.csv`.

Observation metadata:
```json
{
  "instrument": "JWST NIRSpec PRISM",
  "date": "2022-11-08",
  "observingWindow": "22:15–22:29 UT, in the Epimetheus pointing",
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

## References

- [nirspec-dither-1](https://github.com/JWSTGiantPlanets/SaturnRingsMoons/blob/2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab/JW1247_NIRSpec_Pandoraflux_dither1.csv)

Shared source review and qualification: [B4 report](../../../../docs/moons/B4-OBSERVATION-CHARTS.md).
