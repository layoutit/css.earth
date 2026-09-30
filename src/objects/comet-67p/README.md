# 67P/Churyumov–Gerasimenko

`/comet-67p/` shows Rosetta’s two-lobed comet with a measured shape and mission data.

## Sources

| View | Source | What it means |
| --- | --- | --- |
| Shape | ESA/RMOC MTP019 NAVCAM model | Reduced to 1,000 triangles. Default gray is an authored material, not measured color. |
| OSIRIS | Eleven calibrated orange-filter photographs: August 2014, October–November 2015 and April 2016 | Grayscale composite with solar-distance, disk and approximate phase correction; not measured albedo. |
| Albedo, spectral slope, absorption and ice | [Rosetta VIRTIS maps](https://pds-smallbodies.astro.umd.edu/holdings/ro-c-virtis-5-67p-maps-v1.0/) | Reflectivity, its change with wavelength, infrared absorption and modeled ice. Registration near the neck is uncertain. |
| Surface places | [Thomas et al. (2018)](https://doi.org/10.1016/j.pss.2018.05.019) and the [released SHAP7 regional map, v1](https://doi.org/10.17632/2845znt54k.1) (CC BY 4.0) | 26 named regional labels, plus the existing Agilkia and Abydos Philae sites. |
| Geology | [ESA OSIRIS geological map, v1.0](https://doi.org/10.5270/esa-kokoti7) | Lines and dots mark mapped features; their display widths are not measured sizes. |

The shape archive is `RO-C-MULTI-5-67P-SHAPE-V2.0`, described by [ESA_MODEL_INFO.ASC](https://archives.esac.esa.int/psa/ftp/INTERNATIONAL-ROSETTA-MISSION/SHAPE/RO-C-MULTI-5-67P-SHAPE-V2.0/DOCUMENT/ESA_MODEL_INFO.ASC). The 2015 photographs come from the [MTP022 GEO archive](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-esc4-67p-m22-geo-v1.0/) and its [L4 radiance and quality archive](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-4-esc4-67pchuryumov-m22-v2.0/); the April 2016 ones from the [MTP028 GEO archive](https://pds-smallbodies.astro.umd.edu/holdings/ro-c-osinac-5-ext2-67p-m28-geo-v1.0/) and its [L4 quality collection](https://pds-smallbodies.astro.umd.edu/holdings/ro-c-osinac-4-ext2-67pchuryumov-m28-v2.0/). [Feller et al. (2019)](https://doi.org/10.1051/0004-6361/201833807), Table 6, identifies this observing sequence. The geology map's Product User Guide requests acknowledgment of European Space Agency (2021), ESA-AURORA_67P-GEOMAP_OSIRIS_V1.0, and Leon-Dasi, Besse, Grieger and Küppers (2021), A&A 652 A52, [10.1051/0004-6361/202140497](https://doi.org/10.1051/0004-6361/202140497). The mass, 9.982×10¹² kg, is the Rosetta estimate of [Pätzold et al., 2016](https://doi.org/10.1038/nature16535).

The [investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying.

## Processing

Each dataset uses its own source shape: RMOC for the neutral model, SHAP7 for OSIRIS, regions and geology, and SPC SHAP5 for the four VIRTIS maps. meshoptimizer 1.2.0 simplifies each closed mesh separately to 1,000, 1,992 and 1,498 triangles, keeping both lobes, the neck and overhangs. The scene shows exactly one mesh bank at a time.

The OSIRIS photographs are level 5 GEO products with level 4 quality companions. Every quality flag other than VALID and LOSSY is rejected before interpolation. Each texel samples the closest point on the full 125K SHAP7 mesh, with emission ≤80° and an independent visibility check. At every accepted point the photograph with the finest projected surface resolution is chosen; brightness never chooses an image. Radiance becomes `I/F` through the [OSIRIS calibration pipeline, §3.13](https://pdssbn.astro.umd.edu/holdings/ro-c-osinac-5-prl-67p-m06-geo-v1.0/document/calib/osiris_cal_pipeline_v06.pdf). [Fornasier et al. (2015)](https://doi.org/10.1051/0004-6361/201525901) supplies the Lommel–Seeliger disk law and the phase terms of [equations 6 and 8 and Table 4](https://arxiv.org/abs/1505.06888). Small residual gains, 0.881–1.044, level the overlaps. [OSIRIS provenance](source/reference/osiris-georeference.json) records the manuals, quality-bit interpretation and correction limits.

VIRTIS maps and region cells transfer to their own source meshes; missing, rejected and ambiguous cells stay gridded. The geology archive's 843 paths and 2,265 feature centres are map symbols in 17 studied regions, mostly north.

The released pole RA 69.4°, Dec +64.1° and rotation period 12.4041 hours are kept. The displayed rotation phase is arbitrary.

## Evidence

Across eleven frames, the median distance from the original GEO coordinates to the released SHAP7 source is 0.31–0.34 m, against 3.17–8.80 m for the old RMOC source. These are model disagreements, not uncertainty estimates. The eleven photographs cover 90.81% of the SHAP7 display surface. The three newest images supply the selected photograph over 17.67% of it, with nadir pixel scales 0.62, 0.73 and 1.01 m.

| Prepared mesh | Visible triangles | Atlas pixels | One decoded RGBA atlas |
| --- | ---: | --- | ---: |
| RMOC neutral model | 1,000 | 1,957 × 2,092 | 16.38 MB |
| SHAP7 OSIRIS, regions and geology | 1,992 | 3,921 × 4,158 | 65.21 MB |
| SPC SHAP5 VIRTIS maps | 1,498 | 2,399 × 2,557 | 24.54 MB |

The full install is 52,416,035 bytes, including optional lighting assets; this is not a measured page download.

### Registration

<!-- registration-report:begin -->
Measured by the registration stage when the body was last prepared; the numbers are read from `prepared/surfaces.json`, not typed.

| Dataset | Frames | Scored | Limb RMS | Noise floor | Systematic | Reference | Decisive | Median offset | Relief | Refined | Seams | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `osiris` | 11 | 0 | — | — | — | its other 11 frames | 2 of 11 | — | 11 of 11, 0.00° | — | ×1.20 | registered |

Limb columns: the position-angle residual between the projected limb and the photographed contour over the frames whose outline is elongated enough to define one, the floor set by exposures minutes apart, and what remains after removing that floor in quadrature. Reference columns: each frame turned about the pole against the named reference, the frames whose peak clears both mirrors (by the strong rule, or by standing four times above them), and their median offset from the stated camera, stated only over three or more decisive frames. Relief: the same sweep against the mesh's own shading with no map and no other frame, decisive frames and their median offset. Refined: the turn a named reference applied to every camera of the dataset, or why it declined; the other columns then measure the turned dataset. Seams: the largest brightness ratio left between overlapping frames after level matching, and the frame groups no accepted overlap joins, whose relative brightness is unmeasured. Verdict: registered when every measurement that reached one (the outline over three scored frames, the reference or the relief over three decisive frames whose offsets agree with each other to within three degrees) is within three degrees; a sweep whose decisive offsets disagree by more reaches no verdict, because its median is a location rather than a measurement. A conflict ships only when named in the known conflicts of `report-registration.test.mts`, or when the dataset ships on its paper’s comparison figure, which its observer-cameras record names.
<!-- registration-report:end -->

## Known problems

- The 26 regional points are representative on-region locations, not published centres or boundaries. They appear only on OSIRIS, regions and geology. Neither they nor the Philae sites supply IAU nomenclature.
- Photographed shadows, seams and real seasonal differences remain. The composite spans a perihelion passage; it cannot measure surface change.
- Phase correction extends the published 1.3–54° fit to older observations reaching 64°. It omits roughness and multiple scattering; it is not the full Hapke model.
- Close zoom exposes stretched texture, triangle-edge seams and abrupt gray rejected patches, especially around the neck. The 1,992-face display is much coarser than the 124,938-face source; its largest closest-point displacement is 68.70 m.
- VIRTIS angular registration is approximate: the archived SHAP5 is not established as the one the original pipeline used.
- Browser views compare rendered datasets; they do not establish pixel matching with native photographs. Chrome DPR 1/2 captures and a drag-cadence comparison remain unmeasured.

[Inputs](source/manifest.json) · [Object definition](object.json) · [Preparation settings](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
