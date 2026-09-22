# Vega

Vega is a rapidly rotating A-type star 7.68 parsecs away, wider at its equator than at its poles. Here it is a plain sphere of the same volume.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

Placement: the SIMBAD position, proper motion and radial velocity with the references SIMBAD gives, and the distance from the Hipparcos new-reduction parallax 130.23 ± 0.36 mas (van Leeuwen 2007) via SIMBAD. The package binds to the star the shared star field already draws through its Hipparcos number, so there is one Vega, not two.

Radius: Vega is a rapid rotator seen nearly pole-on: Monnier et al. (2012), ApJ 761, L3, measure an equatorial radius of 2.726 ± 0.006 and a polar radius of 2.418 ± 0.012 solar radii with CHARA/MIRC. The record's radius is the volume-equivalent sphere of those two, 2.62 solar radii. The scene draws the measured flattening: an ellipsoid with the equatorial radius on the outline.

Rotation: the measured axis. Monnier et al. (2012), ApJL 761, L3, Table 2, the concordance model, give an inclination of 6.2 ± 0.4° from the line of sight and a pole position angle of −58 ± 6° east of north; [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) turns them into the pole of [rotation.json](source/preparation/rotation.json), with the near pole up. The spin is not animated: the surface has no feature that would show it.

Colour lens: The colour of the Hubble Space Telescope's calibrated STIS spectrum of Vega, a CALSPEC flux standard. Its samples from 380 to 780 nm are weighted by the CIE 1931 2° observer and converted to sRGB with the D65 white, brightest channel full ([stellar-photometric-color.mts](../../../tools/objects/observation/stellar-photometric-color.mts)): **#b3c9ff**. The file, how it is read and the full citation are in [stellar-color.json](source/photometry/stellar-color.json). The disc is darkened toward its edge by the quadratic V-band law that Claret & Bloemen (2011, A&A 529, A75) compute from ATLAS model atmospheres, read at 9360 K and log g 3.93: the edge is 42% as bright as the centre. That law is a model, not a measurement of this star. Gravity: log g from the model mass 2.15 (+0.10/-0.15) solar masses of Monnier et al. 2012 (ApJL 761, L3; https://arxiv.org/abs/1211.6055), abstract and Table 2, and the package radius, log10(GM/R^2) in cgs; a mean over the gravity-darkened surface. The catalogue swatch, the minimap and the navigation marker use the same colour. [stellar-spectra/author.mts](../../../tools/objects/source-authoring/stellar-spectra/author.mts) writes the colours from these inputs, and `--check` recomputes them. Cross-check: Pulkovo spectrophotometric catalogue, HR 7001: ground-based scans, independent of Hubble gives #b8cdff, 5 levels from the lens colour in its most different channel (the threshold for agreement is 12).

Gravity darkening: the same fit gives the pole 10,070 ± 90 K and the equator 8,910 ± 130 K, from ω = 0.774 of break-up speed and β = 0.231 in T = T_pole (g/g_pole)^β. [gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts) rebuilds the Roche surface from those numbers; it reproduces the paper's equatorial radius and temperature within their errors and its surface-averaged 9,360 K ([gravity-darkening.test.mts](../../../tools/objects/observation/gravity-darkening.test.mts)). Each latitude row of the colour lens is the measured colour scaled by a Planck spectrum at that row's temperature against the surface mean, so the poles are brighter and bluer and the equator dimmer and warmer. The parameters and the quoted table cells are in [gravity-darkening.json](source/photometry/gravity-darkening.json).

## Evidence

Run of 2026-09-21 (this version):

- [`gravity-darkening.test.mts`](../../../tools/objects/observation/gravity-darkening.test.mts) checks the Roche model against the paper's equatorial radius and temperature.
- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour #b3c9ff is the colour lens's prepared colour and that the limb-darkening law is read at the recorded temperature and gravity; `node tools/objects/source-authoring/stellar-spectra/author.mts --check` recomputes the colour and marker from the pinned spectrum.

## Known problems

Vega is seen almost pole-on, so its outline is nearly round and the round limb plate fits it. The paper warns that the pole's position angle is fragile: fits to different nights differ by up to 90°. Because the pole faces us, that angle only turns the faint equatorial belt around the edge.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
