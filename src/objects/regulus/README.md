# Regulus

Regulus spins so fast that its equator swells to 4.21 solar radii while its poles sit at 3.22. It is drawn that shape, 24.3 parsecs away.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: SIMBAD basic record for * alf Leo (HIP 49669), ICRS J2000 position, reference 2007A&A...474..653V; distance: Inverse of the Hipparcos new-reduction parallax 41.13 ± 0.35 mas (van Leeuwen 2007) via SIMBAD; proper motion and radial velocity as SIMBAD gives them (SIMBAD: 0.72 km/s, reference 2020AJ....160..120J. Regulus has a white-dwarf companion on a 40-day orbit (Gies et al. 2008), so this may not be the system velocity.).

Shape: Che et al. (2011, [arXiv:1105.0740](https://arxiv.org/abs/1105.0740)), Table 4, modified von Zeipel model (beta free), fit a Roche model to CHARA/MIRC interferometry: equatorial radius 4.21^{+0.07}_{-0.06} and polar radius 3.22^{+0.05}_{-0.04} solar radii. The scene draws that ellipsoid with the equatorial radius on the outline; the astronomy record keeps the volume-equivalent sphere as its radius.

Rotation: the measured axis. The same fit gives an inclination of 86.3^{+1.0}_{-1.6}° from the line of sight and a pole position angle of 258^{+2}_{-1}° east of north; [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) turns them into the pole of [rotation.json](source/preparation/rotation.json), with the near pole up. The paper does not say which pole faces us; Regulus is seen almost equator-on, so the two poles show nearly alike. The spin is not animated: the surface has no feature that would show it.

Gravity darkening: the pole is 14520^{+550}_{-690} K and the equator 11010^{+420}_{-520} K, from ω = 0.962^{+0.014}_{-0.026} of break-up speed and β = 0.188^{+0.012}_{-0.029} in T = T_pole (g/g_pole)^β. [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) rebuilds the Roche surface from those numbers and reproduces the paper's equatorial radius and temperature within their errors ([gravity-darkening.test.mts](../../../tools/objects/observation/gravity-darkening.test.mts)). Each latitude row of the colour lens is the measured colour scaled by a Planck spectrum at that row's temperature against the surface mean. The parameters and the quoted table cells are in [gravity-darkening.json](source/photometry/gravity-darkening.json).

Colour lens: the colour of Regulus's spectrum as the Pulkovo spectrophotometric catalogue measured it from the ground, 320-1080 nm at 10 nm resolution (HR 3982). Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#b0c7ff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 12901 K and log g 3.89: a model, not a measurement of this star. Temperature: Effective temperature 12901 ± 500 K, the surface-mean value <T> of McAlister et al. 2005 (ApJ 628, 439; https://arxiv.org/abs/astro-ph/0501261), Table 5. Gravity: log g from the model mass 4.15 ± 0.06 solar masses of Che et al. 2011 (ApJ 732, 68; https://arxiv.org/abs/1105.0740), Table 4, and the volume-equivalent radius, log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same colour; [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes them, and `--check` recomputes them. Cross-check: Burnashev (1985), record 325: a Crimean scan gives #afc4ff, 3 levels from the lens colour in its most different channel (the threshold for agreement is 12).

## Evidence

Run of 2026-09-21 (this version):

- [`gravity-darkening.test.mts`](../../../tools/objects/observation/gravity-darkening.test.mts) checks the Roche model against the paper's equatorial radius and temperature.
- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #b0c7ff is the colour lens's prepared colour, that the limb-darkening law is read at the recorded temperature and gravity, and that the second spectrum agrees.

## Known problems

**The radial velocity may not be the system's.** SIMBAD's +0.72 ± 0.61 km/s comes from a single catalogue, and Regulus has a white-dwarf companion on a 40-day orbit (Gies et al. 2008), so the star's own velocity varies.

**No surface image is cast.** CHARA's reconstructed images are published as figures only; the lens is the fitted model, not the image.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)
