# B1 outer-moon inputs

All eight bodies remain in scope. The input JSON fixes geometry conventions, source pins, selected assumptions, and unresolved orbit/attitude details. It is an authoring specification, not a ready-to-merge qualification.

| ID | Parent | Geometry | Reference radius (km) |
|---|---|---|---|
| caliban | Uranus | Semiaxes 23.1679 × 19.9934 × 19.9934 | 21 |
| sycorax | Uranus | Semiaxes 84.5025 × 75.6606 × 75.6606 | 78.5 |
| prospero | Uranus | Semiaxes 32.1568 × 22.0431 × 22.0431 | 25 |
| setebos | Uranus | Semiaxes 27.7375 × 21.6306 × 21.6306 | 23.5 |
| hiiaka | Haumea | Semiaxes 240 × 180 × 143 | 183.487547 |
| squannit | Moshup | Native JPL radar OBJ | 0.225504346 |
| romulus | Sylvia | Semiaxes 18.9786 × 7.02911 × 7.02911 | 9.78786619 |
| menoetius | Patroclus | Semiaxes 58.5 × 54 × 45 | 52.19001 |

- **Uranian models:** derive minimum elongation from peak-to-peak magnitude amplitude, assume equal short axes, and disclose equal-volume display normalization. Caliban’s period prose has a typo; doubled Table4 value9.948h is selected. Prospero/Setebos adopt a doubled shape-driven interpretation with alternatives disclosed.
- **Hiʻiaka:** retain published semiaxes, not full diameters. The427795-byte workbook is verified, SHA256`0266a9969f433dc4092580a20ef47fc79ba9f9cb8fdb768495798c3fbffc769c`; it contains observations, not a model mesh. Article figures/data terms must not be relabeledMIT. Newly authored numerical ellipsoid is the selected representation.
- **Squannit:** original author OBJ verified,67298bytes,1148vertices/2292faces, SHA256`3d65690a33c5bb2ef1a7b2f40c0a6faf26f40bd87b0f6bc27a7f801d4ec50256`. ThePDS spin metadata remain inaccessible. Native coordinates agree with published kilometre extents. No claim that original/PDS bytes are identical.
- **Romulus:** select the2014 projected ellipse with assumed equal depth as one illustrative family member. The[2020 reanalysis](https://academic.oup.com/mnras/article/499/3/4570/5918397) allows correlated alternatives; that caveat must be visible.
- **Menoetius:** use published full axes117×108×90km, not projected117.2×93km. Use the2024 orbit/pole as the state route; no crater or random reflectance is inferred.

Source URL/DOI versions are retained in JSON. Unavailable byte hashes are null/absent, never invented. The initial source-selection pass used small public reads and did not materialize a source archive. Package preparation is tracked separately by the integration owner.

Implementation update: Squannit retains the original 2006 source mesh volume (0.048034509370524 km³), while [Scheirich et al. (2021), Table 4 and pages 14–15](https://arxiv.org/pdf/1912.06456v2) favors 130% of its original linear scale from mutual-event photometry. The package visibly discloses that difference. Hiʻiaka and Menoetius retain JPL states relative to their physical primaries (920136108 and 920000617); Hiʻiaka uses an older limited-accuracy solution. Final orbit inputs are retained beside each package, with independent source checks. Parent radius/albedo choices and their source receipts are in parent-inputs.json.
