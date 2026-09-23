# Alderamin

Alderamin spins so fast that its equator swells to 2.74 solar radii while its poles sit at 2.16. It is drawn that shape, 15.0 parsecs away.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: SIMBAD basic record for * alf Cep (HIP 105199), ICRS J2000 position, reference 2007A&A...474..653V; distance: Inverse of the Hipparcos new-reduction parallax 66.50 ± 0.11 mas (van Leeuwen 2007) via SIMBAD; proper motion and radial velocity as SIMBAD gives them (SIMBAD: -15.8 km/s, reference 2006AstL...32..759G.).

Shape: Zhao et al. (2009, [arXiv:0906.2241](https://arxiv.org/abs/0906.2241)), Table 3, non-standard model (beta free), adopted as the final model, fit a Roche model to CHARA/MIRC interferometry: equatorial radius 2.740 ± 0.044 and polar radius 2.162 ± 0.036 solar radii. The scene draws that ellipsoid with the equatorial radius on the outline; the astronomy record keeps the volume-equivalent sphere as its radius.

Rotation: the measured axis. The same fit gives an inclination of 55.70 ± 6.23° from the line of sight and a pole position angle of -178.84 ± 4.28° east of north; [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) turns them into the pole of [rotation.json](source/preparation/rotation.json), with the near pole up. Section 4.1 places the bright polar region at the bottom (south) of the image, toward the position angle, so that pole faces us. The fit assumed 14.96 pc; the placement here uses van Leeuwen's 15.04 pc, and the radii are the paper's. The spin is not animated: the surface has no feature that would show it.

Gravity darkening: the pole is 8588 ± 300 K and the equator 6574 ± 200 K, from ω = 0.941 ± 0.020 of break-up speed and β = 0.216 ± 0.021 in T = T_pole (g/g_pole)^β. [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) rebuilds the Roche surface from those numbers and reproduces the paper's equatorial radius and temperature within their errors ([gravity-darkening.test.mts](../../../tools/objects/observation/gravity-darkening.test.mts)). Each latitude row of the colour lens is the measured colour scaled by a Planck spectrum at that row's temperature against the surface mean. The parameters and the quoted table cells are in [gravity-darkening.json](source/photometry/gravity-darkening.json).

Colour lens: the colour of Alderamin's spectrum as the Pulkovo spectrophotometric catalogue measured it from the ground, 320-1080 nm at 10 nm resolution (HR 8162). Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)): **#d4dfff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 7510 K and log g 3.91: a model, not a measurement of this star. Temperature: Effective temperature 7510 ± 160 K, the true effective temperature of the beta-free model of Zhao et al. 2009 (ApJ 701, 209; https://arxiv.org/abs/0906.2241), Table 3. Gravity: log g from the mass 1.92 ± 0.04 solar masses of Zhao et al. 2009 (ApJ 701, 209; https://arxiv.org/abs/0906.2241), Table 3, and the volume-equivalent radius, log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same colour; [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes them, and `--check` recomputes them. Cross-check: Kharitonov et al. (1988), record 989: Alma-Ata scans gives #cfdbff, 5 levels from the lens colour in its most different channel (the threshold for agreement is 12).

## Evidence

Run of 2026-09-21 (this version):

- [`gravity-darkening.test.mts`](../../../tools/objects/observation/gravity-darkening.test.mts) checks the Roche model against the paper's equatorial radius and temperature.
- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #d4dfff is the colour lens's prepared colour, that the limb-darkening law is read at the recorded temperature and gravity, and that the second spectrum agrees.

## Known problems

**Distance.** The fit assumed 14.96 pc (Hipparcos 1997); the placement uses van Leeuwen's 15.04 pc, and the radii are the paper's, about half a percent from the size at this distance.

**No surface image is cast.** CHARA's reconstructed images are published as figures only; the lens is the fitted model, not the image.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
