# Omega Centauri (NGC 5139)

Status: **evidence, registration check and a derived spherical emissivity profile only.
No baked volumetric result exists yet.** Baking is blocked by a lab-tooling gap, recorded
below and in `physical-evidence.json` (`no-3d-baking-baseline`). This is not a subject
registered in `subjects.json`: the project contract forbids fabricating a fallback scene,
and there is no prepared object here for the app to mount.

## What this object is

Omega Centauri is a globular cluster (~10 million stars, no diffuse gas). The lab's scope
explicitly covers it ("the globulars were nebulae until telescopes resolved their stars"),
baking its **integrated starlight** as an emission field because PolyCSS cannot render 10
million point sources. Any future viewer-facing label must call this integrated light, never
resolved stars.

**Star removal was not run and must not be run.** NOX star removal deletes stars as
contamination; here the stars are the entire emission. This recipe uses the same
explicit preservation treatment the skill already applies to non-stellar sources
(`AGENTS.md`, "Never erase a pulsar, wind knot or radio filament through stellar
removal"): the registered image is used directly as the diffuse input, with zero
extracted stellar residual, and that status is recorded rather than hidden.

## Source image

`eso1119b`, ESO VST/OmegaCAM, optical G/R/I (480/625/770 nm), native 14540x14540 px over
50.88' x 50.88' (0.2099"/px), CC BY 4.0, credit ESO/INAF-VST/OmegaCAM (A. Grado, L.
Limatola/INAF-Capodimonte Observatory). Already acquired and hash-pinned via
`labs/nebula/sources/reference-images.json`; libwebp cannot encode the 14540px original for
this crowded field at any quality, so the checked-in derivative is an 8192px-wide, 0.373"/px
WebP (`labs/nebula/sources/omega-centauri-vst.webp`). Angular scale must always be measured
from the native dimensions, never the derivative.

## Registration (`registration.json`)

The publisher's stated pointing center (RA 13:26:47.27, Dec -47:28:46.34, fetched live from
the ESO image page) agrees with the independently catalogued NGC 5139 center from SIMBAD (RA
13:26:47.28, Dec -47:28:46.1, ref 2010AJ....140.1830G) to 0.24 arcsec -- sub-pixel at the
native 0.21"/px scale. This is a whole-field pointing check, not a matched-star homography fit
against an external catalogue; no per-star astrometric residuals were computed in this
session, so the skill's full registration gate (METHOD.md step 2) is only partially satisfied.

## Method choice

The skill's method table (`nebula-lab/SKILL.md`) has five entries. The distinguishing fact
for this object is a **measured radial structural profile under an assumption of spherical
symmetry**, which is a different evidence shape than every other configured object:

- **Repaint** and **fixed-density finite region** are legacy/superseded and, like the
  simulation-guided path below, are only implemented against an existing N-body particle
  simulation (Magellanic Cloud only).
- **Axial symmetry** (Wenger tomography) fits an inclined, expanding, axisymmetric shell --
  the planetary-nebula geometry. Omega Centauri has no polar axis, no expansion, and is
  (to first order) spherical, not axisymmetric-with-inclination. Using this method would
  transfer M2-9's shell/expansion machinery onto an unrelated object, which the skill
  forbids.
- **Sampled / compiler** (`docs/sampled-volumes.md`) is the closest-sounding match ("qualified
  spatial tables, symmetry ... constrains real 3D structure from measurements"), but its only
  implementation (`packages/lab/src/server/workflows/sampled-prior/compile.ts`) hard-codes a
  two-component `ejecta`/`pwn` (pulsar-wind-nebula) mixture and torus/jet/ellipsoid analytic
  terms. That is Crab-specific physics, not a generic point-table loader; forcing a globular
  cluster through it would be exactly the "transfer another object's shell" mistake the skill
  warns against.
- **Two-scale finite emission** (`simulation-guided-finite-emission@1`) is named as "the
  current default for clouds and galaxies" and its own description -- `gain(x,y) x
  prior(x,y,z)`, broad shape from a prior, detail fitted from the image -- is the correct
  physical shape for this object: a spherically symmetric, radially declining light
  distribution (the prior) recoloured and detailed by the actual photograph (the image). This
  is the method I chose.

**Why sphericity is the right assumption to make explicit, and Abel inversion is the right
tool:** for a spherically symmetric source, the projected (2D) surface-brightness profile
determines the 3D emissivity uniquely via the Abel transform -- no extra depth assumption is
needed, unlike every other object in this lab where an image alone cannot see depth. The real,
measured departure from that assumption is Omega Centauri's flattening (ellipticity
~0.08-0.19 depending on radius and source, White & Shawl 1987 and later work; it rotates).
That flattening, not an invented shell or expansion law, is the honest limitation carried
through this recipe.

## The derived profile (`king-abel-profile.json`, `king-abel-derivation.mjs`)

1. Adopted the single-mass King (1962) empirical projected-density law as the profile family
   (`physical-evidence.json` id `king-profile-family`).
2. Fixed its core radius to the measured 3D core radius, 4.54 pc (approximation A -- no
   independent photometric King fit for Omega Centauri was located in this session, so the 3D
   and projected core radii are treated as equal).
3. Solved for the concentration (`rt/rc`) so the profile's projected half-light radius equals
   0.75 x the measured 3D half-mass radius, 0.75 x 10.42 = 7.815 pc (approximation B, a
   standard projected/3D half-light scaling of the Wolf et al. 2010 type). This gives
   `rt/rc = 10.221` (`log10 c = 1.01`), tidal radius 46.4 pc.
4. Abel-inverted the resulting `Sigma(R)` numerically (`rho(r) = -(1/pi) integral_r^rt
   dSigma/dR / sqrt(R^2-r^2) dR`, via the standard `R = sqrt(r^2+u^2)` substitution) on a
   201-point radial grid. Convergence was checked at 2,000/8,000/32,000/128,000 quadrature
   points per radius; the tabulated 20,000-point values agree with the 128,000-point values to
   better than 6 significant figures everywhere sampled.
5. Result: a centrally peaked, monotonically declining relative emissivity (1 at r=0, 0.32 at
   the core radius, 0.070 at the half-mass radius, ~0 by the tidal radius). See the table for
   the full 201-point radius/emissivity pair list.

This profile is classified `published-model` in the evidence ledger: it is a deterministic,
non-object-specific mathematical consequence of measured/published structural numbers plus a
standard textbook profile family, not an authored shape. The two approximations that fix its
two free parameters (A and B above) are each individually flagged `authored`/`published-model`
and are small compared to the sphericity assumption itself.

## What is authored, and what could not be sourced

- **Authored:** treating the 3D core radius as the projected core radius (approximation A);
  using the Wolf-type 0.75 projected/3D half-light ratio instead of an Omega-Centauri-specific
  value (approximation B); the display-only peak normalization of the emissivity table.
- **Could not source in this session:** an independent photometric King-model fit (projected
  core radius, concentration) specific to Omega Centauri -- I did not find or fetch one, so I
  built the profile from the given 3D structural radii instead of overriding them with an
  authored concentration value. I also did not re-fetch the Baumgardt & Hilker (2018) or
  Baumgardt et al. (2021) papers themselves; their quoted numbers are taken from the task brief
  and were not independently re-derived from primary tables.
- Total mass, M/L and central velocity dispersion are recorded in the ledger but unused by this
  light-only recipe; they matter for the mass-segregation caveat (light and mass radii can
  differ) but are not needed to bake a display emission field.

## Why there is no baked result (the blocker)

The two-scale method's only current implementation
(`packages/lab/src/cli/commands/simulation-guided-reconstruction.ts`) requires a `baselineId`:
a pre-existing, completed `.local/nebula-lab/reconstructions/<id>` fixed-density reconstruction.
Producing that baseline requires the subject to already carry a `density`-type configuration
(`subject.density.overlays` and `.processingPlan`, checked in
`server/services/density-reconstruction.ts`), which in turn is only ever built from an N-body
stellar-particle simulation via `prepare-full-density.ts` (its recipe format is Magellanic
Cloud-simulation-specific: paper-frame rotation, MW center subtraction, a centered-particle
`.f32` file). No such simulation exists, or should be authored, for a globular cluster --
inventing an N-body model of Omega Centauri to satisfy this dependency would be exactly the
kind of fabricated evidence the skill forbids.

The `sampled-prior` compiler path is Crab-specific (see Method choice above) and the
general-purpose `compile-nebula` image-only compiler does not currently accept a
spherically-symmetric radial-profile depth scaffold at all -- only an image-only isotropic
halo tied to the image's own second moment (which would silently discard this profile), a
velocity scaffold, or an irregular height-surface recipe (Orion/Carina's illuminated-front
geometry, also the wrong shape for a sphere).

Closing this gap needs either (a) a small, generic addition to the two-scale path so an
analytic/tabulated spherical prior can supply its own frame/bounds without an N-body baseline,
or (b) a new compiler depth-scaffold kind for a measured radial profile. Both are new lab
capabilities, which this task's brief explicitly excluded ("No new tools"). I stopped here
rather than either fabricating a baseline simulation or forcing this profile through a
mismatched schema.

## Known problems

- No baked reconstruction, hence no front/oblique/side inspection and no X/Z or Y/Z handoff
  check could be performed.
- Registration is a whole-field pointing check only, not a matched-star fit.
- Sphericity is known to be wrong at the ~10-20% flattening level; this profile cannot
  represent that.
- The King concentration was solved from two 3D dynamical-model radii via an approximate
  projected/3D scaling, not fit directly to photometry.
