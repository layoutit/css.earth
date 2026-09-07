# Magellanic simulation ↔ SMASH registration research

Read 2026-09-08. This note separates published facts from local derivations. It does not authorize a crop or an astrometric identity between simulated and observed stars.

## Primary sources read

- Garver et al. (2026), *Reproducing stellar structures in the Magellanic Clouds using a genetic algorithm with N-body simulations*: https://doi.org/10.1093/mnras/stag1287 (open-access HTML: https://academic.oup.com/mnras/article/550/3/stag1287/8732239).
- Dryad v2 dataset record and README: https://doi.org/10.5061/dryad.1vhhmgr82 and https://datadryad.org/dataset/doi:10.5061/dryad.1vhhmgr82. The README content is embedded in the public landing page; the anonymous individual-file endpoints returned 401/403. README file metadata: id 4645487, 2,934 bytes, SHA-256 `143e0623f2b361477e8765296a35b9178fa9568e56ab1470d00c22a428cda222`.
- NOIRLab LMC image page and pinned original TIFF: https://noirlab.edu/public/images/noirlab2030a/ and https://noirlab.edu/public/media/archives/images/original/noirlab2030a.tif.
- AVM 1.2 reference table for coordinate conventions: https://www.virtualastronomy.org/AVM_12_ref_table_rlh02_print2.pdf.

## Published simulation facts

- Dryad describes a 2.5 Gyr PKDGrav run, snapshots every 20 Myr, with filename steps of 5 Myr. `run34681lsmcgabestModelA_HR.00440` is therefore the 2.2 Gyr snapshot. Its Tipsy header `timeRaw=3.2` is not documented as Gyr and must remain uninterpreted.
- README units: positions kpc; velocities km/s; mass unit 2.32×10^5 solar masses; potential unit 9.98×10^-1 km²/s². Star-family ordering is MW 240,000, then LMC 1,620,000, then SMC 225,000. There are no gas particles in this released snapshot.
- Paper §4 says median particle positions and velocities are used for the LMC and SMC. “Current” is the snapshot nearest the LMC centre crossing `L_MS=0°`, with the Sun at `(X,Y,Z)=(-8,0,0) kpc` in the MW-centric frame.
- Paper §4.3 says that after a simulation the MW is centred and **all particles are rotated about the MW axis until the LMC lies at its observed angle in the x–y plane**. It does not publish the actual rotation angle, a numeric transformation matrix, a precise MW-centre estimator, code, or a per-snapshot WCS.
- Paper Table 2 gives rounded current centres (kpc): observed LMC `(-1.0,-40.9,-27.7)`, simulated LMC `(-1.0,-42.4,-25.3)`; observed SMC `(14.9,-38.1,-44.2)`, simulated SMC `(18.2,-34.6,-31.5)`.
- The paper compares projected simulation maps in the Nidever et al. Magellanic Stream coordinate system, but the Dryad deposit contains only Tipsy snapshots and a README. No published ready-to-apply sky-projection transform accompanies the bytes.

## Derived check against the released bytes

Direct medians of raw star records (kpc):

- MW: `(7.501954079, 64.324386597, 2.888671398)`
- LMC: `(3.607694149, 22.087850571, -22.465141296)`
- SMC: `(23.290157318, 28.379194260, -28.512485504)`

The LMC and SMC values reproduce the local import receipts. Medians combining each galaxy's star and dark families do not reproduce Table 2 as closely, so the following is a strong empirical reconstruction using **stellar** medians, not a published author constant.

1. Subtract the raw MW stellar median.
2. Apply the active row-major rotation about +z by `+3.916781113°`:

   `Rz = [0.997664315340, -0.068307495179, 0; 0.068307495179, 0.997664315340, 0; 0, 0, 1]`.

The angle is derived by matching the transformed LMC x–y direction to the rounded simulated LMC centre in Table 2. Results:

- LMC: `(-1.00009,-42.40390,-25.35381)` kpc
- SMC: `(18.20665,-34.78279,-31.40116)` kpc

The LMC result is close to the rounded table; the roughly 0.2 kpc SMC residual shows that this reconstruction does not reproduce every published component at its stated rounding. Because Table 2 is rounded to 0.1 kpc and the MW centring method is unstated, `+3.916781113°` is a reproducible overlap diagnostic, not the exact unpublished author rotation.

For a raw target particle `p`, the reconstructed MW-centric Galactic point is `p_gc = Rz × (p - MW_star_median)`. With the paper's Sun position, its heliocentric Galactic vector is `h_gal = p_gc - (-8,0,0) = p_gc + (8,0,0)` kpc.

The repository already pins the Hipparcos J2000 ICRS→Galactic convention in `src/platform/galactic-frame.mjs`. Its transpose maps Galactic vectors to ICRS:

`G_to_ICRS = [-0.0548755604162, 0.494109427876, -0.867666149019; -0.873437090235, -0.444829629960, -0.198076373431; -0.483835015549, 0.746982244497, 0.455983776175]`.

Thus `r_icrs_m = kpc_in_m × G_to_ICRS × h_gal`. To express that point in an existing object-local frame whose descriptor maps local to reference using origin `o`, quaternion rotation `Q`, and `metersPerUnit`, use `u_local = Q^T × (r_icrs_m - o) / metersPerUnit`.

This chain places the rounded simulated LMC centre near ICRS `(RA,Dec)=(88.0082°,-69.1260°)`, while Table 2's observed LMC centre maps near `(78.9163°,-68.9744°)`, a 3.25° angular mismatch. That mismatch is part of the model result and must remain visible in an honest full-field overlay; translating the simulated bar onto the photographic bar would erase it.

## NOIRLab TIFF AVM WCS

The pinned 6,737×6,536, 16-bit RGB TIFF embeds AVM 1.1 metadata with `Spatial.Quality=Full`:

- projection `TAN`, coordinate frame `ICRS`, equinox `J2000`
- reference sky value `(RA,Dec)=(78.7957840796°,-71.566506171°)`
- reference pixel `(3368.5,3268.0)` in the AVM/FITS bottom-left, 1-based convention
- reference dimensions `(6737,6536)`
- scale `(-0.00138784675876,+0.00138784675876) deg/pixel` = 4.996248 arcsec/pixel
- rotation `-16.920000000000027°`
- TIFF Orientation tag `1` (normal raster orientation)

AVM defines rotation as the position angle of the image Y axis, measured east (counter-clockwise on the sky) from north. Therefore `-16.92°` means the displayed upward axis is 16.92° west of north; the negative first scale means increasing RA/longitude is toward image-left. For top-origin raster row `y0`, the corresponding AVM pixel is approximately `(x0+1, height-y0)`.

The scale times the reference dimensions is about 9.350°×9.071° before TAN-projection effects. This TIFF is a publisher display composite with valid sky placement metadata, not calibrated per-pixel survey photometry.

## Consequence for full-distribution overlap

The defensible pre-processing diagnostic is:

1. retain the complete released LMC and SMC stellar distributions;
2. apply the reconstructed MW-centre, +z rotation, Sun offset, and standard Galactic→ICRS chain;
3. project each resulting ICRS ray through the TIFF's AVM TAN WCS;
4. compare a full-TIFF stellar-density projection against the untouched full TIFF, preserving the paper's model/observation centre mismatch;
5. only decide any later crop after the full-field footprint, handedness, north/east orientation, centre offsets, and overlap are visibly validated.

The current local `−34°` XZ rotation, `colorCenterKpc=(0.138536068,-1.648790306,0)`, and central-bar match are explicitly documented as authored placement. No primary source found supports them as an astrometric registration. They must not be used for the requested scientific overlap.
