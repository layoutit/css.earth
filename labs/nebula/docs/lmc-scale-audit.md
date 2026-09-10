# LMC registration and scale audit

2026-09-10. Diagnostic only: no model, image placement, saved appearance or app scale changed.

## Finding

The visible jump is real, but a uniform size multiplier is not supported by the checks. We promoted a simulated stellar-density model without registering its final world placement/morphology to the observed LMC. The panorama and prepared cloud also use different display transfer and assumed depths.

1. **Projection math passes.** All 144 actual prepared slice centres, including their CSS transforms and real LMC world frame, were compared with independent ICRF quaternion and pinhole calculations. Maximum volume error: 0.000037 screen pixels; sky-direction error: below 0.000000002 pixels. Geometry rounding is below 0.0000015 kpc. This rules out an axis swap or uniform scale error in this source-view projection. It is not a photometric or all-view visual-quality guarantee.
2. **The model really is offset.** The full 1,620,000-particle model has a local median near (2.836, -0.125, 0.260) kpc relative to the catalogue anchor. The paper explicitly reports its best-fit LMC centre 2.8 kpc away from observation (section 5.1), matching what we imported. It also reports different simulated/observed ring position angles (section 5.2). These are model/observation differences, not a measured sky registration.
3. **Physical units are consistent.** The observer transform has unit singular values: it rotates/translates without stretching. The source-view projected half-mass radius is 2.735 kpc, compared with the checked catalogue half-light radius 2.783 kpc. Mass and light are different; this is a rough scale sanity check only. Ninety percent of particle mass lies within projected radius 8.33 kpc, 99 percent within 12.71 kpc. The approximately 62 × 61 × 27 kpc full grid includes distant low-density particles and padding; it is not the luminous galaxy diameter.
4. **Our display does not match the sky.** With one Solar observer, a 60-degree horizontal field and stars disabled, displayed peak luminance is 20.14/255 for the panorama, 149.83 for VISTA, 195.50 for Horálek and 187.95 for WISE. That is approximately 7.4–9.7 times brighter in encoded display luminance, not physical radiance. The cloud's bright centre is about 63 screen pixels (~2.9 degrees) from the panorama's bright centre. Its low-signal envelope becomes much more apparent. Saved image fits include scale 3; these authored simulation fits are distinct from the verified image-to-image star registration.
5. **The panorama depth is approximate.** Its retained cube has face distance 20 kpc (about 21.4 kpc along the LMC direction), whereas the LMC catalogue distance is 49.59 kpc. Its parallax therefore differs from the actual cloud during travel. The global Milky Way fade currently drives LMC visibility too; it does not establish an LMC-specific matched handoff.

## Evidence

- [Garver et al. 2026, sections 5.1–5.2](https://arxiv.org/html/2602.05021v1#S5.SS1): explicitly reports the LMC position residual and ring-orientation difference. The simulation is a plausible dynamical prior, not an exact registered replica of observed light.
- [Dryad dataset](https://doi.org/10.5061/dryad.1vhhmgr82): particle family/index selection matches the published data documentation.
- [NASA Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/): ICRF sky directions, including the Magellanic Clouds; the background omits bright Hipparcos/Tycho stars but retains faint Gaia stars. NASA does not provide the 20 kpc display depth; that is our approximation.
- [ESO VISTA original](https://www.eso.org/public/images/eso1914a/): 461.90 × 515.88 arcminute field (7.70 × 8.60 degrees), with published position and orientation. Its footprint is not the full stellar envelope.

The checked measurements are in `lmc-scale-audit.json`. Scripts, raw same-camera screenshots and detailed metrics remain in the extragalactic checkout's ignored `.local/nebula-lab/lmc-scale-check/` directory. The successful comparison mounted the actual sky/cloud renderer modules at one common physical observer, independent of the app's focused-body camera adoption. Earlier attempts to drive that pose through the app controller were rejected; they are not counted as successful app-transition tests.

## Next correction, before increasing resolution

1. Define an explicit observation-to-model display registration. Preserve the original simulation and physical units; distinguish its centre/orientation residual from catalogue astrometry. Choose observed centre, orientation and angular landmarks as constraints.
2. Reconcile cloud and stellar mapping together. Preserve catalogue IDs and measured sky coordinates; do not independently drag stars, image skins and cloud until screenshots happen to agree. Review the authored scale-3 fits after the world registration is established.
3. Fit a common source-view display profile: bright core, outer-light falloff and visible extent. A mass-density inspection stretch is not calibrated surface brightness. Keep infrared and optical lens treatments explicit.
4. Give the LMC a matched sky/cloud transition, accounting for its own distance. Keep the Milky Way sky shell approximation from imposing the wrong parallax on a distant galaxy.
5. Accept only after fixed-camera landmark/extent comparison and continuous departure/approach show no position, orientation, apparent-size or brightness jump. Recheck oblique views separately; this does not solve the existing slice-stability limits.
