# Ymir observation preparation

These are whole-disk measurements. They do not add resolved terrain or a compositional surface map.

The generic chart preparer checks the retained input SHA-256, units, shape and sample count. It preserves signed samples; error bars represent only the uncertainty defined below. PNGs and CSVs are prepared before runtime. No fitting, smoothing, digitization or new telescope reduction is performed.

## Ymir · 29° phase angle

Cassini ISS clear-filter measurements · 2015-07-11 · Sun–moon–spacecraft angle 29°. Relative magnitude versus rotational phase, folded by the authors; smaller magnitudes are brighter. The released table has no per-point uncertainties. Sequence ISS_218OT_YMICOL029; its magnitude zero point is relative, not an absolute brightness or a surface map.

- Input: `photometry/619_Ymi_4_LC_Paper1.txt`
- SHA-256: `246f862997171d47ec6e132cd7bf6e024e316fcc289aaa5bbc2b08d66d8ee4d2`
- Rows: 20; displayed quantity: Relative magnitude (mag).
- Input-to-display scale: 1. Uncertainty: not-released.
- Plot window: x 0–1; y 0–1.0.
- Prepared outputs: `ymir-218ot_ymicol029.png`, `ymir-218ot_ymicol029.csv`.

Observation metadata:
```json
{
  "instrument": "Cassini ISS NAC clear filters",
  "sequence": "ISS_218OT_YMICOL029",
  "date": "2015-07-11",
  "phaseAngleDegrees": 29,
  "foldingPeriodHours": 11.92,
  "foldingPeriodUncertaintyHours": 0.03,
  "sourcePage": "https://tilmanndenk.de/outersaturnianmoons/ymir/#4"
}
```

## Ymir · 65° phase angle

Cassini ISS clear-filter measurements · 2012-05-01 · Sun–moon–spacecraft angle 65°. Relative magnitude versus rotational phase, folded by the authors; smaller magnitudes are brighter. The released table has no per-point uncertainties. Sequence ISS_165OT_YMIROTA065; its magnitude zero point is relative, not an absolute brightness or a surface map.

- Input: `photometry/619_Ymi_4_LC_Paper1.txt`
- SHA-256: `246f862997171d47ec6e132cd7bf6e024e316fcc289aaa5bbc2b08d66d8ee4d2`
- Rows: 94; displayed quantity: Relative magnitude (mag).
- Input-to-display scale: 1. Uncertainty: not-released.
- Plot window: x 0–1; y 0–2.0.
- Prepared outputs: `ymir-165ot_ymirota065.png`, `ymir-165ot_ymirota065.csv`.

Observation metadata:
```json
{
  "instrument": "Cassini ISS NAC clear filters",
  "sequence": "ISS_165OT_YMIROTA065",
  "date": "2012-05-01",
  "phaseAngleDegrees": 65,
  "foldingPeriodHours": 11.92,
  "foldingPeriodUncertaintyHours": 0.03,
  "sourcePage": "https://tilmanndenk.de/outersaturnianmoons/ymir/#4"
}
```

## Ymir · 63° phase angle

Cassini ISS clear-filter measurements · 2012-05-03 · Sun–moon–spacecraft angle 63°. Relative magnitude versus rotational phase, folded by the authors; smaller magnitudes are brighter. The released table has no per-point uncertainties. Sequence ISS_165OT_YMIROTB065; its magnitude zero point is relative, not an absolute brightness or a surface map.

- Input: `photometry/619_Ymi_4_LC_Paper1.txt`
- SHA-256: `246f862997171d47ec6e132cd7bf6e024e316fcc289aaa5bbc2b08d66d8ee4d2`
- Rows: 84; displayed quantity: Relative magnitude (mag).
- Input-to-display scale: 1. Uncertainty: not-released.
- Plot window: x 0–1; y 0–2.0.
- Prepared outputs: `ymir-165ot_ymirotb065.png`, `ymir-165ot_ymirotb065.csv`.

Observation metadata:
```json
{
  "instrument": "Cassini ISS NAC clear filters",
  "sequence": "ISS_165OT_YMIROTB065",
  "date": "2012-05-03",
  "phaseAngleDegrees": 63,
  "foldingPeriodHours": 11.92,
  "foldingPeriodUncertaintyHours": 0.03,
  "sourcePage": "https://tilmanndenk.de/outersaturnianmoons/ymir/#4"
}
```

## Ymir · 95° phase angle

Cassini ISS clear-filter measurements · 2012-06-22/23 · Sun–moon–spacecraft angle 95°. Relative magnitude versus rotational phase, folded by the authors; smaller magnitudes are brighter. The released table has no per-point uncertainties. Sequence ISS_168OT_YMIROT095; its magnitude zero point is relative, not an absolute brightness or a surface map.

- Input: `photometry/619_Ymi_4_LC_Paper1.txt`
- SHA-256: `246f862997171d47ec6e132cd7bf6e024e316fcc289aaa5bbc2b08d66d8ee4d2`
- Rows: 299; displayed quantity: Relative magnitude (mag).
- Input-to-display scale: 1. Uncertainty: not-released.
- Plot window: x 0–1; y 0–2.5.
- Prepared outputs: `ymir-168ot_ymirot095.png`, `ymir-168ot_ymirot095.csv`.

Observation metadata:
```json
{
  "instrument": "Cassini ISS NAC clear filters",
  "sequence": "ISS_168OT_YMIROT095",
  "date": "2012-06-22/23",
  "phaseAngleDegrees": 95,
  "foldingPeriodHours": 11.92,
  "foldingPeriodUncertaintyHours": 0.03,
  "sourcePage": "https://tilmanndenk.de/outersaturnianmoons/ymir/#4"
}
```

## References

- [218ot_ymicol029](https://tilmanndenk.de/wp-content/uploads/619_Ymi_4_LC_Paper1.txt)
- [165ot_ymirota065](https://tilmanndenk.de/wp-content/uploads/619_Ymi_4_LC_Paper1.txt)
- [165ot_ymirotb065](https://tilmanndenk.de/wp-content/uploads/619_Ymi_4_LC_Paper1.txt)
- [168ot_ymirot095](https://tilmanndenk.de/wp-content/uploads/619_Ymi_4_LC_Paper1.txt)

Shared source review and qualification: [B4 report](../../../../docs/moons/B4-OBSERVATION-CHARTS.md).
