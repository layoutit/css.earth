# Methone observation preparation

These are whole-disk measurements. They do not add resolved terrain or a compositional surface map.

The generic chart preparer checks the retained input SHA-256, units, shape and sample count. It preserves signed samples; error bars represent only the uncertainty defined below. PNGs and CSVs are prepared before runtime. No fitting, smoothing, digitization or new telescope reduction is performed.

## Methone · Cassini VIMS

Cassini VIMS · 2012-05-20 · about 58° phase angle. Mean disk-integrated spectrum from five cubes, re-normalized by Hedman et al. (2024) to a dimensionless brightness coefficient. Bars show the released 1σ statistical errors. Three channel gaps follow the author notebook; omitted rows remain in the CSV. This model-normalized coefficient is not absolute albedo or a spatial composition map.

- Input: `spectroscopy/methonespecplot2_tab_011224.txt`
- SHA-256: `e6d56686af08464a9c9caabc70a442924144611c1fa5d2fb95f361cf175f513e`
- Rows: 256; displayed quantity: Brightness coefficient (unitless).
- Input-to-display scale: 1. Uncertainty: one-sigma.
- Plot window: x 0.8–5.2; y -0.5–0.6.
- Prepared outputs: `methone-vims-spectrum.png`, `methone-vims-spectrum.csv`.

Excluded from plot: 1.6116–1.6716 µm; Author notebook cell 17: within 0.03 µm of channel index 46. All rows remain in the CSV.
Excluded from plot: 2.9472–3.0072 µm; Author notebook cell 17: within 0.03 µm of channel index 127. All rows remain in the CSV.
Excluded from plot: 3.83184–3.89184 µm; Author notebook cell 17: within 0.03 µm of channel index 180. All rows remain in the CSV.

Observation metadata:
```json
{
  "instrument": "Cassini VIMS",
  "date": "2012-05-20",
  "phaseAngleDegreesApproximate": 58,
  "productIds": [
    "V1716191964",
    "V1716192051",
    "V1716192374",
    "V1716192461",
    "V1716192872"
  ],
  "doi": "10.1029/2023JE008236",
  "parentDoi": "10.3847/1538-3881/ab659d",
  "normalization": "Brightness coefficient released in 2024, normalized from 2020 relative brightness; not re-fitted by cssEarth."
}
```

## References

- [vims-spectrum](https://raw.githubusercontent.com/JWSTGiantPlanets/SaturnRingsMoons/2d47da90ae6bf78a9dfe74a3e7deea94ae98e8ab/methonespecplot2_tab_011224.txt)

Shared source review and qualification: [B4 report](../../../../docs/moons/B4-OBSERVATION-CHARTS.md).
