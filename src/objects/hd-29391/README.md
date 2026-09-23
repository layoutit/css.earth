# 51 Eridani

51 Eridani is a young F0 star 30 parsecs away in Eridanus. In 2015 the Gemini Planet Imager found its giant planet [51 Eridani b](../hd-29391-b/README.md) (Macintosh et al. [2015](https://arxiv.org/abs/1508.03084)). Its object id is its Henry Draper number, HD 29391, because an id cannot begin with a digit.

## Sources

**Placement.** Gaia DR3 source 3205095125321700480 (Gaia Collaboration 2023, A&A 674, A1): position at J2016.0, proper motion, and the parallax 33.4390 ± 0.0777 mas (RUWE 1.15), inverted to 29.9052 pc with no zero-point correction ([source record](../../sources/gaia-dr3-hd-29391.json)). Gaia gives no radial velocity; the record takes 12.6 ± 0.3 km/s from Gontcharov (2006, AstL 32, 759), the value SIMBAD lists and Denis et al. (2026) adopt. SIMBAD gives the spectral type F0IV (Abt & Morrell 1995) and the cross-identifications HD 29391 and HIP 21547.

**Radius, temperature and mass.** The CHARA Array's limb-darkened angular diameter, 0.450 ± 0.006 mas (Elliott et al. 2024, PASA 41, e056; [arXiv:2401.01468](https://arxiv.org/abs/2401.01468)), at the Gaia distance: 1,006,594 km, 1.447 solar radii (Elliott et al. give 1.45 ± 0.02 with the zero-point corrected parallax). From the same work, 7,422 ± 58 K and the isochrone mass 1.550 solar masses.

**Rotation.** None is adopted; Sepulveda et al. (2022) find the star is a γ Doradus pulsator, which gives no direction on the sky. The display axis is celestial north at the star ([rotation.json](source/preparation/rotation.json)).

**No JWST picture yet.** The system card carries no telescope image. Our reduction of the raw JWST/NIRCam F410M frames of GTO 1412 with the [spaceKLIP toolkit](../../../tools/objects/jwst/klip/programs/hd-29391-1412.json), on the settings Balmer et al. (2025) state, finds the planet where they measured it but only 2.7 to 3.1 times above the scatter at its separation, against their 4.7, beside a four-lobed starlight residual; following their description of the first annulus more closely made it worse. The paper states 50 KL modes in its text and 150 in its figure, more than our 90 reference frames can give, so its reduction evidently differs from what it states. The attempt is in the [investigation ledger](investigations.json).

**Shape lens.** A sphere of that radius in the shared neutral gray. The star is 0.45 milliarcseconds across: CHARA measures its size, and no image of its surface exists.

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) places the planet, at this star's Gaia distance, 11 mas from where JWST measured it and moving as HiRISE measured (see [51 Eridani b](../hd-29391-b/README.md)).
- The system view, captured headless from the dev server of this version, with no console errors ([hd-29391-system.png](evidence/hd-29391-system.png)).

## Known problems

- The shape lens is gray: no colour of the star is cast.
- The radial velocity is a 2006 catalogue value; Gaia DR3 has none for this star.
- The wide binary companion GJ 3305 AB is not in the catalogue.
- The JWST picture of Balmer et al. (2025) is not reproduced, so the system card has none (above).

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
