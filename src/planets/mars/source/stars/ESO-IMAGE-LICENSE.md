# ESO Milky Way panorama source record

The Mercury photographic starfield uses the 6000 x 3000 public equirectangular
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
single-epoch Mercury sky. The prepared Mercury scene therefore uses the image
as a source-qualified visual background, not as an observer-epoch or ephemeris
claim.

The preparation pipeline adapts the published equirectangular panorama into
six retained CSS cubemap faces and applies documented luminance levels. It does
not add or bake a Sun. The complete ESO credit is exposed in Mercury's source
resources.
