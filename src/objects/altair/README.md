# Altair

Altair spins so fast that its equator bulges to 2.03 solar radii while its poles sit at 1.63. Here it is a plain sphere of the same volume, 5.13 parsecs away.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 194.95 ± 0.57 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Altair, not two.

Radius: Altair is a rapid rotator: Monnier et al. (2007), Science 317, 342, measure an equatorial radius of 2.029 ± 0.007 and a polar radius of 1.634 ± 0.011 solar radii with CHARA/MIRC. The record's radius is the volume-equivalent sphere of those two, 1.89 solar radii. The scene draws the measured flattening: an ellipsoid with the equatorial radius on the outline.

Rotation: the measured axis. Monnier et al. (2007), Science 317, 342, Table 1, the free-β fit, give an inclination of 57.2 ± 1.9° from the line of sight and a pole position angle of −61.8 ± 0.8° east of north; [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) turns them into the pole of [rotation.json](source/preparation/rotation.json), with the near pole up. The spin is not animated: the surface has no feature that would show it.

Colour lens: The colour of Altair's spectrum as the Pulkovo spectrophotometric catalogue measured it from the ground, 320-1080 nm at 10 nm resolution. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#d4dfff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 7680 K and log g 4.13: the edge is 37% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g from the mass 1.74 +/- 0.49 solar masses that van Belle et al. 2001 (ApJ 559, 1155; https://doi.org/10.1086/322340), Section 5, measure from the oblateness and v sin i, and the package radius, log10(GM/R^2) in cgs; a mean over the rapidly rotating surface. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: Burnashev (1985), record 593: a Crimean scan of 1982 gives #cedaff, 6 levels from the lens colour in its most different channel (the threshold for agreement is 12).

Gravity darkening: the same fit gives the pole 8,450 ± 140 K and the equator 6,860 ± 150 K, from ω = 0.923 of break-up speed and β = 0.190 in T = T_pole (g/g_pole)^β. [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) rebuilds the Roche surface from those numbers; it reproduces the paper's equatorial radius and temperature within their errors ([gravity-darkening.test.mts](../../../tools/objects/observation/gravity-darkening.test.mts)). Each latitude row of the colour lens is the measured colour scaled by a Planck spectrum at that row's temperature against the surface mean, so the poles are brighter and bluer and the equator dimmer and warmer. The parameters and the quoted table cells are in [gravity-darkening.json](source/photometry/gravity-darkening.json).

## Evidence

Run of 2026-09-21 (this version):

- [`gravity-darkening.test.mts`](../../../tools/objects/observation/gravity-darkening.test.mts) checks the Roche model against the paper's equatorial radius and temperature.
- [`object-package-consistency.test.mts`](../../../tools/object-package-consistency.test.mts) checks that the catalogue colour #d4dfff is the colour lens's prepared colour and that the limb-darkening law is read at the recorded temperature and gravity; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

The edge darkening is drawn on a round plate fitted to the equator. Altair's outline is an ellipse that changes as the camera turns, so near the poles the darkening starts slightly outside the edge; computing it per view would derive geometry at runtime, which the renderer does not do. The paper does not say which pole faces us; its image shows the bright pole in the northwest, toward the position angle, so that pole is taken as the near one.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
