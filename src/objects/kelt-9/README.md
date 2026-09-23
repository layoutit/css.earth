# KELT-9

## Sources

KELT-9 (HD 195689) is a hot A star, about 10,000 K and 2.5 solar masses, 207 parsecs away. It spins so fast that it bulges at the equator, and its poles are hotter and brighter than its equator. Its planet, [KELT-9b](../kelt-9b/README.md), crosses the star over its poles, so its transit dims the star unevenly. Ahlers et al. (2020, [AJ 160, 4](https://doi.org/10.3847/1538-3881/ab8fa3); [arXiv:2004.14812](https://arxiv.org/abs/2004.14812)) fitted that uneven TESS transit with a flattened, gravity-darkened star. Their fit sets the star's shape, shading and spin axis here.

- **Placement:** Gaia DR3 source 2064327278651198336 (`source/photometry/gaia-dr3-source.csv`): position at J2016.0, parallax 4.8258 ± 0.0248 mas (207.2 pc, no zero-point correction), proper motion and radial velocity.
- **Shape:** the equator is 2.39 ± 0.03 solar radii (Table 2) and 1.089 ± 0.017 times the pole (abstract). The outline is the equator, and the geometry's polar radius is 248/1.089 units. The record's radius is the volume-equivalent sphere, 2.323 solar radii, which KELT-9b's orbit is measured against. The table's oblateness, 0.089, read as 1 − R_pole/R_eq, would be a ratio of 1.098; the abstract's 1.089 is used.
- **Colour:** the Gaia DR3 BP/RP sampled spectrum through the CIE 1931 2° observer, the route [HD 181327](../hd-181327/README.md) uses: sRGB (181, 201, 255).
- **Gravity darkening:** the colour is shaded by latitude with the Roche–von Zeipel model of [Alderamin](../alderamin/README.md) and the other fast spinners ([gravity-darkening.mts](../../../tools/objects/observation/gravity-darkening.mts)). The inputs are the paper's radius ratio, its fitted exponent β = 0.137 ± 0.014 and the pole at 10,170 K. That polar temperature is Gaudi et al. (2017)'s, which the paper adopts. The paper gives no ω and no equatorial temperature. The Roche surface with a 1.089 ratio has ω = 0.682, and its equator comes out at 9,672 K, 10 % dimmer than the pole in the TESS band. The record is [gravity-darkening.json](source/photometry/gravity-darkening.json).
- **Limb:** the quadratic law Claret (2017, A&A 600, A30) computes from PHOENIX models for the TESS band, read at Gaudi et al.'s 10,170 K and log g 4.093: u1 0.159, u2 0.250. Ahlers et al. started their fit from the same grid's coefficients (0.1588, 0.2544 at 10,200 K, their Table 1). A model, stated as one.
- **Spin axis:** [rotation.json](source/preparation/rotation.json), `cssearth-measured-obliquity-pole@1`, builds the pole against KELT-9b's orbit from λ = −88° and a stellar inclination of 52° in the paper's convention (0° equator-on), 38° from the line of sight. The star turns in 16 hours (Table 2). With the orbit's 86.79° these give a true obliquity of 86.2°, inside the paper's 87 +10/−11°.

Catalogue colour: #b5c9ff, this lens's prepared colour.

## Evidence

Run of 2026-09-23 (this version):

- [`gravity-darkening.test.mts`](../../../tools/objects/observation/gravity-darkening.test.mts) checks that the Roche surface built from the record has the paper's 1.089 ratio and 2.39 solar-radius equator. It fixes the model's equator at 9,672 K, 10.4 % dimmer at 800 nm and 18 % bolometrically, and keeps the paper's own contrast statements beside it.
- [`authored-rotation.mts`](../../../tools/objects/authored-rotation.mts) refuses the rotation record unless λ, i* and the orbit's inclination give the published true obliquity within its uncertainty.
- [`object-package-consistency.test.mts`](../../../tools/contract/object-package-consistency.test.mts) checks that the catalogue colour is the colour lens's prepared colour.

## Known problems

- **The equator is cooler in the paper's text than in this model.** The paper says the temperature varies by about 800 K (Figure 2 caption) or nearly 1,000 K (section 2), and the surface brightness by about 38 % (abstract). Its table's numbers in the Roche–von Zeipel model give about 500 K and 10 % in the TESS band. The paper uses its own gravity model (Ahlers et al. 2016, second order with a centrifugal term) and Darwin–Radau oblateness, which it does not publish as code. The shading drawn here is therefore gentler than the paper describes.
- **Which pole faces Earth is not measured.** A stellar inclination of 38° and of 142° fit alike; the record uses the first.
- **The axis's direction on the sky is a convention.** It is placed against KELT-9b's orbit, and the orbit's position angle on the sky is not measured by transits.
- **The star is unresolved.** It is 0.1 mas across. The shading comes from a transit fit and the limb from a model; no image exists ([ledger](investigations.json)).
- **Pulsations are not drawn.** Wong et al. (2020) and Mansfield et al. (2020) find a 7.6-hour stellar variation of about 100 ppm.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
