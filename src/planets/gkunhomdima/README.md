# Gǃkúnǁʼhòmdímà

## Sources

[Proudfoot et al. (2026), accepted PSJ](https://arxiv.org/abs/2605.28636) combines
an occultation silhouette with the satellite orbit to constrain a smooth Maclaurin
model: semiaxes 329, 329 and 294 km. Checked 2026-09-09. This distant dwarf-planet
candidate has no resolved local terrain; the grid marks unmapped surface.

## Evidence

The [three-body qualification](../../../docs/trans-neptunian/qualification.json)
and [production browser record](../../../docs/trans-neptunian/browser-validation.json)
retain their [original build identities](../../../docs/non-belt-populations/README.md#evidence-identity). All three routes passed at DPR 1 and 2;
those captures predate the combined population build.

The recorded scene has 480 native body triangles, with Shadows and Orbit off.
[Inspected default view](../../../docs/evidence/trans-neptunian/gkunhomdima-default.png).

## Known problems

- The model assumes the satellite orbit is equatorial. A slightly triaxial fit is
  also compatible with the observations.
- The 11.05 h photometric period has aliases and is not installed as a qualified
  sidereal spin. The pole and arbitrary meridian do not establish a precision surface attitude.
- No reconstructed surface texture is supplied; the smooth model does not resolve terrain.

[Inputs](source/manifest.json) · [Preparation](source/preparation/terrestrial.json) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Occultation, satellite-orbit assumptions and orientation</summary>

The published Maclaurin spheroid has semiaxes 329, 329, 294 km. It assumes the
satellite orbit is aligned with the equator. The source also permits a slightly
triaxial fit; the adopted smooth shape is a constrained model.

The J2000 pole prior is RA 20.6 ±1.5°, DEC 46.25 ±0.32°, from satellite-orbit
alignment. The reference meridian is arbitrary. The 11.05 h photometric period
has aliases, so no qualified sidereal spin or absolute surface attitude is claimed.

Source recipes pin units, assumptions and numerical axes. Geometry is prepared
before runtime and uses 480 native raster triangles. Shadows and Orbit default off.

## Source survey

Satellite-orbit alignment and the competing triaxial interpretation remain
unresolved. Rotation-period aliases prevent an absolute surface-attitude claim.
Surface spectra and unresolved observations are not reconstructed surface textures.

[Family source and preparation account](../../../docs/trans-neptunian/README.md).

</details>
