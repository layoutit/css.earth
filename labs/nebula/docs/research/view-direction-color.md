# View-direction color in the LMC cloud reconstruction

> Research record. This describes the recorded experiment, not the current app. Retired tabs and Orion models are no longer available. Use the [current workflow](../workflows.md) for processing and [current reconstruction](../reconstruction.md) for the active method.

The reconstructed cloud becomes brighter and less saturated away from the front view. This is expected from the current view-independent emission field; it is not evidence that one prepared axis bank has a different color treatment.

## Measurement

The subject is `lmc-clouds`, built by `labs/nebula/models/lmc/clouds.json` from the CTIO/NOIRLab SMASH image `noirlab2030a` (`.local/nebula-lab/source-originals/noirlab2030a.tif`, SHA-256 `6aa365263e05772590b42f90818d9b2128af16b5a8384ea96066fa5e5e4e81e0`). The prepared delivery bank is `labs/nebula/models/lmc/clouds/prepared`.

Rendered-image measurements used the central workspace crop, excluding the header and side panels. HSV saturation was measured for pixels whose RGB peak exceeded 0.02; the reported peak is brightness-weighted. Captures are in `.local/nebula-lab/filled-review/browser/final-fixed/screenshots/`.

| Capture | Mean saturation | Median saturation | Brightness-weighted RGB peak |
| --- | ---: | ---: | ---: |
| `lmc-clouds-front.png` | 0.260 | 0.250 | 0.315 |
| `lmc-clouds-x-minus-60.png` | 0.139 | 0.133 | 0.433 |
| `lmc-clouds-y-minus-60.png` | 0.155 | 0.178 | 0.703 |
| `lmc-clouds-edge-x.png` | 0.128 | 0.147 | 0.674 |
| `lmc-clouds-edge-y.png` | 0.151 | 0.157 | 0.484 |

As a separate check, all nontransparent texels in the prepared X/Y/Z slice textures were decoded. Their alpha-weighted mean saturations are nearly identical: X `0.11359`, Y `0.11325`, and Z `0.11386`. The whitening therefore appears during line-of-sight composition, rather than in an axis-specific texture encoding.

## Cause

The front projection follows the registered photograph: samples through depth at one image coordinate inherit nearly one source chromaticity. An oblique ray crosses many image columns with different colors. Source-over composition combines those nonnegative RGB contributions, moving the result toward neutral and increasing its peak brightness. Coincident optical copies change path weight but reuse the same pixels and transforms. At intermediate angles, the runtime also blends complete axis banks; edge views show that within-bank line-of-sight mixing remains the main effect.

The source photograph constrains the front projection only. It does not constrain the color seen from the side, and the stellar prior supplies approximate depth support rather than side-view color observations. Adding saturation by axis or camera angle would hide this limitation and make color depend on the chosen prepared bank. A view-independent improvement would require a new color-coherence model with a fresh proof that the front projection still preserves the source.

These values describe encoded display RGB in browser captures and WebP delivery textures. They are not calibrated photometry, and they do not establish the physical color of the LMC from another viewpoint.
