# ESO Milky Way panorama source record

The Ganymede photographic starfield uses the 6000 x 3000 public equirectangular
image `eso0932a`, "The Milky Way panorama", released by the European Southern
Observatory on 14 September 2009.

- Image page: https://www.eso.org/public/images/eso0932a/
- Exact source: https://cdn.eso.org/images/original/eso0932a.tif
- Credit: ESO/S. Brunier
- License: Creative Commons Attribution 4.0 International
- License URL: https://creativecommons.org/licenses/by/4.0/
- ESO usage policy: https://www.eso.org/public/copyright/

ESO's image page identifies the supplied 18-megapixel file as a photographic
360-degree panorama covering the northern and southern celestial spheres. The
page notes that observations were made over several months, so Solar System
objects in the panorama are photographic capture artifacts rather than a
single-epoch Ganymede sky. The prepared Ganymede scene therefore uses the image
as a source-qualified visual background, not as an observer-epoch or ephemeris
claim.

The preparation pipeline adapts the published equirectangular panorama into
six retained CSS cubemap faces and applies documented luminance levels. It does
not add or bake a Sun. The complete ESO credit is exposed in Ganymede's source
resources.

## Astrometric registration (Ganymede)

The panorama is an equirectangular map in galactic coordinates. Its pixel
convention was measured on the image rather than assumed: galactic longitude
is 0 at the column centre and increases leftward (the sky seen from inside),
galactic latitude is +90 at the top row. Anchor blobs located in the 6000 x
3000 pixels: Large Magellanic Cloud (4367, 2028), Small Magellanic Cloud
(3995, 2206), Orion Nebula (5566, 1835), Andromeda Galaxy (1038, 1887),
Pleiades (272, 1920). The mosaic frame is rotated 3.8 degrees from the J2000
galactic frame; the fitted rigid correction is derived from these anchors in
`src/platform/eso-panorama-registration.mjs` and registers all five to within
0.3 degrees. The bright spiked point source near pixel (1848, 2472) matches no
star and is one of the Solar System objects ESO notes were captured during
the mosaic; it is not used as an anchor.
