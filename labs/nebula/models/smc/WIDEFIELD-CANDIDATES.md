# Wider SMC image candidates

These are inspection inputs, not new cloud materials. Native bytes remain in the ignored intake cache; URLs, hashes and rights are recorded in widefield-intake.json. The existing prepare-overlays command restores the two image planes from image-candidates.json. No star removal or reconstruction was run.

| Candidate | Downloaded raster | Use |
| --- | --- | --- |
| NOIRLab / Petr Horálek, iotw2615a | 6069 × 4045 full-resolution JPEG, 7.1 MB | Wide optical view, approximately 9.28° × 6.18°. Strongest new candidate for surrounding projected structure. |
| IRIDA / Popov & Ivanov | 4000 × 3067 JPEG, 7.6 MB | Central optical detail, approximately 2.55° × 1.95°. Upper-right hatched corner is missing coverage. All rights reserved: local inspection only; redistribution rights unresolved. |
| ESO / Beletsky & Martínez-Delgado, potw1630a | 3599 × 2477 TIFF, 14.7 MB | Both Clouds and surrounding context. Inverted luminance with colour insets: reference only, not a calibrated image or cloud skin. No complete embedded sky solution, so not placed as an overlay. |

## Registration

Horálek was matched to VISTA using the existing registration routine at a 3000px working limit. The 32,120 unique identities cover 50.5% of the source area. Held-out residuals have median 0.636 and p90 1.529 native VISTA pixels; all fixed negative-control gates pass. Its native-source homography is composed with the previously qualified VISTA-to-SMASH homography, preserving the common publisher sky anchor. The first direct SMASH attempt failed and its receipt is retained. Neither relative solution establishes absolute catalogue astrometry. Outer image regions beyond the matched hull are extrapolated.

IRIDA matches 5,907 stars directly to SMASH over 93.3% of the source area, with held-out median 0.530 and p90 0.945 native reference pixels. The fixed wrong-scale control does not meet its threshold; the failed gate remains recorded. The fitted plane is available for inspection but is not qualified for reconstruction. Never interpret its hatched no-data corner as physical structure.

No thresholds were relaxed. Successful matching aligns the photographs, not the simulation's three-dimensional shape. Different stellar populations, ionized gas, foreground dust and image stretches must remain distinct when comparing outskirts.

## Sources

- [Horálek / NOIRLab](https://noirlab.edu/public/images/iotw2615a/): full credit NOIRLab/NSF/AURA/P. Horálek (Institute of Physics in Opava).
- [IRIDA eight-panel mosaic](https://irida-observatory.org/Namibia-Tivoli/SMC_ASA_8_frames_mosaic/SMC_ASA_8_mosaic.htm): Velimir Popov & Emil Ivanov, 2016.
- [ESO deep Magellanic view](https://www.eso.org/public/images/potw1630a/) and [Besla et al. paper](https://www.eso.org/public/archives/releases/sciencepapers/potw1630/potw1630a.pdf): broad context for faint outskirts; the paper primarily analyses LMC peripheral structure, not a measured SMC volume.

Next: compare the wide optical envelope against SMASH and the neutral SMC candidates in Earth view. Any material processing remains a separate selection.
