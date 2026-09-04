# Moon source and preparation record

The Moon is a first-class cssEarth object. It is not mounted inside Earth.

## Surface

- NASA Scientific Visualization Studio CGI Moon Kit colour map, prepared from
  LRO/LROC and LOLA data: <https://svs.gsfc.nasa.gov/4720/>
- Checked input: `source/surface/lroc-color-2k.jpg`
- The preparation step packs the equirectangular source into retained
projective latitude bands and a prepared polar atlas. Runtime performs no
geometry or raster preparation.

## Observation lenses

- NASA GSFC Scientific Visualization Studio LRO/LOLA global elevation map:
  <https://svs.gsfc.nasa.gov/4014/>
- NASA GSFC Scientific Visualization Studio GRAIL crustal-thickness map:
  <https://svs.gsfc.nasa.gov/4014/>
- Checked inputs: `source/lenses/lola-topography-print.jpg` and
  `source/lenses/grail-crustal-thickness-print.jpg`
- The surface, topography, and crust lenses are separately prepared into the
  same retained projective-band and polar-atlas topology. Runtime only selects
  already-prepared textures.

## Physical and orbital facts

- NASA JPL Solar System Dynamics satellite physical parameters:
  <https://ssd.jpl.nasa.gov/sats/phys_par/sep.html>
- NASA JPL Solar System Dynamics satellite mean elements:
  <https://ssd.jpl.nasa.gov/sats/elem/sep.html>
- The checked `source/orbit/moon.json` records the extracted Moon values and
  exact authority-page hashes.

## Scene and sky

- The retained globe configuration is checked from OpenSpace commit
  `56e29b54b8592084ff1fef47c2e08de0b22ce516`.
- The cubic sky is prepared from ESO/S. Brunier's Milky Way panorama under
  CC BY 4.0. HYG v4.1 coordinates are used only for registration auditing.
- The directional Sun uses the repository's clean-room, retained-billboard
  preparation standard at a mean heliocentric distance of 1 AU.

## Qualification

The standalone Moon is a source-backed retained-DOM presentation. Its mean
heliocentric distance is catalogued as 1 AU for navigation. It is not an
epoch-specific ephemeris and does not claim native camera parity.
