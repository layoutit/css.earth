J/AJ/138/1003        IR photometry of massive LMC stars         (Bonanos+, 2009)
================================================================================
Spitzer SAGE infrared photometry of massive stars in the Large Magellanic Cloud.
    Bonanos A.Z., Massa D.L., Sewilo M., Lennon D.J., Panagia N., Smith L.J.,
    Meixner M., Babler B.L., Bracker S., Meade M.R., Gordon K.D., Hora J.L.,
    Indebetouw R., Whitney B.A.
   <Astron. J., 138, 1003-1021 (2009)>
   =2009AJ....138.1003B
================================================================================
ADC_Keywords: Magellanic Clouds ; Photometry, infrared ; Photometry, UBVRI ;
              Stars, giant ; Stars, early-type ; Stars, Wolf-Rayet
Keywords: catalogs - galaxies: individual (LMC) - infrared: stars -
          stars: early-type - stars: emission-line, Be - stars: Wolf-Rayet

Abstract:
    We present a catalog of 1750 massive stars in the Large Magellanic
    Cloud (LMC), with accurate spectral types compiled from the
    literature, and a photometric catalog for a subset of 1268 of these
    stars, with the goal of exploring their infrared properties. The
    photometric catalog consists of stars with infrared counterparts in
    the Spitzer SAGE survey database, for which we present uniform
    photometry from 0.3 to 24um in the UBVIJHKs+IRAC+MIPS24 bands. The
    resulting infrared color-magnitude diagrams illustrate that the
    supergiant B[e], red supergiant, and luminous blue variable (LBV)
    stars are among the brightest infrared point sources in the LMC, due
    to their intrinsic brightness, and at longer wavelengths, due to dust.
    We detect infrared excesses due to free-free emission among ~900 OB
    stars, which correlate with luminosity class. We confirm the presence
    of dust around 10 supergiant B[e] stars, finding the shape of their
    spectral energy distributions (SEDs) to be very similar, in contrast
    to the variety of SED shapes among the spectrally variable LBVs. The
    similar luminosities of B[e] supergiants (log L/L_{sun}_>=4) and the
    rare, dusty progenitors of the new class of optical transients (e.g.,
    SN 2008S and NGC 300 OT), plus the fact that dust is present in both
    types of objects, suggests a common origin for them. We find the
    infrared colors for Wolf-Rayet stars to be independent of spectral
    type and their SEDs to be flatter than what models predict.

File Summary:
--------------------------------------------------------------------------------
 FileName   Lrecl  Records   Explanations
--------------------------------------------------------------------------------
ReadMe         80        .   This file
table1.dat    100     1750   Catalog of spectral types for 1750 LMC massive
                             stars
table3.dat    327     1268   0.3-24 micron photometry of 1268 massive stars
                             in the LMC
refs.dat       75       48   References
--------------------------------------------------------------------------------

See also:
 II/236 : UBVR CCD survey of the Magellanic clouds (Massey+, 2002)
 II/187 : 30 Doradus OB Associations (Parker 1992)
 J/A+A/496/841  : VLT-FLAMES survey of massive stars (Hunter+, 2009)
 J/ApJ/695/511  : Young massive stars in LHA 120-N 44 (Chen+, 2009)
 J/A+A/456/623  : VLT-FLAMES survey of massive stars (Evans+, 2006)
 J/A+A/436/117  : BVR photometry in N214C (Meynadier+, 2005)
 J/A+A/442/1135 : High-mass X-ray binaries in the Magellanic Clouds (Liu+, 2005)
 J/AJ/126/2867  : Red supergiants in Magellanic Clouds (Massey+, 2003)
 J/AJ/121/891   : UBV photometry of LMC OB associations (Parker+, 2001)
 J/AJ/119/2214  : Photometry of Magellanic OB associations (Massey+, 2000)
 J/ApJ/452/210  : UBV photometry in LH 47/48 (Oey+ 1995)
 J/AJ/108/1256  : The OB association LH 58 (Garmany+, 1994)
 J/AJ/103/1205  : Stellar Content of LH 9 and 10 in the LMC (Parker+ 1992)

Byte-by-byte Description of file: table1.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label     Explanations
--------------------------------------------------------------------------------
   1- 18  A18   ---     Name      Star designation (G1)
  20- 29  F10.7 deg     RAdeg     Right Ascension in decimal degrees (J2000)
  31- 41  F11.7 deg     DEdeg     Declination in decimal degrees (J2000)
  43- 46  A4    ---     Ref       Reference (see refs.dat file)
  48- 77  A30   ---     Class     MK spectral type and object type
  79-100  A22   ---     OName     Other designation(s)
--------------------------------------------------------------------------------

Byte-by-byte Description of file: table3.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label     Explanations
--------------------------------------------------------------------------------
   1- 18  A18   ---     Name      Star designation (G1)
  20- 38  A19   ---     IRAC      IRAC designation (JHHMMSS.ss+DDMMSS.s)
  40- 49  F10.7 deg     RAdeg     Right Ascension in decimal degrees (J2000)
  51- 61  F11.7 deg     DEdeg     Declination in decimal degrees (J2000)
  63- 68  F6.3  mag     Umag      ? The U band magnitude
  70- 74  F5.3  mag   e_Umag      ? The 1{sigma} error in Umag
  76- 81  F6.3  mag     Bmag      ? The B band magnitude
  83- 87  F5.3  mag   e_Bmag      ? The 1{sigma} error in Bmag
  89- 94  F6.3  mag     Vmag      ? The V band magnitude
  96-101  F6.4  mag   e_Vmag      ? The 1{sigma} error in Vmag
 103-108  F6.3  mag     Imag      ? The I band magnitude
 110-114  F5.3  mag   e_Imag      ? The 1{sigma} error in Imag
 116-121  F6.3  mag     VmagO     ? OGLE V band magnitude
 123-128  F6.3  mag     ImagO     ? OGLE I band magnitude
 130-135  F6.3  mag     Jmag      ? 2MASS J band magnitude
 137-141  F5.3  mag   e_Jmag      ? The 1{sigma} error in Jmag
 143-148  F6.3  mag     Hmag      ? 2MASS H band magnitude
 150-154  F5.3  mag   e_Hmag      ? The 1{sigma} error in Hmag
 156-161  F6.3  mag     Ksmag     ? 2MASS Ks band magnitude
 163-167  F5.3  mag   e_Ksmag     ? The 1{sigma} error in Kmag
 169-173  F5.2  mag     JmagI     ? IRSF J band magnitude
 175-178  F4.2  mag   e_JmagI     ? The 1{sigma} error in JIRSFmag
 180-184  F5.2  mag     HmagI     ? IRSF H band magnitude
 186-189  F4.2  mag   e_HmagI     ? The 1{sigma} error in HIRSFmag
 191-195  F5.2  mag     KsmagI    ? IRSF Ks band magnitude
 197-200  F4.2  mag   e_KsmagI    ? The 1{sigma} error in KIRSFmag
 202-207  F6.3  mag     [3.6]     ? Spitzer/IRAC 3.6 micron band magnitude
 209-213  F5.3  mag   e_[3.6]     ? The 1{sigma} error in [3.6]
 215-220  F6.3  mag     [4.5]     ? Spitzer/IRAC 4.5 micron band magnitude
 222-226  F5.3  mag   e_[4.5]     ? The 1{sigma} error in [4.5]
 228-233  F6.3  mag     [5.8]     ? Spitzer/IRAC 5.8 micron band magnitude
 235-239  F5.3  mag   e_[5.8]     ? The 1{sigma} error in [5.8]
 241-246  F6.3  mag     [8.0]     ? Spitzer/IRAC 8.0 micron band magnitude
 248-252  F5.3  mag   e_[8.0]     ? The 1{sigma} error in [8.0]
 254-258  F5.3  mag     [24]      ? Spitzer/MIPS 24 micron band magnitude
 260-267  F8.6  mag   e_[24]      ? The 1{sigma} error in [24]
 269-272  A4    ---     Ref       Reference (see refs.dat file)
 274-305  A32   ---     Class     MK Spectral type and object type
 307-327  A21   ---     OName     Other designation(s)
--------------------------------------------------------------------------------

Byte-by-byte Description of file: refs.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label     Explanations
--------------------------------------------------------------------------------
   1-  4  A4    ---     Ref       Reference code
   6- 24  A19   ---     BibCode   Bibcode
  26- 51  A26   ---     Aut       First author's name
  53- 75  A23   ---     Comm      Comment
--------------------------------------------------------------------------------

Global notes:
Note (G1): Designations:
  BAT99 = Breysacher et al. (1999A&AS..137..117B; <BAT99 NNN> in Simbad)
  Sk    = Sanduleak (1970CoTol..89.....S; <Sk -DD NNNA> in Simbad)
  W     = Westerlund (1961UppAn...5....1W),
  BI    = Brunet et al. (1975A&AS...21..109B; <BI NNN> in Simbad),
  LH    = Lucke (1972PhDT........10L; <[L72] LH NN-NNNN> in Simbad),
  S     = Henize (1956ApJS....2..315H; <LHA 120-S NNN> in Simbad).
--------------------------------------------------------------------------------

History:
    From electronic version of the journal

================================================================================
(End)                 Greg Schwarz [AAS], Emmanuelle Perret [CDS]    19-Jan-2012
