J/AJ/140/416     IR photometry of massive stars in the SMC    (Bonanos+, 2010)
================================================================================
Spitzer SAGE-SMC infrared photometry of massive stars in the
Small Magellanic Cloud.
    Bonanos A.Z., Lennon D.J., Kohlinger F., van Loon J.T., Massa D.L.,
    Sewilo M., Evans C.J., Panagia N., Babler B.L., Block M., Bracker S.,
    Engelbracht C.W., Gordon K.D., Hora J.L., Indebetouw R., Meade M.R.,
    Meixner M., Misselt K.A., Robitaille T.P., Shiao B., Whitney B.A.
   <Astron. J., 140, 416-429 (2010)>
   =2010AJ....140..416B
================================================================================
ADC_Keywords: Photometry, infrared ; Photometry, UBVRI ; Stars, giant ;
              Stars, early-type ; Stars, Wolf-Rayet
Keywords: catalogs - galaxies: individual (SMC) - infrared: stars -
          stars: early-type - stars: emission-line, Be - stars: massive

Abstract:
    We present a catalog of 5324 massive stars in the Small Magellanic
    Cloud (SMC), with accurate spectral types compiled from the
    literature, and a photometric catalog for a subset of 3654 of these
    stars, with the goal of exploring their infrared properties. The
    photometric catalog consists of stars with infrared counterparts in
    the Spitzer SAGE-SMC survey database, for which we present uniform
    photometry from 0.3 to 24um in the UBVIJHKs+IRAC+MIPS24 bands.

Description:
    As in Paper I (Bonaos et al., 2009, Cat. J/AJ/138/1003), we have
    compiled a catalog of massive stars with known spectral types in the
    SMC from the literature. We then cross-matched the stars in the
    SAGE-SMC database, after incorporating optical and near-infrared
    photometry from recent surveys of the SMC.

File Summary:
--------------------------------------------------------------------------------
 FileName   Lrecl  Records   Explanations
--------------------------------------------------------------------------------
ReadMe         80        .   This file
table1.dat    116     5324   Catalog of spectral types for 5324 SMC
                              massive stars
table3.dat    348     3654   0.3-24 micron photometry of 3654 massive stars
                              in the SMC
table4.dat     35       17   Filter and detection characteristics
refs.dat      120       29   References
--------------------------------------------------------------------------------

See also:
   II/288 : IRSF Magellanic Clouds Point Source Catalog (Kato+ 2007)
   J/AJ/138/1003 : IR photometry of massive LMC stars (Bonanos+, 2009)

Byte-by-byte Description of file: table1.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label     Explanations
--------------------------------------------------------------------------------
   1- 17  A17   ---     Name      Star designation (G1)
  19- 61  A43   ---     ANames    Alternative star designations (G1)
  63- 71  F9.6  deg     RAdeg     Right Ascension in decimal degrees (J2000)
  73- 81  F9.5  deg     DEdeg     Declination in decimal degrees (J2000)
  83- 90  A8    ---     Ref       Reference, in refs.dat file
  92-116  A25   ---     CC        MK spectral classification and comments
--------------------------------------------------------------------------------

Byte-by-byte Description of file: table3.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label     Explanations
--------------------------------------------------------------------------------
   1- 17  A17   ---     Name      Star designation (G1)
  19- 61  A43   ---     ANames    Alternative star designations (G1)
  63- 82  A20   ---     IRAC      IRAC designation
  84- 92  F9.6  deg     RAdeg     Right Ascension in decimal degrees (J2000)
  94-102  F9.5  deg     DEdeg     Declination in decimal degrees (J2000)
 104-109  F6.3  mag     Umag      ? U band magnitude
 111-115  F5.3  mag   e_Umag      ? The 1{sigma} uncertainty in Umag
 117-122  F6.3  mag     Bmag      ? B band magnitude
 124-128  F5.3  mag   e_Bmag      ? The 1{sigma} uncertainty in Bmag
 130-135  F6.3  mag     Vmag      ? V band magnitude
 137-141  F5.3  mag   e_Vmag      ? The 1{sigma} uncertainty in Vmag
 143-148  F6.3  mag     Imag      ? I band magnitude
 150-154  F5.3  mag   e_Imag      ? The 1{sigma} uncertainty in Imag
 156-161  F6.3  mag     VOmag     ? OGLE V-band magnitude
 163-168  F6.3  mag     IOmag     ? OGLE I-band magnitude
 170-175  F6.3  mag     Jmag      ? 2MASS J-band magnitude
 177-181  F5.3  mag   e_Jmag      ? The 1{sigma} uncertainty in Jmag
 183-188  F6.3  mag     Hmag      ? 2MASS H-band magnitude
 190-194  F5.3  mag   e_Hmag      ? The 1{sigma} uncertainty in Hmag
 196-201  F6.3  mag     Kmag      ? 2MASS Ks-band magnitude
 203-207  F5.3  mag   e_Kmag      ? The 1{sigma} uncertainty in Kmag
 209-213  F5.2  mag     JImag     ? IRSF J-band magnitude (Cat. II/288)
 215-218  F4.2  mag   e_JImag     ? The 1{sigma} uncertainty in JIRSF
 220-224  F5.2  mag     HImag     ? IRSF H-band magnitude (Cat. II/288)
 226-229  F4.2  mag   e_HImag     ? The 1{sigma} uncertainty in HIRSF
 231-235  F5.2  mag     KImag     ? IRSF Ks-band magnitude (Cat. II/288)
 237-240  F4.2  mag   e_KImag     ? The 1{sigma} uncertainty in KIRSF
 242-247  F6.3  mag     [3.6]     ? Spitzer/IRAC 3.6 micron band magnitude
 249-253  F5.3  mag   e_[3.6]     ? The 1{sigma} uncertainty in 3.6mag
 255-260  F6.3  mag     [4.5]     ? Spitzer/IRAC 4.5 micron band magnitude
 262-266  F5.3  mag   e_[4.5]     ? The 1{sigma} uncertainty in 4.5mag
 268-273  F6.3  mag     [5.8]     ? Spitzer/IRAC 5.8 micron band magnitude
 275-279  F5.3  mag   e_[5.8]     ? The 1{sigma} uncertainty in 5.8mag
 281-286  F6.3  mag     [8.0]     ? Spitzer/IRAC 8.0 micron band magnitude
 288-292  F5.3  mag   e_[8.0]     ? The 1{sigma} uncertainty in 8.0mag
 294-298  F5.3  mag     [24]      ? Spitzer/MIPS 24 micron band magnitude
 300-304  F5.3  mag   e_[24]      ? The 1{sigma} uncertainty in 24mag
 306-313  A8    ---     Ref       Reference, in refs.dat file
 315-348  A34   ---     CC        MK spectral classification and comments
--------------------------------------------------------------------------------


Byte-by-byte Description of file: table4.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label      Explanations
--------------------------------------------------------------------------------
   1-  7  A7    ---     Filter     Filter designation
   9- 14  F6.3  um      lam.eff    Effective wavelength {lambda}_eff_
  16- 22  F7.2  Jy      F0         Zero Mag flux
  24- 30  A7    arcsec  Res        Resolution
  32- 35  I4    ---     Ndet       Number of Stars detected
--------------------------------------------------------------------------------

Byte-by-byte Description of file: refs.dat
--------------------------------------------------------------------------------
   Bytes Format Units   Label     Explanations
--------------------------------------------------------------------------------
   1-  7  A7    ---     Ref       Reference code
   9- 27  A19   ---     BibCode   BibCode
  29- 53  A25   ---     Aut       Author's name
  55-120  A66   ---     Com       Comments
--------------------------------------------------------------------------------

Global notes:
Note (G1): Alternative names are separated by a semi-colon (;).
  The acronyms used are:
  * 2dFS: Evans et al. 2004, Cat. J/MNRAS/353/601)
  * AzV: Azzopardi et al. 1975, Cat. V/13);
         Azzopardi & Vigneau (1979A&AS...35..353A, 1982A&AS...50..291A)
  * R: Feast et al. (1960MNRAS.121..337F, <RMC NNN> in Simbad)
  * Sk: Sanduleak (1968AJ.....73..246S, 1969AJ.....74..877S)
  * MPG: Massey et al. 1989, Cat. J/AJ/98/1305, <Cl* NGC 346 MPG NNN> in Simbad
--------------------------------------------------------------------------------
History:
    From electronic version of the journal

References:
    Bonanos et al.,  Paper I   2009AJ....138.1003B, Cat. J/AJ/138/1003

================================================================================
(End)                  Greg Schwarz [AAS], Patricia Vannier [CDS]    13-Jun-2012
