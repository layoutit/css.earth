                  Asteroid catalog using AKARI     (Usui+ 2011)
================================================================================
The Asteroid catalog using AKARI (version 1)
    Usui F., Kuroda D., Mueller T.G., Hasegawa S., Ishiguro M., Ootsubo T.,
    Ishihara D., Kataza H., Takita S., Oyabu S., Ueno M., Matsuhara H., 
    Onaka T.
   <Publ. Astron. Soc. Jap., 63, 1117-1138 (2011)>
   =2011PASJ...63.1117U
================================================================================
ADC_Keywords: Solar system ; Minor planets ; Photometry, infrared
Mission_Name: AKARI
Keywords: catalogs --- infrared: solar system  --- minor planets, asteroids --- 
          space vehicles; instruments --- surveys

Description:
    The AKARI Infrared Astronomical Satellite observed the whole sky in
    the far infrared (50-180{mu}m) and the mid-infrared (9 and 18{mu}m)
    between May 2006 and August 2007 (Murakami et al. 2007PASJ...59S.369M)

    The Asteroid catalog using AKARI (AcuA) version 1.0 is the first asteroid
    catalog produced based on the AKARI/IRC Mid-Infrared Survey. The catalog 
    provides the size and albedo of 5120 asteroids. 

File Summary:
--------------------------------------------------------------------------------
 FileName           Lrecl  Records    Explanations
--------------------------------------------------------------------------------
ReadMe.AcuA.txt        80        .    This file
AcuA_V1.txt            77     5120    Asteroid catalog using AKARI
                                        (version 1.0)
--------------------------------------------------------------------------------

See also:
    http://www.ir.isas.jaxa.jp/AKARI/Observation/PSC/Public/ : 
        AKARI Survey Point Source Catalogue (ISAS/JAXA, 2010)
    http://www.ir.isas.jaxa.jp/AKARI/Observation/ : AKARI Observers Page
    http://darts.jaxa.jp/ir/akari/ : AKARI Data archives

Byte-by-byte Description of file: AcuA_V1.txt
--------------------------------------------------------------------------------
   Bytes Format Units   Label     Explanations
--------------------------------------------------------------------------------
   1-  6  A6    ---     NUMBER    Asteroid's number
   8- 25  A18   ---     NAME      Asteroid's name
  27- 36  A10   ---     PROV_DES  Asteroid's provisional designation
  38- 42  F5.2  mag     HMAG      Absolute magnitude
  44- 48  F5.2  ---     GPAR      Slope parameter
  50- 51  I2    ---     NID       Number of detections by AKARI
  53- 59  F7.2  km      DIAMETER  Mean diameter
  61- 65  F5.2  km      D_ERR     Uncertainty in diameter
  67- 71  F5.3  ---     ALBEDO    Mean geometric albedo
  73- 77  F5.3  ---     A_ERR     Uncertainty in albedo
--------------------------------------------------------------------------------
Note : 
    NUMBER, NAME, and PROV_DES are the asteroid number, the name, and 
    the provisional designation, which follow the formal assignment 
    overseen by the IAU Minor Planet Center. HMAG and GPAR are the absolute
    magnitude and slope parameter taken from the Asteroid Orbital Elements 
    Database of the Lowell observatory. NID gives the number of detections 
    at S9W (9{mu}m band) and L18W (18{mu}m band) in total. DIAMETER and 
    ALBEDO are the estimated size (diameter) and albedo, while D_ERR, A_ERR
    are their uncertainties estimated from the thermal model calculations 
    (STM; Lebofsky et al. 1986Icar...68..239L).

--------------------------------------------------------------------------------

History:
  * 16-Sep-2011: Documentation prepared at ISAS/JAXA by Fumihiko Usui
  * 29-Sep-2011: Journal page number and bibcode updated.
================================================================================
(End)                                   Fumihiko Usui [ISAS/JAXA]    29-Sep-2011
