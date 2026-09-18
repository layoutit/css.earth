KPL/FK

LICIACube Spacecraft Frames Kernel
=====================================

    This frame kernel contains a complete set of frame definitions for the
    LICIACube (LCC) mission, including definitions for LCC structures and
    payload frames. This kernel also contains NAIF ID/name mapping for
    the LCC main components


Version Log
-----------------------------------

    November 2022 --- Unibo LCC Team

        Inverted signs for LICIA_LEIA and LICIA_LUKE frames
        rotation angles.
        
    April 2021 --- Argotec LCC Team

        Old frame names and codes moved to the outdated
        frame kernel file "LCC_v01.tf".


    November 2021 --- Argotec LCC Team

        Spacecraft ID changed from -136 to -210.
        Body frame changed from LICIA_SPACECRAFT to LICIA_BODY.
        Added operative mode dynamic frames.


    March 2022 --- Argotec LCC Team

        Body frame changed back to LICIA_SPACECRAFT (-210000)
        to follow DART naming convention.
        Changed payload frame names from "PL1" and "PL2" to
        "LEIA" and "LUKE".
        Added imaging modes (Dimorphos, Didymos, DART).
        
        
    Jun 2022 --- Argotec LCC Team
    
        Removed antenna frames.
        Changed LEIA and LUKE IDs according to IK
        (-210100 and -210200 respectively)
        
        
    Jul 2022 --- Argotec LCC Team
    
        Replaced degree symbol with "degree"


    Sep 2022 --- Argotec LCC Team

        Corrected secondary axis alignment for
        LICIA_SUNPOINTING and LICIA_COMMUNICATION
        according to real ADCS behaviour


    Oct 2022 --- Argotec LCC Team
    
        Added misalignment angles for LICIA_LEIA
        and LICIA_LUKE as measured during operations


LICIACube NAIF ID Codes -- Summary Section
-----------------------------------

    LICIA                   -210

    LICIA_LEIA              -210100
    LICIA_LUKE              -210200

    LICIA_SUNPOINTING       -210901
    LICIA_COMMUNICATION     -210902

    LICIA_IMAGING_DMP       -210903
    LICIA_IMAGING_DDM       -210904
    LICIA_IMAGING_DRT       -210905


LICIACube Spacecraft and Structures Frames
---------------------------------------------

    Name                    Relative            Type        NAIF ID
    ========                ===========         =======     ==========

    LICIA_SPACECRAFT        ECLIPJ2000          CK          -210000

    LICIA_LEIA              LICIA_SPACECRAFT    FIXED       -210100
    LICIA_LUKE              LICIA_SPACECRAFT    FIXED       -210200

    LICIA_SUNPOINTING       ECLIPJ2000          DYNAMIC     -210901
    LICIA_COMMUNICATION     ECLIPJ2000          DYNAMIC     -210902

    LICIA_IMAGING_DMP       ECLIPJ2000          DYNAMIC     -210903
    LICIA_IMAGING_DDM       ECLIPJ2000          DYNAMIC     -210904
    LICIA_IMAGING_DRT       ECLIPJ2000          DYNAMIC     -210905



LICIACube Spacecraft Frame
-----------------------------------

    The LICIACube spacecraft frame is defined as follows:

    -  +Z axis is parallel to the boresight direction of the payload cameras and points
    opposite to the thruster side
    
    -  +X axis is perpendicular to the solar panels and points opposite to the solar cells
    
    -  +Y axis completes the right-handed frame


    -Z front view:
    -----------------
                               ^ +Zhgtx/rx2
                               |                        ^ +Zspa
                               o--> +Yhgtx/rx2          |
                        |-----------.                   |
    o========//========o|   .""""". |o========//========o--> +Yspa
                        |  /       \| 
                        | |    o    | 
                        |  \       Payload-1 (LEIA)
                        |   '-----' |
                        |+Zsc o---------> +Ysc
                        |     | ___ |
                        |     |/   \| 
                        |     |\___Payload-2 (LUKE)
                        |+Xsc v     |
                        | .-.  .--. |
                        | '-'  '--' |
                        |-----------'
                              o--> +Ylgtx/rx1
                              |
                              v +Zlgtx/rx1
    
    +X top view:
    ---------------
    
    o========//========o.-.___V___.-.o========//========o
    |        \\        ||           ||        \\        |
    |        //        ||           ||        //        |
    |        \\        || .-- RX1   ||        \\        |
    |        //        || |   |     ||        //        |
    |        \\        || '---'     ||        \\        |
    |        //        ||           ||        //        |
    |        \\        || .-------. ||        \\        |
    |        //        ||-Xsc o---------> +Ysc//        |
    |        \\        || |   |   | ||        \\        |
    |        //        || |   |   | ||        //        |
    |        \\        || |   |   | ||        \\        |
    |        //        ||+Zsc v   | |Solar Panel Arrays (SPA)
    |        \\        || |       | ||        \\        |
    |        //        || '--- HGTX ||        //        |
    |        \\        ||           ||        \\        |
    o========//========o'--========='o========//========o
                               o----> +Ypl
                               |
                               v +Zpl


    Since the S/C bus attitude is provided by a C kernel, this frame
    is defined as a CK-based frame.
    
    \begindata

        FRAME_LICIA_SPACECRAFT      = -210000
        FRAME_-210000_NAME          = 'LICIA_SPACECRAFT'
        FRAME_-210000_CLASS         = 3
        FRAME_-210000_CLASS_ID      = -210000
        FRAME_-210000_CENTER        = -210
        CK_-210000_SCLK             = -210
        CK_-210000_SPK              = -210

    \begintext


LICIACube Payload 1 (LEIA) Frame
-----------------------------------

    The primary payload for LICIACube, also referred to as LEIA (LICIACube Explorer 
    Imaging for Asteroid), is a body-fixed camera with a square field-of-view of
    2.93 x 2.93 deg. LEIA is mounted on the Z+ face of the satellite.
    Following the in-orbit calibration of this component, the measured misalignment
    is reported here as a fixed offset with respect to the spacecraft body frame.

    \begindata

        FRAME_LICIA_LEIA            = -210100
        FRAME_-210100_NAME          = 'LICIA_LEIA'
        FRAME_-210100_CLASS         =  4
        FRAME_-210100_CLASS_ID      = -210100
        FRAME_-210100_CENTER        = -210
        TKFRAME_-210100_RELATIVE    = 'LICIA_SPACECRAFT'
        TKFRAME_-210100_SPEC        = 'ANGLES'
        TKFRAME_-210100_ANGLES      = ( -0.6244, -0.3327, 0.0 )
        TKFRAME_-210100_AXES        = ( 1,      2,      3   )
        TKFRAME_-210100_UNITS       = 'DEGREES'

    \begintext


LICIACube Payload 2 (LUKE) Frame
-----------------------------------

    The secondary payload for LICIACube, also referred to as LUKE (LICIACube Unit
    Key Explorer) is a body-fixed camera with a rectangular field-of-view of
    9.15 x 4.8 deg. LUKE is mounted on the Z+ face of the satellite.
    Following the in-orbit calibration of this component, the measured misalignment
    is reported here as a fixed offset with respect to the spacecraft body frame.

    \begindata

        FRAME_LICIA_LUKE            = -210200
        FRAME_-210200_NAME          = 'LICIA_LUKE'
        FRAME_-210200_CLASS         =  4
        FRAME_-210200_CLASS_ID      = -210200
        FRAME_-210200_CENTER        = -210
        TKFRAME_-210200_RELATIVE    = 'LICIA_SPACECRAFT'
        TKFRAME_-210200_SPEC        = 'ANGLES'
        TKFRAME_-210200_ANGLES      = ( -0.2502, -0.9706, 0.0 )
        TKFRAME_-210200_AXES        = ( 1,      2,      3   )
        TKFRAME_-210200_UNITS       = 'DEGREES'

    \begintext


LICIACube Dynamic Frames
===========================

    This section defines dynamic frames of interest to LICIACube operations.

LICIACube Sun Pointing Frame
-----------------------------------

    During the Sun Pointing operative mode, LICIACube will orient its solar panels 
    perpendicularly to the Sun by changing the spacecraft body attitude.
    The dynamic frame for this mode is defined as follows:
        - -X (negative) axis aligned to the S/C-to-Sun vector
        - +Y (positive) axis constrained by the velocity vector with
        respect to the Sun in the ECLIPJ2000 frame
        - +Z axis completes the right-handed frame

    \begindata
    
        FRAME_LICIA_SUNPOINTING         = -210901
        FRAME_-210901_NAME              = 'LICIA_SUNPOINTING'
        FRAME_-210901_CLASS             = 5
        FRAME_-210901_CLASS_ID          = -210901
        FRAME_-210901_CENTER            = -210
        FRAME_-210901_RELATIVE          = 'ECLIPJ2000'
        FRAME_-210901_DEF_STYLE         = 'PARAMETERIZED'
        FRAME_-210901_FAMILY            = 'TWO-VECTOR'
        FRAME_-210901_PRI_AXIS          = '-X'
        FRAME_-210901_PRI_VECTOR_DEF    = 'OBSERVER_TARGET_POSITION'
        FRAME_-210901_PRI_OBSERVER      = -210
        FRAME_-210901_PRI_TARGET        = 'SUN'
        FRAME_-210901_PRI_ABCORR        = 'NONE'
        FRAME_-210901_PRI_FRAME         = 'ECLIPJ2000'
        FRAME_-210901_SEC_AXIS          = 'Y'
        FRAME_-210901_SEC_VECTOR_DEF    = 'OBSERVER_TARGET_VELOCITY'
        FRAME_-210901_SEC_OBSERVER      = 'SUN'
        FRAME_-210901_SEC_TARGET        = -210
        FRAME_-210901_SEC_ABCORR        = 'NONE'
        FRAME_-210901_SEC_FRAME         = 'ECLIPJ2000'
        
    \begintext


LICIACube Communication Frame
-----------------------------------

    During the Communication operative mode, LICIACube will orient its high gain antennas 
    towards Earth by changing the spacecraft body attitude.
    The dynamic frame for this mode is defined as follows:
        - -X (negative) axis aligned to the S/C-to-Earth vector
        - +Z pointing away from the Sun
        - +Y axis completes the right-handed frame

    \begindata
    
        FRAME_LICIA_COMMUNICATION       = -210902
        FRAME_-210902_NAME              = 'LICIA_COMMUNICATION'
        FRAME_-210902_CLASS             = 5
        FRAME_-210902_CLASS_ID          = -210902
        FRAME_-210902_CENTER            = -210
        FRAME_-210902_RELATIVE          = 'ECLIPJ2000'
        FRAME_-210902_DEF_STYLE         = 'PARAMETERIZED'
        FRAME_-210902_FAMILY            = 'TWO-VECTOR'
        FRAME_-210902_PRI_AXIS          = '-X'
        FRAME_-210902_PRI_VECTOR_DEF    = 'OBSERVER_TARGET_POSITION'
        FRAME_-210902_PRI_OBSERVER      = -210
        FRAME_-210902_PRI_TARGET        = 'EARTH'
        FRAME_-210902_PRI_ABCORR        = 'NONE'
        FRAME_-210902_PRI_FRAME         = 'ECLIPJ2000'
        FRAME_-210902_SEC_AXIS          = '-Z'
        FRAME_-210902_SEC_VECTOR_DEF    = 'OBSERVER_TARGET_POSITION'
        FRAME_-210902_SEC_OBSERVER      = -210
        FRAME_-210902_SEC_TARGET        = 'SUN'
        FRAME_-210902_SEC_ABCORR        = 'NONE'
        FRAME_-210902_SEC_FRAME         = 'ECLIPJ2000'
        
    \begintext


LICIACube Dimorphos Imaging Frame
-----------------------------------

    To image Dimorphos, LICIACube will orient its cameras 
    towards it by changing the spacecraft body attitude.
    The dynamic frame for this mode is defined as follows:
        - +Z axis aligned to the S/C-to-Dimorphos (120065803) vector
        - +Y axis constrained by the velocity vector with 
        respect to the Sun in the ECLIPJ2000 frame
        - +X axis completing the right-handed frame

    \begindata
    
        FRAME_LICIA_IMAGING_DMP         = -210903
        FRAME_-210903_NAME              = 'LICIA_IMAGING_DMP'
        FRAME_-210903_CLASS             = 5
        FRAME_-210903_CLASS_ID          = -210903
        FRAME_-210903_CENTER            = -210
        FRAME_-210903_RELATIVE          = 'ECLIPJ2000'
        FRAME_-210903_DEF_STYLE         = 'PARAMETERIZED'
        FRAME_-210903_FAMILY            = 'TWO-VECTOR'
        FRAME_-210903_PRI_AXIS          = 'Z'
        FRAME_-210903_PRI_VECTOR_DEF    = 'OBSERVER_TARGET_POSITION'
        FRAME_-210903_PRI_OBSERVER      = -210
        FRAME_-210903_PRI_TARGET        = 120065803
        FRAME_-210903_PRI_ABCORR        = 'NONE'
        FRAME_-210903_PRI_FRAME         = 'ECLIPJ2000'
        FRAME_-210903_SEC_AXIS          = 'Y'
        FRAME_-210903_SEC_VECTOR_DEF    = 'OBSERVER_TARGET_VELOCITY'
        FRAME_-210903_SEC_OBSERVER      = 'SUN'
        FRAME_-210903_SEC_TARGET        = -210
        FRAME_-210903_SEC_ABCORR        = 'NONE'
        FRAME_-210903_SEC_FRAME         = 'ECLIPJ2000'
        
    \begintext


LICIACube Didymos Imaging Frame
-----------------------------------

    To image Didymos, LICIACube will orient its cameras 
    towards it by changing the spacecraft body attitude.
    The dynamic frame for this mode is defined as follows:
        - +Z axis aligned to the Didymos (920065803) vector
        - +Y axis constrained to the velocity vector with
        respect to the Sun in the ECLIPJ2000 frame
        - +X axis completes the right-handed frame

    \begindata
        FRAME_LICIA_IMAGING_DDM         = -210904
        FRAME_-210904_NAME              = 'LICIA_IMAGING_DDM'
        FRAME_-210904_CLASS             = 5
        FRAME_-210904_CLASS_ID          = -210904
        FRAME_-210904_CENTER            = -210
        FRAME_-210904_RELATIVE          = 'ECLIPJ2000'
        FRAME_-210904_DEF_STYLE         = 'PARAMETERIZED'
        FRAME_-210904_FAMILY            = 'TWO-VECTOR'
        FRAME_-210904_PRI_AXIS          = 'Z'
        FRAME_-210904_PRI_VECTOR_DEF    = 'OBSERVER_TARGET_POSITION'
        FRAME_-210904_PRI_OBSERVER      = -210
        FRAME_-210904_PRI_TARGET        = 920065803
        FRAME_-210904_PRI_ABCORR        = 'NONE'
        FRAME_-210904_PRI_FRAME         = 'ECLIPJ2000'
        FRAME_-210904_SEC_AXIS          = 'Y'
        FRAME_-210904_SEC_VECTOR_DEF    = 'OBSERVER_TARGET_VELOCITY'
        FRAME_-210904_SEC_OBSERVER      = 'SUN'
        FRAME_-210904_SEC_TARGET        = -210
        FRAME_-210904_SEC_ABCORR        = 'NONE'
        FRAME_-210904_SEC_FRAME         = 'ECLIPJ2000'
    \begintext


LICIACube DART Imaging Frame
-----------------------------------

    To image DART, LICIACube will orient its cameras 
    towards it by changing the spacecraft body attitude.
    The dynamic frame for this mode is defined as follows:
        - +Z axis aligned to the S/C-to-DART (-135) vector
        - +Y axis constrained to the velocity vector with
        respect to the Sun in the ECLIPJ2000 frame
        - +X axis completes the right-handed frame

    \begindata
        FRAME_LICIA_IMAGING_DRT         = -210905
        FRAME_-210905_NAME              = 'LICIA_IMAGING_DRT'
        FRAME_-210905_CLASS             = 5
        FRAME_-210905_CLASS_ID          = -210905
        FRAME_-210905_CENTER            = -210
        FRAME_-210905_RELATIVE          = 'ECLIPJ2000'
        FRAME_-210905_DEF_STYLE         = 'PARAMETERIZED'
        FRAME_-210905_FAMILY            = 'TWO-VECTOR'
        FRAME_-210905_PRI_AXIS          = 'Z'
        FRAME_-210905_PRI_VECTOR_DEF    = 'OBSERVER_TARGET_POSITION'
        FRAME_-210905_PRI_OBSERVER      = -210
        FRAME_-210905_PRI_TARGET        = -135
        FRAME_-210905_PRI_ABCORR        = 'NONE'
        FRAME_-210905_PRI_FRAME         = 'ECLIPJ2000'
        FRAME_-210905_SEC_AXIS          = 'Y'
        FRAME_-210905_SEC_VECTOR_DEF    = 'OBSERVER_TARGET_VELOCITY'
        FRAME_-210905_SEC_OBSERVER      = 'SUN'
        FRAME_-210905_SEC_TARGET        = -210
        FRAME_-210905_SEC_ABCORR        = 'NONE'
        FRAME_-210905_SEC_FRAME         = 'ECLIPJ2000'
    \begintext


LICIACube NAIF Codes -- Definitions
======================================

    This section contains name to NAIF ID mapping for the LICIACube mission.
    Once the contents of this file are loaded into the kernel pool, these
    mappings become available within SPICE, making it possible to use
    names instead of ID codes in high-level SPICE routine calls.    
    
    \begindata

        NAIF_BODY_NAME += ( 'LICIA' )
        NAIF_BODY_CODE += ( -210 )

        NAIF_BODY_NAME += ( 'LICIA_SPACECRAFT' )
        NAIF_BODY_CODE += ( -210000 )

        NAIF_BODY_NAME += ( 'LICIA_LEIA' )
        NAIF_BODY_CODE += ( -210100 )

        NAIF_BODY_NAME += ( 'LICIA_LUKE' )
        NAIF_BODY_CODE += ( -210200 )

        NAIF_BODY_NAME += ( 'LICIA_SUNPOINTING' )
        NAIF_BODY_CODE += ( -210901 )

        NAIF_BODY_NAME += ( 'LICIA_COMMUNICATION' )
        NAIF_BODY_CODE += ( -210902 )

        NAIF_BODY_NAME += ( 'LICIA_IMAGING_DMP' )
        NAIF_BODY_CODE += ( -210903 )

        NAIF_BODY_NAME += ( 'LICIA_IMAGING_DDM' )
        NAIF_BODY_CODE += ( -210904 )
        
        NAIF_BODY_NAME += ( 'LICIA_IMAGING_DRT' )
        NAIF_BODY_CODE += ( -210905 )

    \begintext


End of FK file.
