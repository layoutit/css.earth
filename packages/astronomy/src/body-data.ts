/**
 * Physical data for the bodies this package places.
 *
 * Values come from JPL Solar System Dynamics. Most are transcribed from
 * Horizons' `OBJ_DATA` block, fetched with
 * `format=text&COMMAND='<code>'&OBJ_DATA='YES'&MAKE_EPHEM='NO'`. The added
 * Saturn moons use JPL's current satellite physical-parameters table
 * (`https://ssd.jpl.nasa.gov/sats/phys_par/`), which publishes the selected
 * ephemeris GM and IAU WGCCRE mean radius together. They are transcribed rather
 * than parsed because the physical-data blocks are free text whose layout
 * differs per body — a parser for them would be a second thing to get wrong.
 *
 * `meanRadiusKm` is the volumetric mean radius where Horizons gives one, and
 * the geometric mean of the triaxial radii where it gives only those (Phobos,
 * Deimos, Miranda, Ariel). It is NOT the equatorial radius: it is used for the
 * frame-capture rule, where the right question is "how big is this body", not
 * "how wide is it at the equator". A renderer that needs the ellipsoid needs
 * three numbers and should not get them from here.
 */
export { BODIES } from './data/generated/bodies.js'
