# J004805.3-251745

## Sources

Comerón et al. (2003) found it far from the galaxy's disc, moving with the galaxy: either a runaway thrown out of the disc or a star born in the halo. The introduction is generated from Comerón et al. (2003), A&A 400, 137's published values; the sections below are the data's own.

**Star.** Placement: Comerón et al. (2003), A&A 402, 181, the erratum to Comerón et al. (2003), A&A 400, 137, which corrects the coordinates to 0h 48m 05.3s, -25° 17' 45" (J2000) and the name to J004805.3-251745, DOI 10.1051/0004-6361:20030311 row Object = J004805.3-251745, RA = 00:48:05.3, Dec = -25:17:45; placed by that row, not by a Gaia source, distance 3,467,369 pc from At NGC 253's own distance, 7,351 pc from its centre on the sky: the star is in the galaxy's halo, its sight line does not cross the disc there, and its depth along that line is not measured (Comerón et al. (2003), A&A 400, 137 also take the galaxy's distance for it). The galaxy's distance: RadburnSmith2011ApJS..195...18R: The GHOSTS Survey. I. Hubble Space Telescope Advanced Camera for Surveys Data (https://ui.adsabs.harvard.edu/abs/2011ApJS..195...18R); catalogue reference RadburnSmith2011ApJS..195...18R: 3467368.50453 pc (-109992.362096/+113595.866501); trgb. Radius 24 +/- 15 solar radii from Comerón et al. (2003), A&A 400, 137, section 3.1: L = 2.6 x 10^4 L_sun (Delta log L = 0.4, at the paper's distance of NGC 253, 2.6 Mpc) and T_eff = 15,000 K (about +/- 3,000 K), through L = 4 pi R^2 sigma T^4 with the nominal solar 5772 K (IAU 2015 Resolution B3, Prsa et al. 2016, arXiv:1605.09788); the paper prints no radius, and no measurement of this star's size exists (https://doi.org/10.1051/0004-6361:20021909). Mass 12 solar masses from Comerón et al. (2003), A&A 400, 137, abstract and section 3.1: a mass of 12 M_sun, the initial mass that the evolutionary models of Meynet & Maeder (2000) give at its temperature and luminosity; not a dynamical measurement (https://doi.org/10.1051/0004-6361:20021909). Temperature 15,000 K from Comerón et al. (2003), A&A 400, 137, section 3.1: T_eff = 15,000 K, uncertain by about 3,000 K, from its B-V color through the color, temperature and bolometric correction relations of Castelli (1999). log g 2.76 from the mass and radius.

**Color.** A Planck spectrum at 15,000 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #b5c9ff. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 15,000 K and log g 2.76 (u1 0.168, u2 0.306): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-04 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from DOI 10.1051/0004-6361:20030311 and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** It is drawn at the radius its published luminosity and temperature give; its radius is not measured.
- **Not shown.** Its depth in the halo along the line of sight is not measured: it is drawn at the galaxy's distance.
- **Not shown.** Its luminosity is the paper's, computed at 2.6 Mpc; the app places NGC 253 farther.
- **Not shown.** Its mass is the initial mass evolutionary models give, not a measurement; the limb model is read at the gravity that mass and radius give.
- **Not shown.** SIMBAD holds it as EQ J004804.8-251749 at the coordinates the paper first printed, 8 arcseconds from the erratum's; McCollum (2019, RNAAS 3, 13) reports an infrared excess under that earlier name, which is not used here.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
