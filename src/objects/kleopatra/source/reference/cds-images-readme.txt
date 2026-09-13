J/A+A/653/A57           (216) Kleopatra images                  (Marchis+, 2021)
================================================================================
(216) Kleopatra, a low density critically rotating M-type asteroid.
    Marchis F., Jorda L., Vernazza P., Broz M., Hanus J., Ferrais M.,
    Vachier F., Rambaux N., Marsset M., Viikinkoski M., Jehin E., Benseguane S.,
    Podlewska-Gaca E., Carry B., Drouard A., Fauvaud S., Birlan M., Berthier J.,
    Bartczak P., Dumas C., Dudzinski G., Durech J., Castillo-Rogez J.,
    Cipriani F., Colas F., Fetick R., Fusco T., Grice J., Kryszczynska A.,
    Lamy P., Marciniak A., Michalowski T., Michel P., Pajuelo M.,
    Santana-Ros T., Tanga P., Vigan A., Witasse O., Yang B.
    <Astron. Astrophys. 653, A57 (2021)>
    =2021A&A...653A..57M        (SIMBAD/NED BibCode)
================================================================================
ADC_Keywords: Solar system ; Minor planets
Keywords: techniques: high angular resolution  -
          minor planets: asteroids: individual: 216 Kleopatra

Abstract:
    The recent estimates of the 3D shape of the M/Xe-type triple asteroid
    system (216) Kleopatra indicated a density of ~5g/cm^3^,
    which is by far the highest for a small Solar System body. Such a high
    density implies a high metal content as well as a low porosity which
    is not easy to reconcile with its peculiar "dumbbell" shape.

    Given the unprecedented angular resolution of the VLT/SPHERE/ZIMPOL
    camera, here, we aim to constrain the mass (via the characterization
    of the orbits of the moons) and the shape of (216) Kleopatra with high
    accuracy, hence its density. We combined our new VLT/SPHERE
    observations of (216) Kleopatra recorded during two apparitions in
    2017 and 2018 with archival data from the W.M. Keck Observatory, as
    well as lightcurve, occultation, and delay-Doppler images, to derive a
    model of its 3D shape using two different algorithms (ADAM, MPCD).
    Furthermore, an N-body dynamical model allowed us to retrieve the
    orbital elements of the two moons as explained in the accompanying
    paper.

    The shape of (216) Kleopatra is very close to an equilibrium dumbbell
    figure with two lobes and a thick neck. Its volume equivalent diameter
    (118.75+/-1.40)km and mass (2.97+/-0.32)*10^18^kg (i.e., 56% lower
    than previously reported) imply a bulk density of
    (3.38+/-0.50)g/cm^3^. Such a low density for a supposedly metal-rich
    body indicates a substantial porosity within the primary. This porous
    structure along with its near equilibrium shape is compatible with a
    formation scenario including a giant impact followed by
    reaccumulation.

    (216) Kleopatra's current rotation period and dumbbell shape imply
    that it is in a critically rotating state. The low effective gravity
    along the equator of the body, together with the equatorial orbits of
    the moons and possibly rubble-pile structure, opens the possibility
    that the moons formed via mass shedding.

Description:
    Deconvolved direct imaging observations of Kleopatra using the MISTRAL
    algorithm and a generated PSF.

    Those fits files are direct images of (216) Kleopatra system. The
    reduced images were further deconvolved with the Mistral algorithm
    (Fusco et al., 2003, in Proc. SPIE, Vol. 4839, Adaptive Optical System
    Technologies II, ed. P. L. Wizinowich & D. Bonaccini, 1065-1075),
    using a parametric point-spread function (Fetick et al.,
    2019A&A...623A...6F, Cat. J/A+A/623/A6).

object.dat :
----------------------------------------------------------------------
 Planet Name          H     Diam       e         i         a
                     mag     km                 deg        AU
----------------------------------------------------------------------
 216    Kleopatra    7.15   135.1  0.25126552  13.116286   2.79243307
----------------------------------------------------------------------

File Summary:
--------------------------------------------------------------------------------
 FileName      Lrecl  Records   Explanations
--------------------------------------------------------------------------------
ReadMe            80        .   This file
list.dat         175       11   List of fits images
fits/*             .       11   Individual fits images
--------------------------------------------------------------------------------

Byte-by-byte Description of file: list.dat
--------------------------------------------------------------------------------
   Bytes Format Units     Label     Explanations
--------------------------------------------------------------------------------
   1-  9  F9.5  deg       RAdeg     Right Ascension of center (J2000)
  10- 18  F9.5  deg       DEdeg     Declination of center (J2000)
  20- 26  F7.5 arcsec/pix scale     Scale of the image
  28- 30  I3    ---       Nx        Number of pixels along X-axis
  32- 34  I3    ---       Ny        Number of pixels along Y-axis
  36- 58  A23  "datime"   Obs.date  Observation date
  60- 62  I3    Kibyte    size      Size of FITS file
  64-130  A67   ---       FileName  Name of FITS file, in subdirectory fits
 133-175  A43   ---       Title     Title of the FITS file
--------------------------------------------------------------------------------

Acknowledgements:
    Franck Marchis, fmarchis(at)seti.org

================================================================================
(End)                                        Patricia Vannier [CDS]  23-Aug-2021
