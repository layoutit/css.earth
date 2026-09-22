# Rasalhague

Rasalhague spins so fast that its equator swells to 2.86 solar radii while its poles sit at 2.39. It is drawn that shape, 14.9 parsecs away.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: SIMBAD basic record for * alf Oph (HIP 86032), ICRS J2000 position, reference 2007A&A...474..653V; distance: Inverse of the Hipparcos new-reduction parallax 67.13 ± 1.06 mas (van Leeuwen 2007) via SIMBAD; proper motion and radial velocity as SIMBAD gives them (SIMBAD: 11.7 km/s, reference 2006AstL...32..759G.).

Shape: Monnier et al. (2010, [arXiv:1012.0787](https://arxiv.org/abs/1012.0787)), Table 1, fit a Roche model to CHARA/MIRC interferometry: equatorial radius 2.858 ± 0.015 and polar radius 2.388 ± 0.013 solar radii. The scene draws that ellipsoid with the equatorial radius on the outline; the astronomy record keeps the volume-equivalent sphere as its radius.

Rotation: the measured axis. The same fit gives an inclination of 87.5 ± 0.6° from the line of sight and a pole position angle of -53.5 ± 1.7° east of north; [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) turns them into the pole of [rotation.json](source/preparation/rotation.json), with the near pole up. beta is not fitted: the error bars rely on fixing it at 0.25, and the authors say it might be substantially lower. Lazzarotto et al. (2026, A&A 709, A251) dispute the inclination: 68.9 ± 5.6 degrees from 2D ESTER models and spectrophotometry, attributing the near edge-on value to the fixed beta. The paper does not say which pole faces us. The fit assumed 14.68 pc; the placement uses 14.90 pc. The spin is not animated: the surface has no feature that would show it.

Gravity darkening: the pole is 9384 ± 154 K and the equator 7569 ± 124 K, from ω = 0.880 ± 0.026 of break-up speed and β = 0.25 (fixed) in T = T_pole (g/g_pole)^β. [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) rebuilds the Roche surface from those numbers and reproduces the paper's equatorial radius and temperature within their errors ([gravity-darkening.test.mts](../../../tools/objects/observation/gravity-darkening.test.mts)). Each latitude row of the colour lens is the measured colour scaled by a Planck spectrum at that row's temperature against the surface mean. The parameters and the quoted table cells are in [gravity-darkening.json](source/photometry/gravity-darkening.json).

Colour lens: the colour of Rasalhague's spectrum as the Pulkovo spectrophotometric catalogue measured it from the ground, 320-1080 nm at 10 nm resolution (HR 6556). Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#ccdaff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 8336 K and log g 3.92: a model, not a measurement of this star. Temperature: Effective temperature 8336 ± 39 K, the true effective temperature of Monnier et al. 2010 (ApJ 725, 1192; https://arxiv.org/abs/1012.0787), Table 1. Gravity: log g from the dynamical mass 2.20 ± 0.06 solar masses of Gardner et al. 2021 (https://doi.org/10.3847/1538-4357/ac1172) and the volume-equivalent radius, log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same colour; [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes them, and `--check` recomputes them. Cross-check: Burnashev (1985), record 337: a Crimean scan gives #ccdaff, 0 levels from the lens colour in its most different channel (the threshold for agreement is 12).

## Evidence

Run of 2026-09-21 (this version):

- [`gravity-darkening.test.mts`](../../../tools/objects/observation/gravity-darkening.test.mts) checks the Roche model against the paper's equatorial radius and temperature.
- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #ccdaff is the colour lens's prepared colour, that the limb-darkening law is read at the recorded temperature and gravity, and that the second spectrum agrees.

## Known problems

**β is fixed, not fitted.** Monnier et al. (2010) hold β at 0.25 and say their error bars rely on it; β might be substantially lower, which would soften the pole-to-equator contrast.
**The inclination is disputed.** Lazzarotto et al. (2026, A&A 709, A251) find 68.9 ± 5.6° from 2D ESTER models and spectrophotometry and attribute CHARA's near edge-on 87.5° to the fixed β. The package draws the CHARA fit.
**Distance.** The fit assumed 14.68 pc (Gatewood 2005); the placement uses van Leeuwen's 14.90 pc.

**No surface image is cast.** CHARA's reconstructed images are published as figures only; the lens is the fitted model, not the image.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
