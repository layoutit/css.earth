# HD 110067

The host of six transiting sub-Neptunes. The default lens shows its measured ESPRESSO colour with a modeled darker edge.

## Sources

[Luque et al. (2023)](https://doi.org/10.1038/s41586-023-06692-3), Table 1 and Extended Data Table 3, supply the adopted radius and orbital parameters. SIMBAD/Gaia EDR3 astrometry places the star at an inverse-parallax distance of 32.22 pc.

The [ESO ESPRESSO product](https://dataportal.eso.org/dataPortal/file/ADP.2024-03-08T10:41:06.519), observed on 2024-02-14, was acquired through the shared Telescope API with a 20 MiB cap. Its WAVE/FLUX/ERR/QUAL vectors retain native units and errors. The stellar-colour owner averages the visible spectrum into 1 nm bins, integrates against the CIE 1931 observer and encodes sRGB with its brightest linear channel normalized to one. This represents chromaticity, not apparent brightness. The zero-error edge samples lie outside the 380–780 nm colour integration range.

[Zak et al. (2024)](https://doi.org/10.1051/0004-6361/202450570), section 4, adopt ExoCTK ATLAS9 coefficients u1=0.564 and u2=0.145 for ESPRESSO (380–788 nm). The shared limb preparer uses those published model values; they are not measured coefficients.

## Evidence

The focused hosted-orbit, source, package and rendered-scene checks passed; see the [evidence and browser captures](evidence/README.md). The [independent Astropy/NumPy colour calculation](evidence/color-reference.json) agrees at sRGB [255, 218, 212]. Every visible 1 nm bin contains measured samples. This checks integration of the same spectrum, not its calibration. No N-body dynamics are claimed.

## Known problems

Circular orbits with the published 2023 periods and transit epochs. Planet-planet perturbations and transit-timing variations are not propagated; this is not a current transit forecast or an N-body resonance simulation. Absolute sky nodes and spin axes are unknown. The spectroscopic flux calibration is an archive declaration, with no independent spectrophotometric colour check in this package. The ESPRESSO-band ATLAS9 model is applied equally to all colour channels; spots are omitted. Wide stellar companions are deferred in the ledger.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Credits](NOTICE.md)
