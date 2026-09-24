# Eris

The [navigation marker](source/preparation/navigation.json) retains the existing schematic silhouette and whole-disc color, with prepared full-phase curvature shading. This display cue does not add surface features or change the source shape ratio.

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

No image resolves Eris's surface. At about 96 AU its disc spans about 0.034 arcsec, two diffraction widths of an 8 m telescope. The Color lens shows one colour for the whole body, computed from photometry of the unresolved disc:

| Quantity | Value | Source |
| --- | --- | --- |
| B−V, V−R, V−I | 0.823 ± 0.023, 0.391 ± 0.023, 0.777 ± 0.013 mag | [Carraro et al. (2006)](https://doi.org/10.1051/0004-6361:20066526), A&A 460, L39, section 4 ([arXiv:astro-ph/0610619](https://arxiv.org/abs/astro-ph/0610619)) |
| V geometric albedo | 0.96 +0.09/−0.04 | [Sicardy et al. (2011)](https://doi.org/10.1038/nature10550), Nature 478, 493, abstract |
| Solar B−V, V−R, V−I | 0.653, 0.356, 0.701, each ± 0.003 mag | [Ramírez et al. (2012)](https://doi.org/10.1088/0004-637X/752/1/5), ApJ 752, 5, abstract (line-depth-ratio solution) |
| B, V, R, I effective wavelengths | 438.1, 544.5, 641.1, 798.2 nm | [SVO Filter Profile Service](http://svo2.cab.inta-csic.es/theory/fps/index.php?mode=browse&gname=Generic&gname2=Bessell), Generic/Bessell, checked 2026-09-16 |

The values are transcribed in [the colour record](source/photometry/disc-color.json). Carraro et al. measured over five nights in 2005 and found V−R stable from night to night. The [CIE 1931 2° colour-matching functions](https://doi.org/10.25039/CIE.DS.xvudnb9b) and [CIE standard illuminant D65](https://doi.org/10.25039/CIE.DS.hjfjmt59) are kept unchanged in [source/reference](source/reference); their sha256 values equal the checksums in CIE's dataset metadata.

The radius is 1,163 ± 6 km from the November 6, 2010 stellar occultation reported by Sicardy et al. (2011). That event is consistent with a spherical body. The render sphere uses the nominal radius; it does not claim a resolved shape mesh.

The Illustration lens is not an observation. It shows the base-colour texture of NASA's [Eris 3D Model](https://science.nasa.gov/resource/eris-3d-model/), credited to NASA Visualization Technology Applications and Development (VTAD). The original GLB is pinned in [the manifest](source/manifest.json) (4,398,964 bytes); on 2026-09-18 NASA's server still returned the same size, last modified 2024-10-19. The resource page gives only a one-line description and the credit; it does not say how the texture was made. Because no image resolves Eris, its terrain, albedo pattern and colour are the artist's. Preparation carries the texture through the model's own texture coordinates onto the displayed sphere and does not repaint it. The map's left edge is the texture's own 0° column, so its longitudes are arbitrary. Color stays the default lens. The illustration is listed in the package's illustration lenses, so it never counts as imagery: Eris stays "Shape only". NASA content is generally not subject to copyright in the United States and is credited to NASA ([NASA's terms](https://www.nasa.gov/nasa-brand-center/images-and-media/)).

## Scene position

Eris's scene position comes from the **direct JPL Horizons geometric state at the fixed 2026-09-03 TT scene epoch**, not from propagating its own osculating elements. This is how every parent with a moon is placed: the shared solar geometry takes the primary's heliocentric state from the moon's retained Horizons response. Haumea is placed the same way from [Hi'iaka's `haumea-epoch.txt`](../hiiaka/source/orbit/haumea-epoch.txt), and Sylvia from [Romulus's `sylvia-heliocentric.txt`](../romulus/source/orbit/sylvia-heliocentric.txt). Eris's response lives in its moon's package, [`dysnomia/source/orbit/eris-epoch.txt`](../dysnomia/source/orbit/eris-epoch.txt), byte-pinned in that package's [source manifest](../dysnomia/source/manifest.json) and described in its [epoch state record](../dysnomia/source/validation/epoch-state.json). Eris keeps its own `dwarfPlanet` element block for its orbit line, exactly as Haumea does.

Adding Dysnomia moved Eris by **92,802 km**. That is 80 Eris radii, but only **6.5 × 10⁻⁶ of its 95.465 au heliocentric distance**, about 1.3 arcsec seen from the Sun, or 11 hours of its 2.35 km/s orbital motion. The earlier position came from elements osculating at JD 2461041.5 propagated 245 days; the direct state needs no propagation, so it is the more accurate of the two. Shape, size, material, lenses, text and datasets are unchanged by this; only the world frame and the values derived from it moved.

## Evidence

Run of 2026-09-18 (this version): preparation added the Illustration lens and dropped the 35 unused 1x files. The 36 files kept, including every Color lens image, are byte-identical to the previous pins. Discovery is unchanged: no imagery, not illustration-only. Measured this session, the illustration's area-weighted mean colour is sRGB 201, 192, 190 (#c9c0be) against the measured #fffaea; its linear luminance is about 57% of the measured colour's.

Run of 2026-09-16: `node tools/prepare/prepare-object.mts eris` prepared the package with the Color lens. The prepared surface, pole and thumbnail WebPs decode to 255, 250, 234 on every opaque pixel. `node --test tools/objects/observation/disc-integrated-color.test.mts site/test/object-discovery.test.mts tests/objects/unit/runtime-package.test.mts tools/contract/object-package-consistency.test.mts tools/investigations/investigation-ledger.test.mts` passes. The page at `/eris/` renders the Color lens with no console errors; the disc centre in the [default-view capture](source/reference/rendered-default-view.png) is 255, 250, 234.

Measured sensitivity, with the same method: B−V − 0.023 gives 255, 250, 237 and V−R − 0.023 gives 253, 249, 235. The MBOSS mean of 64 epochs (B−V 0.805, V−R 0.389, V−I 0.792) gives 255, 250, 236. The albedo's lower bound, 0.92, gives 250, 245, 230.

## Known problems

- The colour sits at the top of the sRGB range: linear red is 0.999. B−V + 0.023, V−R + 0.023 or an albedo of 1.00 would put red above 1, and the method refuses such a colour instead of clipping it. Within the published uncertainties Eris may be brighter or redder than the display can show.
- The colour assumes a straight-line spectrum between the four filter wavelengths, continued with the B−V slope below 438 nm. The effective wavelengths are SVO's values for Vega, not for Eris's spectrum. The error this adds is not verified against a measured visible spectrum.
- The texture value is scaled to the V geometric albedo (0.96). The rendered disc brightness under the shared lighting is not checked against that albedo.
- The Illustration lens is darker than the measured whole-disc colour (see Evidence). The illustration is shown as NASA published it; no colour is corrected.
- The 2005 colours include light from the unresolved moon Dysnomia, which Carraro et al. put at about 0.02 mag. The occultation albedo does not include it. No correction is applied.
- A uniform colour hides any albedo pattern; none has been mapped.
- Rotation content uses the 15.771 ± 0.008-day photometric period of [Bernstein et al. (2023)](https://arxiv.org/abs/2303.13445), consistent with synchronous rotation at Dysnomia's 15.78590-day orbital period. This supersedes the 25.9-hour value still present on NASA's overview. The body has no measured longitude origin or established spin-pole registration. Its display pole and meridian are explicitly arbitrary, and no absolute rotational ephemeris is animated. The existing vendored JPL elements determine orbital position at the shared preparation epoch.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

<details>
<summary>Methods and source notes</summary>

The retained surface uses a 16 × 32 grid with prepared polar caps: 452 body quads plus one lighting quad (453 total), below the 2,000-quad budget. No runtime source parsing or rasterization.

The `disc-integrated-color` science kind ([disc-integrated-color.mts](../../../tools/objects/observation/disc-integrated-color.mts)) turns each colour index minus the solar index into reflectance relative to V: B = 10^(−0.4 Δ(B−V)), R = 10^(0.4 Δ(V−R)), I = 10^(0.4 Δ(V−I)), which gives 0.855, 1, 1.033 and 1.073. It joins those four points with straight lines, integrates reflectance × D65 × the CIE 1931 functions from 380 to 780 nm in 1 nm steps, divides by the D65 luminance, scales so V reflectance equals the albedo, and converts XYZ to linear sRGB with the IEC 61966-2-1 matrix. The result, linear 0.999, 0.952, 0.827 and sRGB 255, 250, 234 (#fffaea), fills the whole surface map. The prepared lighting applies the Sun's tint separately. The navigation marker and catalogue colour use the same value.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 1163 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 15.7710-day prograde rotation (Bernstein et al. (2023) photometric period from measurements.json; display orientation arbitrary (rotation.json)) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 20.00° initial pitch, -35.00° yaw, taken from the retired lane's camera). 

</details>
