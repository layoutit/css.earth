# LMC image coverage

The current `lmc-clouds` reconstruction uses the [SMASH/NOIRLab `noirlab2030a` image](https://noirlab.edu/public/images/noirlab2030a/) as its registered color source. Its calibrated footprint is about 9.35° × 9.07°. The prepared reconstruction analyzes that image at 1024 pixels wide and delivers 512-pixel slice banks, so a wider or sharper input alone will not remove delivery pixelation.

## Completed footprint audit

Coverage was measured against the pinned `lmc-full-density` model grid (266 × 259 × 116). Encoded `sqrt-density-unorm8` alpha was decoded to density, summed through local Z into XY columns, and tested at cell centers against each registered image footprint. “Bright density” means XY columns at or above 10% of the maximum model column density; percentages below are fractions of summed model density, not observed gas or photographic light.

| Registered image footprint | Bright model-density mass | Total model-density mass |
| --- | ---: | ---: |
| SMASH | 65.2% | 45.5% |
| SMASH + Horálek optical union | 80.5% | 54.7% |

The simulation’s equal-mass particle audit places 90% of model particles within a 19.25° angular diameter. This comparison explains why a 9.35° image cuts across modeled outskirts, but it does not establish that those particles correspond to observed stars, gas, or nebulosity.

## Wider context

Alignment now also offers `dss2-wide-optical`, a 6000 × 6000, 24° TAN field from the [CDS color DSS2 survey](https://doi.org/10.26093/cds/aladin/ht9n-7r). Its FITS WCS is verified, the delivered image has no alpha holes, and its prepared placement opens at 100% calibrated sky scale (`useSavedAlignment: false`), leaving existing manual image fits untouched. Plate seams remain visible. The [local acquisition and WCS receipt](../models/lmc-overlays/source/dss2-wide-receipt.json) records the exact request and checks. No model-density coverage percentage has yet been computed for this field.

Use DSS2 as wider calibrated context and retain SMASH for higher-quality central detail. Before either becomes a joint reconstruction input, assess foreground/background separation, plate seams, passband and tone differences, and overlap behavior. Rebuild analysis and delivery resolution separately if sharper reconstructed cloud detail are required.
