# Caph

Caph spins so fast that its equator swells to 3.79 solar radii while its poles sit at 3.06. We see it nearly pole-on, 16.8 parsecs away.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: SIMBAD basic record for * bet Cas (HIP 746), ICRS J2000 position, reference 2007A&A...474..653V; distance: Inverse of the Hipparcos new-reduction parallax 59.58 ± 0.38 mas (van Leeuwen 2007) via SIMBAD; proper motion and radial velocity as SIMBAD gives them (SIMBAD: 4.3 km/s, reference 2006AstL...32..759G.).

Shape: Che et al. (2011, [arXiv:1105.0740](https://arxiv.org/abs/1105.0740)), Table 3, modified von Zeipel model (beta free), fit a Roche model to CHARA/MIRC interferometry: equatorial radius 3.79^{+0.10}_{-0.09} and polar radius 3.06^{+0.08}_{-0.07} solar radii. The scene draws that ellipsoid with the equatorial radius on the outline; the astronomy record keeps the volume-equivalent sphere as its radius.

Rotation: the measured axis. The same fit gives an inclination of 19.9^{+1.9}_{-1.9}° from the line of sight and a pole position angle of -7.09^{+2.24}_{-2.40}° east of north; [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) turns them into the pole of [rotation.json](source/preparation/rotation.json), with the near pole up. The paper calls the bright centre one pole without saying which. At this low inclination beta and the inclination and omega are degenerate (section 3.1). The effective temperature is the apparent value; no true value is given. The spin is not animated: the surface has no feature that would show it.

Gravity darkening: the pole is 7208^{+42}_{-24} K and the equator 6167^{+36}_{-21} K, from ω = 0.920^{+0.024}_{-0.034} of break-up speed and β = 0.146^{+0.013}_{-0.007} in T = T_pole (g/g_pole)^β. [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) rebuilds the Roche surface from those numbers and reproduces the paper's equatorial radius and temperature within their errors ([gravity-darkening.test.mts](../../../tools/objects/observation/gravity-darkening.test.mts)). Each latitude row of the colour lens is the measured colour scaled by a Planck spectrum at that row's temperature against the surface mean. The parameters and the quoted table cells are in [gravity-darkening.json](source/photometry/gravity-darkening.json).

Colour lens: the colour of Caph's spectrum as the Pulkovo spectrophotometric catalogue measured it from the ground, 320-1080 nm at 10 nm resolution (HR 21). Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar/stellar-photometric-color.mts)): **#e5e9ff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 6825 K and log g 3.62: a model, not a measurement of this star. Temperature: Apparent effective temperature 6825 K of Che et al. 2011 (ApJ 732, 68; https://arxiv.org/abs/1105.0740), Table 3; the paper gives no true effective temperature or uncertainty. Gravity: log g from the model mass 1.91 ± 0.02 solar masses of Che et al. 2011 (ApJ 732, 68; https://arxiv.org/abs/1105.0740), Table 3, and the volume-equivalent radius, log10(GM/R^2) in cgs. The catalogue swatch, the minimap and the navigation marker use the same colour; [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes them, and `--check` recomputes them. Cross-check: Kharitonov et al. (1988), record 5: Alma-Ata scans gives #e2e6ff, 3 levels from the lens colour in its most different channel (the threshold for agreement is 12).

## Evidence

Run of 2026-09-21 (this version):

- [`gravity-darkening.test.mts`](../../../tools/objects/observation/gravity-darkening.test.mts) checks the Roche model against the paper's equatorial radius and temperature.
- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #e5e9ff is the colour lens's prepared colour, that the limb-darkening law is read at the recorded temperature and gravity, and that the second spectrum agrees.

## Known problems

**Temperature.** The paper gives only the apparent effective temperature, 6825 K, with no uncertainty; the limb law is read there.
**Degeneracy.** At an inclination of 20°, β, the inclination and ω are degenerate in the fit (Che et al. 2011, section 3.1).

**No surface image is cast.** CHARA's reconstructed images are published as figures only; the lens is the fitted model, not the image.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
