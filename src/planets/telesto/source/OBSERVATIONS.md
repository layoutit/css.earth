# Telesto observation preparation

These are whole-disk measurements. They do not add resolved terrain or a compositional surface map.

The generic chart preparer checks the retained input SHA-256, units, shape and sample count. It preserves signed samples; error bars represent only the uncertainty defined below. PNGs and CSVs are prepared before runtime. No fitting, smoothing, digitization or new telescope reduction is performed.

## Telesto · dither 1

JWST/NIRSpec · 2022-11-10, 12:04–12:25 UT. Dither 1: disk-integrated flux density; bars show the released 1σ statistical errors. Negative samples and instrumental outliers are retained. Background and calibration systematics are not included in these errors. This measures light from the whole unresolved moon, not a spatial composition map. Measurements below 1.3 µm may include residual ring stray light.

- Input: `spectroscopy/JW1247_NIRSpec_Telestoflux_dither1.csv`
- SHA-256: `a96ec148764c959d7603074832979ec2269bbb60fa6f052d528da40ae12a7afa`
- Rows: 860; displayed quantity: Flux density (µJy).
- Input-to-display scale: 1000000.0. Uncertainty: one-sigma.
- Plot window: x 0.5–5; y -1000–1000.
- Prepared outputs: `telesto-nirspec-dither-1.png`, `telesto-nirspec-dither-1.csv`.

Observation metadata:
```json
{
  "instrument": "JWST NIRSpec PRISM",
  "date": "2022-11-10",
  "observingWindow": "12:04–12:25 UT",
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

## Telesto · dither 2

JWST/NIRSpec · 2022-11-10, 12:04–12:25 UT. Dither 2: disk-integrated flux density; bars show the released 1σ statistical errors. Negative samples and instrumental outliers are retained. Background and calibration systematics are not included in these errors. This measures light from the whole unresolved moon, not a spatial composition map. Measurements below 1.3 µm may include residual ring stray light.

- Input: `spectroscopy/JW1247_NIRSpec_Telestoflux_dither2.csv`
- SHA-256: `fd2823d0b6256542c2f5c99138533245b9729b525180247505693957d1f597fd`
- Rows: 860; displayed quantity: Flux density (µJy).
- Input-to-display scale: 1000000.0. Uncertainty: one-sigma.
- Plot window: x 0.5–5; y -100–300.
- Prepared outputs: `telesto-nirspec-dither-2.png`, `telesto-nirspec-dither-2.csv`.

Observation metadata:
```json
{
  "instrument": "JWST NIRSpec PRISM",
  "date": "2022-11-10",
  "observingWindow": "12:04–12:25 UT",
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

- [nirspec-dither-1](https://github.com/JWSTGiantPlanets/SaturnRingsMoons/blob/2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab/JW1247_NIRSpec_Telestoflux_dither1.csv)
- [nirspec-dither-2](https://github.com/JWSTGiantPlanets/SaturnRingsMoons/blob/2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab/JW1247_NIRSpec_Telestoflux_dither2.csv)

Shared source review and qualification: [B4 report](../../../../docs/moons/B4-OBSERVATION-CHARTS.md).
