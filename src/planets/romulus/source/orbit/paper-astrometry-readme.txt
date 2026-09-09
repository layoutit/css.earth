J/A+A/650/A129      SPHERE (87) Sylvia images                     (Carry+, 2021)
================================================================================
Evidence for differentiation of the most primitive small bodies.
    Carry B., Vernazza P., Vachier F., Neveu M., Berthier J., Hanus J.,
    Ferrais M., Jorda L., Marsset M., Viikinkoski M., Bartczak P.,
    Behrend R., Benkhaldoun Z., Birlan M., Castillo-Rogez J., Cipriani F.,
    Colas F., Drouard A., Dudzinski G. P., Desmars J., Dumas C. Durech J.,
    Fetick R., Fusco T., Grice J., Jehin E., Kaasalainen M., Kryszczynska A.,
    Lamy P., Marchis F., Marciniak A., Michalowski T., Michel P., Pajuelo M.,
    Podlewska-Gaca E., Rambaux N., Santana-Ros T., Storrs A., Tanga P.,
    Vigan A., Warner B., Wieczorek M., Witasse O., Yang B.
    <Astron. Astrophys. 650, A129 (2021)>
    =2021A&A...650A.129C        (SIMBAD/NED BibCode)
================================================================================
ADC_Keywords: Solar system ; Minor planets
Keywords: minor planets, asteroids: general - Kuiper belt: general -
          minor planets, asteroids: individual: Sylvia

Abstract:
    Dynamical models of Solar System evolution have suggested that the
    so-called P- and D-type volatile-rich asteroids formed in the outer
    Solar System beyond Neptune's orbit and may be genetically related
    to the Jupiter Trojans, comets, and small Kuiper belt objects (KBOs).
    Indeed, the spectral properties of P- and D-type asteroids resemble
    that of anhydrous cometary dust.

    We aim to gain insights into the above classes of bodies by
    characterizing the internal structure of a large P- and D-type
    asteroid.

    We report high-angular-resolution imaging observations of the P-type
    asteroid (87) Sylvia with the the Very Large Telescope (VLT)
    Spectro-Polarimetric High-contrast Exoplanet REsearch (SPHERE)
    instrument. These images were used to reconstruct the 3D shape of
    Sylvia. Our images together with those obtained in the past with large
    ground-based telescopes were used to study the dynamics of its two
    satellites. We also modeled Sylvia's thermal evolution.

    The shape of Sylvia appears flattened and elongated (a/b~1.45;
    a/c~1.84). We derive a volume-equivalent diameter of 271+/-5km and
    a low density of 1378+/-45kg/m^3^. The two satellites orbit Sylvia on
    circular, equatorial orbits. The oblateness of Sylvia should imply a
    detectable nodal precession which contrasts with the fully-Keplerian
    dynamics of its two satellites. This reveals an inhomogeneous internal
    structure, suggesting that Sylvia is differentiated.

    Sylvia's low density and differentiated interior can be explained by
    partial melting and mass redistribution through water percolation. The
    outer shell should be composed of material similar to interplanetary
    dust particles (IDPs) and the core should be similar to aqueously
    altered IDPs or carbonaceous chondrite meteorites such as the Tagish
    Lake meteorite. Numerical simulations of the thermal evolution of
    Sylvia show that for a body of such a size, partial melting was
    unavoidable due to the decay of long-lived radionuclides. In addition,
    we show that bodies as small as 130-150km in diameter should have
    followed a similar thermal evolution, while smaller objects, such as
    comets and the KBO Arrokoth, must have remained pristine, which is in
    agreement with in situ observations of these bodies. NASA Lucy mission
    target (617) Patroclus (diameter ~140km) may, however, be
    differentiated.

Description:
    Sylvia was observed with the SPHERE instrument (ESO/VLT) around its
    opposition at eleven different epochs. We used IRDIS in broad band
    (Y filter; filter central wavelength 1041.4nm, width = 135.2nm) and
    ZIMPOL in narrowband imaging mode (N_R filter; filter central
    wavelength = 645.9nm, width = 56.7nm).

    Each observational sequence consisted of a series of images, where
    each image corresponded to a series of detector integration times
    (DITs) of 10s, during which Sylvia was used as a natural guide star
    for adaptive optics (AO) corrections. Observations were performed
    under good seeing conditions (<=0.8") with an airmass usually below
    1.6. Standard calibrations, which include detector flat-fields and
    darks, were acquired in the morning as part of the instrument
    calibration plan.

objects:
    -------------------------------------------------------------------
    Planet  Name   H    Diam     i            e          a
                  mag    km      deg                     AU
    -------------------------------------------------------------------
       87  Sylvia 6.86  261.0  10.87567   0.09351718  3.48178042
    -------------------------------------------------------------------

File Summary:
--------------------------------------------------------------------------------
 FileName    Lrecl  Records   Explanations
--------------------------------------------------------------------------------
ReadMe          80        .   This file
tablea1.dat     97      121   Table A1 (lightcurves)
tableb1.dat     70      100   List of observers of the five stellar occultations
tablec1.dat     80      130   Table C1 (astrometry Romulus)
tablec2.dat     80       67   Table C2 (astrometry Remus)
list.dat       127      104   List of fits images
fits/*           .      104   Individual fits images
--------------------------------------------------------------------------------

Byte-by-byte Description of file: tablea1.dat
--------------------------------------------------------------------------------
   Bytes Format Units         Label     Explanations
--------------------------------------------------------------------------------
   1-  4  I4    ---           Id        Lightcurve identifier
   6- 15  A10   "YYYY-MM-DD"  Obs.date  Date of observation
  17- 19  F3.1  s             Dur       Length of the lightcurve
  21- 23  I3    ---           Npoints   Number of measurements in the lightcurve
  25- 28  F4.1  deg           Phase     Phase angle at the time of observations
  30- 34  A5    ---           Filter    Filter used
  36- 40  F5.3  ---           rms       Root mean square residuals
  42- 44  A3    ---           IAUCode   IAU Observatory Code
  46- 97  A52   ---           Observer  Bibcode or observer name
--------------------------------------------------------------------------------

Byte-by-byte Description of file: tableb1.dat
--------------------------------------------------------------------------------
   Bytes Format Units         Label     Explanations
--------------------------------------------------------------------------------
   1- 10  A10   "YYYY-MM-DD"  Obs.date  Occultation date
  12- 70  A59   ---           Observer  Observer name
--------------------------------------------------------------------------------

Byte-by-byte Description of file: tablec1.dat tablec2.dat
--------------------------------------------------------------------------------
   Bytes Format Units         Label     Explanations
--------------------------------------------------------------------------------
   1- 10  A10   "YYYY-MM-DD"  Obs.date  Date of observation
  12- 22  A11   "h:m:s"       Obs.time  Time UTC of observation
  24- 29  A6    ---           Tel       Telescope used
  31- 36  A6    ---           Camera    Camera used
  38- 39  A2    ---           Filter    Filter used
  41- 46  F6.1  mas           Xo        Satellite position along RA
  48- 53  F6.1  mas           Yo        Satellite position along Dec
  55- 59  F5.1  mas           Xomc      Satellite residuals along RA
  61- 65  F5.1  mas           Yomc      Satellite residuals along Dec
  67- 70  F4.1  mas           sigma     Uncertainty
  72- 75  F4.1  mag           deltamag  ?=0 Satellite differential magnitude
  77- 80  F4.2  mag         e_deltamag  ?=0 Uncertainty on the differential 
                                         magnitude
--------------------------------------------------------------------------------

Byte-by-byte Description of file: list.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label     Explanations
--------------------------------------------------------------------------------
   1-  9  F9.5  deg     RAdeg     Right Ascension of center (J2000)
  10- 18  F9.5  deg     DEdeg     Declination of center (J2000)
  20- 23  I4    ---     Nx        Number of pixels along X-axis
  25- 28  I4    ---     Ny        Number of pixels along Y-axis
  30- 51  A22  "datime" Obs.date  Observation date
  53- 56  I4    Kibyte  size      Size of FITS file
  58-127  A70   ---     FileName  Name of FITS file, in subdirectory fits
--------------------------------------------------------------------------------

Acknowledgements:
    Benoit Carry, benoit.carry(at)oca.eu

================================================================================
(End)                                        Patricia Vannier [CDS]  26-Mar-2021
