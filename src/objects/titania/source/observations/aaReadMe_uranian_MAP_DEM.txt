Uranian Satellite Global Mosaics and Digital Elevation Models, Paul Schenk, 2020.

Contents:

Global mosaics from Voyager 2 images are produced using updated control networks and updated CK files are provided for each moon. They are produced at their native resolution which is different for each moon and can be read directly from the mosaic headers.

Elevation values are in kilometers in both, referenced relative to the published triaxial ellipsoid shapes of the bodies (Thomas, 1998), which are recorded in the cube labels.  DEM data derived from photoclinometric analysis of the images is merged on top of the more extensive stereogrammetric data for Ariel and Miranda. Titania data are from stereogrammetry alone. Limb profile data [Thomas, 1998) for Titania and Ariel are included in the DEM data.  For Oberon and Umbriel the limb data are in their own DEM cube, although limb data are referenced to an older control network and may be off position by a few degrees.

Global mosaic and topographic data for Titania, Ariel and Miranda are provided in the form of ISIS3 cubes and browse JPEG files (geotiffs may be added later).  File naming conventions are as follows:
audem = aRIELuRANUSdem
oumap = oBERONuRANUSmap-mosaic
-mos = image mosaic
-Z = steregrammetric DEM
-T = photoclinometric DEM
-L = digitized limb profile data
-ZT = merged photoclinometric & steregrammetric DEM
-spole = polar stereographic (all others are simple cylindrical)


All image-derived DEM data are subject to uncertainties or anomalies (although every effort was made to mitigate data noise or distortions [Schenk and Moore, 2020]).  DEMs based solely on photoclinometry (-PC) have been processed so that long-wavelength components have been suppressed (see Schenk and Moore, 2020), though those are not included in this dataset.


Users are *strongly* encouraged to contact the author for guidance in the proper and appropriate use of these data prior to analyses or the writing of proposals.
#
Contact:
Paul Schenk, Lunar and Planetary Institute.
schenk@lpi.usra.edu


Reference:
Schenk, P., and J. Moore, 2020, Topography and Geology of Uranian Mid-sized Icy Satellites in Comparison with Saturnian and Plutonian Satellites, Phil. Trans. Royal Soc. A, in press, 2020.

For limb profile production done earlier, see:
Thomas, P.C., 1988. Radii, shapes, and topography of the satellites of Uranus from limb coordinates. Icarus 73, 427-441.
