KPL/FK

Didymos System Frames Kernel
========================================================================

   This frame kernel contains a complete set of frame definitions for
   the Didymos system including NAIF ID/name mapping for the the
   asteroid system and, the name to ID mappings for the DART target
   body DSK surfaces.


Version and Date
------------------------------------------------------------------------

   Version 007 -- October 6, 2023 -- Hari Nair, JHU/APL

      Update DIMORPHOS_FIXED switch frame parameters, using Dimorphos
      orbit solution 542.  Adjust impact time to 2022-09-26T23:14:24.184.

   Version 006 -- September 11, 2023 -- Hari Nair, JHU/APL

      Revised description of Dimorphos post-impact frame.  Add
      complete list of defined frames in the "Asteroid Frames"
      section.

      Update DSK surface name/id mapping.

   Version 005 -- June 13, 2023 -- Hari Nair, JHU/APL

      Update DIMORPHOS_FIXED switch frame parameters, using Dimorphos
      orbit solution 527.  Define post-impact frame as a dynamic
      frame, with X axis pointing to Didymos center and Z axis
      parallel to Didymos pole.

   Version 004 -- May 26, 2023 -- Hari Nair, JHU/APL

      Update DIMORPHOS_FIXED switch frame parameters, using Dimorphos
      orbit solution 523.

   Version 003 -- February 1, 2023 -- Hari Nair, JHU/APL

      Implement DIMORPHOS_FIXED as a switch frame, using Dimorphos
      orbit solution 516.

   Version 002 -- January 12, 2023 -- Hari Nair, JHU/APL

      Add Name/Code bindings for DSK surfaces.

   Version 001 -- July 25, 2022 - Hari Nair, JHU/APL

      Fixed typo: DIMORPHOS_FIXED relative to IAU_DIMORPHOS

   Version 000 -- September 1, 2021 - Marc Costa Sitja, NAIF/JPL

      First version. 

References
------------------------------------------------------------------------

   1. ``Frames Required Reading''

   2. ``Kernel Pool Required Reading''

   3. ``DS-Kernel Required Reading''


Contact Information
------------------------------------------------------------------------

   Hari Nair, JHU/APL, Hari.Nair@jhuapl.edu
   Olivier Barnouin, JHU/APL, Olivier.Barnouin@jhuapl.edu
   Alyssa Bailey, NAIF/JPL, alyssa.m.bailey@jpl.nasa.gov


Implementation Notes
------------------------------------------------------------------------

   This file is used by the SPICE system as follows: programs that make
   use of this kernel must ``load'' the kernel, normally during program
   initialization. The SPICE routine FURNSH loads a kernel file into
   the pool as shown below.

      CALL FURNSH ( 'kernel_name; )    -- FORTRAN
      furnsh_c ( "kernel_name" );      -- C
      cspice_furnsh, kernel_name       -- IDL
      cspice_furnsh( 'kernel_name' )   -- MATLAB

   In order for a program or routine to extract data from the pool, the
   SPICELIB routines GDPOOL, GIPOOL, and GCPOOL are used.  See [2] for
   more details.

   This file was created and may be updated with a text editor or word
   processor.


Asteroid NAIF ID Codes -- Summary Section
------------------------------------------------------------------------

   The following names and NAIF ID codes are assigned to the Didymos 
   system (the keywords implementing these definitions are located in 
   the section "Didymos System NAIF ID Codes -- Definition Section" 
   later in this file):

   Asteroid Binary System names/IDs*:
            
            DIDYMOS BARYCENTER                          20065803
            65803 DIDYMOS                              920065803
            DIDYMOS                                    920065803
            (65803) DIDYMOS I (DIMORPHOS)              120065803
            DIMORPHOS                                  120065803
    
   (*) The Minor Planet Designation (MPC) for the Didymos system is 65803.  
       The NAIF ID of the system barycenter is 20065803. The NAIF ID of the 
       primary (Didymos) is 920065803. The NAIF ID of the secondary 
       (Dimorphos) is 120065803.


Asteroid Frames
------------------------------------------------------------------------

   The following Didymos system frames are defined in this kernel file:

           Name                    Relative to           Type        NAIF ID
      ======================    ===================  ============   =========
      IAU_DIDYMOS                 J2000                  PCK            10113 
      DIDYMOS_FIXED               IAU_DIDYMOS            FIXED      920065803
      
      IAU_DIMORPHOS               J2000                  PCK            10114
      DIMORPHOS_FIXED_PRE         J2000                  DYNAMIC   1200658031
      DIMORPHOS_FIXED_POST        J2000                  DYNAMIC   1200658032
      DIMORPHOS_FIXED             DIMORPHOS_FIXED_PRE    SWITCH     120065803
      DIMORPHOS_FIXED             DIMORPHOS_FIXED_POST   SWITCH     120065803

Asteroid Body Fixed Frames
------------------------------------------------------------------------

   This section of the file contains the body-fixed frame definition
   for one of the DART mission targets: asteroid Didymos and Dimorphos.


Didymos frames
--------------------------------------

   The asteroid Didymos body-fixed frame -- IAU_DIDYMOS -- is defined
   as follows:

      -  +Z axis is the asteroid rotation axis pointed towards the
         positive pole

      -  +X axis points towards the prime meridian

      -  +Y axis completes the right handed frame

      -  the origin of the frame is at the asteroid center of mass.


   Since the asteroid rotation data is expected to be provided in a
   text PCK in the form compliant with the IAU rotation model, the
   IAU_DIDYMOS frame is defined as a PCK based frame. This definition
   is included in all SPICE Toolkits version N0067 or later.

   \begindata

      FRAME_IAU_DIDYMOS          =  10113
      FRAME_10113_NAME           = 'IAU_DIDYMOS'
      FRAME_10113_CLASS          =  2
      FRAME_10113_CLASS_ID       =  920065803
      FRAME_10113_CENTER         =  920065803

      OBJECT_920065803_FRAME     = 'IAU_DIDYMOS'

   \begintext

   In addition, the DIDYMOS_FIXED frame is defined as a reference frame 
   alias of IAU_DIDYMOS.

   \begindata

        FRAME_DIDYMOS_FIXED            = 920065803
        FRAME_920065803_NAME           = 'DIDYMOS_FIXED'
        FRAME_920065803_CLASS          = 4
        FRAME_920065803_CLASS_ID       = 920065803
        FRAME_920065803_CENTER         = 920065803

        TKFRAME_920065803_RELATIVE     = 'IAU_DIDYMOS'
        TKFRAME_920065803_SPEC         = 'MATRIX'
        TKFRAME_920065803_MATRIX       = ( 1   0   0
                                           0   1   0
                                           0   0   1 )
   
   \begintext


Dimorphos frames
--------------------------------------

   The asteroid satellite Dimorphos body-fixed frame -- IAU_DIMORPHOS -- is 
   defined as follows:

      -  +Z axis is the asteroid satellite rotation axis pointed towards the
         positive pole

      -  +X axis points towards the prime meridian

      -  +Y axis completes the right handed frame

      -  the origin of the frame is at the asteroid satellite center of mass.


   Since the asteroid rotation data is expected to be provided in a text PCK 
   in the form compliant with the IAU rotation model, the IAU_DIMORPHOS frame 
   is defined as a PCK based frame. This definition is included in all SPICE 
   Toolkits version N0067 or superior.

   \begindata

        FRAME_IAU_DIMORPHOS    =  10114
        FRAME_10114_NAME       = 'IAU_DIMORPHOS'
        FRAME_10114_CLASS      =  2
        FRAME_10114_CLASS_ID   =  120065803
        FRAME_10114_CENTER     =  120065803
        
        OBJECT_120065803_FRAME = 'IAU_DIMORPHOS'

   \begintext

   Most users will likely want to use DIMORPHOS_FIXED rather than
   IAU_DIMORPHOS since DIMORPHOS_FIXED correctly represents the
   changed rotation of Dimorphos before and after the DART impact.

   The DIMORPHOS_FIXED frame is defined as a switch frame aligned with
   the Euler dynamic frame DIMORPHOS_FIXED_PRE before the impact (2022
   SEP 26 23:14:24.184 UTC or 2022 SEP 26 23:15:33.366361 TDB) and
   with the dynamic frame DIMORPHOS_FIXED_POST after the impact.

   DIMORPHOS_FIXED_PRE implements the pre-impact Dimorphos rotation
   model specified in the PCK didymos_system_15.tpc.  These rotation
   parameters correspond to Dimorphos orbit solution 542.

   DIMORPHOS_FIXED_POST is a dynamic frame where the X axis points
   from Dimorphos center to Didymos center.  The Z axis is parallel to
   the IAU_DIDYMOS Z axis.

   The start and stop time of the DIMORPHOS_FIXED frame availability
   are arbitrarily set to the start and stop times of the extra-long
   DE441 SPKs.

   \begindata

      FRAME_DIMORPHOS_FIXED        = 120065803
      FRAME_120065803_NAME         = 'DIMORPHOS_FIXED'
      FRAME_120065803_CLASS        = 6
      FRAME_120065803_CLASS_ID     = 120065803
      FRAME_120065803_CENTER       = 120065803
 
      FRAME_120065803_ALIGNED_WITH = (
                                      'DIMORPHOS_FIXED_PRE'
                                      'DIMORPHOS_FIXED_POST'
                                   )
 
      FRAME_120065803_START        = (
                                      @13201B.C.-MAY-06-00:00:00.000
                                      @2022-09-26-23:15:33.366361
                                   )
 
      FRAME_120065803_STOP         = (
                                      @2022-09-26-23:15:33.366361
                                      @17191-MAR-15-00:00:00.000
                                   )
   
   \begintext

   The following fragments from didymos_system_15.tpc provide Dimorphos
   rotation keywords before impact:

      Pre-impact:

        BODY120065803_POLE_RA          = (  69.326861266078069, 0, 0)
        BODY120065803_POLE_DEC         = ( -72.724550395829496, 0, 0)
        BODY120065803_PM               = (  73.070565080143595,  
                                           724.724388306834840, 
                                             1.0270736140e-06)


   These models are referenced to the J2000 frame and the J2000 epoch.

   The DIMORPHOS_FIXED_PRE frame is defined as an Euler dynamic frame
   with its coefficients derived from the pre-impact PCK keyword
   values as described in the "Example of an Euler Frame" section of
   the Frames Required Reading document:

      POLE_RA    69.326861266078069 -> ANGLE_1    -159.326861266078069
      POLE_DEC  -72.724550395829496 -> ANGLE_2    -162.724550395829496
      PM[1]      73.070565080143595 -> ANGLE_3[1]  -73.070565080143595
      PM[2]     724.724388306834840 -> ANGLE_3[2]   -0.8388013753551329E-02
      PM[3]       1.0270736140e-06  -> ANGLE_3[3]   -0.13758595009216392E-15

   The DIMORPHOS_FIXED_POST frame is defined as a dynamic frame where
   the X axis points from Dimorphos center to Didymos center.  The Z
   axis is parallel to the IAU_DIMORPHOS Z axis.

   The DIMORPHOS_FIXED_PRE frame ID 1200658031 and
   DIMORPHOS_FIXED_POST frame ID 1200658032 are chosen arbitrarily by
   appending one more digit to the DIMORPHOS_FIXED frame ID.

   \begindata

      FRAME_DIMORPHOS_FIXED_PRE       =  1200658031
      FRAME_1200658031_NAME           = 'DIMORPHOS_FIXED_PRE'
      FRAME_1200658031_CLASS          =  5
      FRAME_1200658031_CLASS_ID       =  1200658031
      FRAME_1200658031_CENTER         =  120065803
      FRAME_1200658031_RELATIVE       = 'J2000'
      FRAME_1200658031_DEF_STYLE      = 'PARAMETERIZED'
      FRAME_1200658031_FAMILY         = 'EULER'
      FRAME_1200658031_EPOCH          =  @2000-JAN-1/12:00:00
      FRAME_1200658031_AXES           =  ( 3  1  3 )
      FRAME_1200658031_UNITS          = 'DEGREES'
      FRAME_1200658031_ANGLE_1_COEFFS = ( -159.326861266078069 )
      FRAME_1200658031_ANGLE_2_COEFFS = ( -162.724550395829496 )
      FRAME_1200658031_ANGLE_3_COEFFS = (  -73.070565080143595
                                            -0.8388013753551329E-02
                                            -0.13758595009216392E-15 )

      FRAME_DIMORPHOS_FIXED_POST      =  1200658032
      FRAME_1200658032_NAME           = 'DIMORPHOS_FIXED_POST'
      FRAME_1200658032_CLASS          =  5
      FRAME_1200658032_CLASS_ID       =  1200658032
      FRAME_1200658032_CENTER         =  120065803
      FRAME_1200658032_RELATIVE       = 'J2000'
      FRAME_1200658032_DEF_STYLE      = 'PARAMETERIZED'
      FRAME_1200658032_FAMILY         = 'TWO-VECTOR'
      FRAME_1200658032_PRI_AXIS       = 'X'
      FRAME_1200658032_PRI_VECTOR_DEF = 'OBSERVER_TARGET_POSITION'
      FRAME_1200658032_PRI_OBSERVER   = 'DIMORPHOS'
      FRAME_1200658032_PRI_TARGET     = 'DIDYMOS'
      FRAME_1200658032_PRI_ABCORR     = 'NONE'
      FRAME_1200658032_SEC_AXIS       = 'Z'
      FRAME_1200658032_SEC_VECTOR_DEF = 'CONSTANT'
      FRAME_1200658032_SEC_SPEC       = 'RECTANGULAR'
      FRAME_1200658032_SEC_FRAME      = 'IAU_DIDYMOS'
      FRAME_1200658032_SEC_VECTOR     = ( 0 0 1 )

   \begintext


Didymos System NAIF ID Codes -- Definitions
======================================================================== 

   This section contains name to NAIF ID mappings for the Didymos system.
   Once the contents of this file are loaded into the KERNEL POOL, these
   mappings become available within SPICE, making it possible to use
   names instead of ID code in high level SPICE routine calls. These 
   mappings are included in all version N0067 or superior SPICE Toolkits.

   \begindata

        NAIF_BODY_NAME += ( 'DIDYMOS BARYCENTER' )
        NAIF_BODY_CODE += ( 20065803             )

        NAIF_BODY_NAME += ( '65803 DIDYMOS' )
        NAIF_BODY_CODE += ( 920065803 )

        NAIF_BODY_NAME += ( 'DIDYMOS' )
        NAIF_BODY_CODE += ( 920065803 )

        NAIF_BODY_NAME += ( '(65803) DIDYMOS I (DIMORPHOS)' )
        NAIF_BODY_CODE += ( 120065803 )

        NAIF_BODY_NAME += ( 'DIMORPHOS' )
        NAIF_BODY_CODE += ( 120065803   )
   
   \begintext


Didymos System DSK Surface ID Codes -- Definitions
========================================================================   

   This section contains name to ID mappings for the DART target
   body DSK surfaces. These mappings are supported by all SPICE
   toolkits with integrated DSK capabilities (version N0066 or later).


   Asteroid Didymos Surface name/IDs:

          DSK Surface Name            ID        Body ID
      ==========================    =========  =========
      DIDYMOS_50680MM_RDR_V001      250680001  920065803
      DART_DIDYMOS_01165MM_SPC_V003 201165003  920065803
      DART_DIDYMOS_02329MM_SPC_V003 202329003  920065803
      DART_DIDYMOS_04657MM_SPC_V003 204657003  920065803
      DART_DIDYMOS_09309MM_SPC_V003 209309003  920065803

   Name-ID Mapping keywords:

   \begindata

      NAIF_SURFACE_NAME += 'DIDYMOS_50680MM_RDR_V001'
      NAIF_SURFACE_CODE += 250680001
      NAIF_SURFACE_BODY += 920065803

      NAIF_SURFACE_NAME += 'DART_DIDYMOS_01165MM_SPC_V003'
      NAIF_SURFACE_CODE += 201165003
      NAIF_SURFACE_BODY += 920065803

      NAIF_SURFACE_NAME += 'DART_DIDYMOS_02329MM_SPC_V003'
      NAIF_SURFACE_CODE += 202329003
      NAIF_SURFACE_BODY += 920065803

      NAIF_SURFACE_NAME += 'DART_DIDYMOS_04657MM_SPC_V003'
      NAIF_SURFACE_CODE += 204657003
      NAIF_SURFACE_BODY += 920065803

      NAIF_SURFACE_NAME += 'DART_DIDYMOS_09309MM_SPC_V003'
      NAIF_SURFACE_CODE += 209309003
      NAIF_SURFACE_BODY += 920065803

   \begintext    
     

   Satellite asteroid Dimorphos Surface name/IDs:

      DSK Surface Name                 ID         Body ID
      ==============================   =========  =========
      DART_DIMORPHOS_00250MM_SPC_V003  200250003  120065803
      DART_DIMORPHOS_00490MM_SPC_V003  200490003  120065803
      DART_DIMORPHOS_00980MM_SPC_V003  200980003  120065803
      DART_DIMORPHOS_01960MM_SPC_V003  201960003  120065803
      DART_DIMORPHOS_00243MM_SPC_V004  200243004  120065803
      DART_DIMORPHOS_00487MM_SPC_V004  200487004  120065803
      DART_DIMORPHOS_00972MM_SPC_V004  200972004  120065803
      DART_DIMORPHOS_01940MM_SPC_V004  201940004  120065803
      
   Name-ID Mapping keywords:

   \begindata

      NAIF_SURFACE_NAME += 'DART_DIMORPHOS_00250MM_SPC_V003'
      NAIF_SURFACE_CODE += 200250003
      NAIF_SURFACE_BODY += 120065803

      NAIF_SURFACE_NAME += 'DART_DIMORPHOS_00490MM_SPC_V003'
      NAIF_SURFACE_CODE += 200490003
      NAIF_SURFACE_BODY += 120065803

      NAIF_SURFACE_NAME += 'DART_DIMORPHOS_00980MM_SPC_V003'
      NAIF_SURFACE_CODE += 200980003
      NAIF_SURFACE_BODY += 120065803

      NAIF_SURFACE_NAME += 'DART_DIMORPHOS_01960MM_SPC_V003'
      NAIF_SURFACE_CODE += 201960003
      NAIF_SURFACE_BODY += 120065803

      NAIF_SURFACE_NAME += 'DART_DIMORPHOS_00243MM_SPC_V004'
      NAIF_SURFACE_CODE += 200243004
      NAIF_SURFACE_BODY += 120065803

      NAIF_SURFACE_NAME += 'DART_DIMORPHOS_00487MM_SPC_V004'
      NAIF_SURFACE_CODE += 200487004
      NAIF_SURFACE_BODY += 120065803

      NAIF_SURFACE_NAME += 'DART_DIMORPHOS_00972MM_SPC_V004'
      NAIF_SURFACE_CODE += 200972004
      NAIF_SURFACE_BODY += 120065803

      NAIF_SURFACE_NAME += 'DART_DIMORPHOS_01940MM_SPC_V004'
      NAIF_SURFACE_CODE += 201940004
      NAIF_SURFACE_BODY += 120065803

   \begintext  


End of FK.
