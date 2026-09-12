KPL/FK

DART Frames Kernel
===========================================================================

   This frame kernel contains a complete set of frame definitions for the
   Double Asteroid Redirection Test (DART) including definitions for
   the DART structures and DART science instrument frames. This kernel 
   also contains NAIF ID/name mapping for the DART instruments.


Version and Date
------------------------------------------------------------------------

   Version 009 -- September 28, 2022 -- Hari Nair, JHU/APL

        Add switch frame for DART_DRACO to use DART_DRACO_TERMINAL
        after 2022 Sep 02.  This requires SPICE toolkit versions N0067
        or later.

        Remove references to object DART_DRACO.  Valid values from the
        instrument kernel are DART_DRACO_1X1 with NAIF ID -135101 and
        DART_DRACO_2X2 with NAIF ID -135102.

   Version 008 -- July 22, 2022 -- Hari Nair, JHU/APL

        Add DART_DRACO_BASE frame in the frame tree diagram.
        Formatting changes: wrap all lines longer than 80 characters.

   Version 007 -- March 21, 2022 -- Hari Nair, JHU/APL

        Add DRACO alignment matrix derived from star calibrations.
        From MOCNAV-ICI-227 dated March 17, 2022.

        Add name/id code pairs for DART thrusters and LICIACube mount.

   Version 006 -- November 17, 2021  -- Ian Murphy, JHU/APL

        Revised solar array +Y and -Y  and HGA frames to align
        with current GNC frame definitions.

        Removed unnecessary intermediate FIXED gimbal frames.

        Minor corrections to DART_SPACECRAFT axes definitions.

   Version 005 -- September 20, 2021 -- Marc Costa Sitja, NAIF/JPL
                                     -- Hari Nair, JHU/APL

      Added several sections, frame definitions and s/c diagrams.
      
      Updated solar array and HGA frame names and added frames
      to the frame chain.                                   

   Version 004 -- July 9, 2021 -- Ian Wick Murphy, JHU/APL
   
      Contains the s/c, SA, HGA and DRACO reference frames. 

   
References
------------------------------------------------------------------------

   1. ``Frames Required Reading''

   2. ``Kernel Pool Required Reading''

   3. ``C-Kernel Required Reading''


Contact Information
------------------------------------------------------------------------

   Ian Wick Murphy JHU/APL, ian.murphy@jhuapl.edu
   Hari Nair, JHU/APL, hari.nair@jhuapl.edu
   Marc Costa Sitja, NAIF/JPL, Marc.Costa.Sitja@jpl.nasa.gov


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


DART NAIF ID Codes -- Summary Section
------------------------------------------------------------------------

   The following names and NAIF ID codes are assigned to the DART s/c, 
   its structures and science instruments (the keywords implementing
   these definitions are located in the section "DART NAIF ID Codes --
   Definition Section" at the end of this file):

   DART and DART Structures names/IDs:
   -----------------------------------
            DART                     -135   
            
            DART_SOLARARRAY_POS      -135001           
            DART_SOLARARRAY_NEG      -135002  
                     
            DART_HIGH_GAIN_ANTENNA   -135003

            DART_THRUSTER_A1         -135201
            DART_THRUSTER_A2         -135202
            DART_THRUSTER_A3         -135203
            DART_THRUSTER_A4         -135204
            DART_THRUSTER_B1         -135211
            DART_THRUSTER_B2         -135212
            DART_THRUSTER_B3         -135213
            DART_THRUSTER_B4         -135214
            DART_THRUSTER_C1         -135221
            DART_THRUSTER_C2         -135222
            DART_THRUSTER_C3         -135223
            DART_THRUSTER_C4         -135224

            DART_LICIA_MOUNT         -135300

   DRACO names/IDs:
   ----------------
            DART_DRACO_1X1           -135101 
            DART_DRACO_2X2           -135102


DART Frames
------------------------------------------------------------------------

   The following DART frames are defined in this kernel file:

           Name                    Relative to           Type        NAIF ID
      ======================    ===================  ============    =======

   DART Spacecraft and Spacecraft Structures frames:
   -------------------------------------------------
      DART_SPACECRAFT             J2000                  CK          -135000
      
      DART_SOLARARRAY_POS         DART_SPACECRAFT        CK          -135001
     
      DART_SOLARARRAY_NEG         DART_SPACECRAFT        CK          -135002

      DART_HIGH_GAIN_ANTENNA      DART_SPACECRAFT        CK          -135003

   DRACO frames:
   ------------------------------------------------
      DART_DRACO                  DART_SPACECRAFT        FIXED       -135100
      

DART Frames Hierarchy
------------------------------------------------------------------------

  The diagram below shows the DART spacecraft, its structures, and its
  science instrument frame hierarchy.


                               "J2000" INERTIAL
         +-------------------------------------------------------+
         |                          |           |                |
         |<-pck                     |<-ck       |<-pck           |<-pck
         V                          |           V                V
    "EARTH_FIXED"                   |    "IAU_DIMORPHOS"   "IAU_DIDYMOS"     
    -------------                   |    ---------------   -------------
                                    |           |                |
                                    |           |<-fixed         |<-fixed
                                    |           |                |
                                    |           V                V
                                    |   "DIMORPHOS_FIXED"  "DIDYMOS_FIXED"
                                    |   -----------------  ---------------
                                    V               
                             "DART_SPACECRAFT"      
              +---------------------------------------------------+   
              |                |             |                    |           
              |<-ck            |<-fixed      |<-ck                |<-ck 
              V                |             V                    V         
   "DART_HIGH_GAIN_ANTENNA"    |   "DART_SOLARARRAY_POS"  "DART_SOLARARRAY_NEG"
    ----------------------     |    -------------------    -------------------
                               |      
                               |        
                               V
                       "DART_DRACO_BASE"
                       -----------------
                               |
                               |<-fixed
                               |
                               V
                          "DART_DRACO"
                          ------------
                                 

DART Spacecraft and Spacecraft Structures Frames
-------------------------------------------------------------------------------

   This section of the file contains the definitions of the spacecraft
   and spacecraft structures frames.


DART Spacecraft Bus Frame
-----------------------------------------------------------

   The spacecraft bus frame -- DART_SPACECRAFT -- is defined by the s/c
   design as follows:

      -  +X axis is normal to the #2 bus panel.

      -  +Z axis is normal to the forward (payload) deck (#6 panel)

      -  +Y axis is normal to the #1 panel and completes the right handed
         coordinate system.

      -  the origin of the frame is at the center of the engine deck.


   These diagrams illustrate the s/c frame:

   +X side view:
   -------------
      
                                    +Zsc ___
                                    |___^___|  Main Engine 
                                    /   |   \           
                                  .-----|-----.                          
    .===\ \==========='.        .------ |-------.        .'============\ \===.
    ||  / /           ||        |       |       |        ||            / /  ||
    ||  / /           ||   \.---------- o--------> -./   ||            / /  ||
    ||  / /           ||    |       +Xsc       +Ysc |    ||            / /  ||
    ||  \ \           ||    |                       |    ||            \ \  ||
    ||  / /           ||    |                     .''''. ||            / /  ||
    ||  \ \           ||    |                    '      '||            \ \  ||
    ||  / /           ||===@|                    |  HGA  ||            / /  ||
    ||  \ \           ||    |                    '      '||            \ \  ||
    ||  / /           ||    |                     '....' ||            / /  ||
    ||  \ \           ||    |         :             |    ||            \ \  || 
    ||  / /           ||    |       :::             |    ||            / /  ||
    ||  \ \           ||   /`-----..---.------------'\   ||            \ \  ||
    ||  / /           ||          ||   |      |          ||            / /  ||
    '===\ \===========.'          '-===-------'          '.============\ \===' 
       -Y Solar Array               |_______|               +Y Solar Array
                               Payload              
                               Deck     |
                                        | toward asteroid 
                                        v
                                                 +Xsc is out of the page.
   +Z side view (Main Engine):
   ---------------------------
   
                             o       
                             |.------.               /'@--o============/ /==o
                            .-----------------------.        +Y solar array
                            |                      0|         
                            |       .-'''-.         |            
                            |    .'    ..   '.      |          
                            |   /   +Zsc   `. +Ysc  |    
                            |   |   |   o-------->  |    
                       Star |   \   '.  |  .'       |    
                    Tracker |    '.   ` | '  Main   |    /      
                           >|       '---|- engine   |_  /            
                            |0          |          0|_=/  HGA   
                            `-----------v-----------' /
      o==/ /==========o>--@./         +Xsc           /
         -Y solar array
                                                 +Zsc is out of the page.
                                                 
   -X side view:
   -------------     
                                      
                                        ^
                                        | Toward asteroid
                               Payload  |
                               Deck  _______           
                                    |       |                        
    .===\ \==========='.          .-----------.          .'============\ \===.
    ||  / /           ||          |  +Xsc |  ||          ||            / /  ||
    ||  / /           ||   \.---------- x--------> -./   ||            / /  ||
    ||  / /           ||    |           |  ::: +Ysc |    ||            / /  ||
    ||  \ \           ||    |           |    :      |    ||            \ \  ||
    ||  / /           ||    |           |           |''. ||            / /  ||
    ||  \ \           ||    |           v           |HGA'||            \ \  ||
    ||  / /           ||===@|         +Zsc          |@===||            / /  ||
    ||  \ \           ||    |                       |   '||            \ \  ||
    ||  / /           ||    |                       |..' ||            / /  ||
    ||  \ \           ||    |                       |    ||            \ \  || 
    ||  / /           ||    |                       |    ||            / /  ||
    ||  \ \           ||   /`-----------------------'\   ||            \ \  ||
    ||  / /           ||        |               |        ||            / /  ||
    '===\ \===========.'        '---------------'        '.============\ \===' 
       -Y Solar Array              '---------'             +Y Solar Array
                                    \_______/       
                                    |_______|  Main Engine 

                                    
                                                 +Xsc is inside the page.

   +Y side view:
   -------------
                                +Y Solar Array    
                  :=======================================:  
                                  |       |
                    \.____________@=======@____________./            
                 .---|                                 |--.   Payload
               .-|   |                                 |--'   deck
        +Zsc .'| |   |                                 |---.
          .--| | |   |                                 |   |--.      
          <----------o +Ysc                            |   |  | -----> Toward 
          '--| | |   |                                 |   |--'       asteroid
       Main  '.| |   |               ...               |---'          
      Engine   '-|   |            .'     '.            |--.
                 '---|___________'   HGA   '___________|--'
                     v           '.       .'            \
                   +Xsc           |' ... '|
                  :======================================:                     
                                -Y Solar Array   
                                                +Ysc is out of the page.
                                                

   -Z side view (Payload):
   -----------------------
                                                   o
      o==/ /==========o--@'\               .------.|
       +Y solar array       .-----------------------.
                            |   .---. Battery       |
                            |   |   |               |< Star
                            |   '---'  .. Draco     |  Tracker
                            +Ysc    +Zsc   `.       |
                            |  <--------x   |       |
                            |       '.  |  .'       |
                            |         ` | ' .---.   |
                            |           |   |   |   |
                            |           |   '---'   |
                            `-----------v-----------'
                                       +Xsc          \.@--o============/ /==o
                                                         -Y solar array

                                                 +Zsc is into the page.
                                                 

   Since the S/C bus attitude is provided by a C kernel (see [3] for
   more information), this frame is defined as a CK-based frame.

   \begindata

        FRAME_DART_SPACECRAFT        = -135000
        FRAME_-135000_NAME           = 'DART_SPACECRAFT'
        FRAME_-135000_CLASS          = 3
        FRAME_-135000_CLASS_ID       = -135000   
        FRAME_-135000_CENTER         = -135
        CK_-135000_SCLK              = -135
        CK_-135000_SPK               = -135

   \begintext


Solar Array Frames
------------------------------------------------------------------------

   DART solar arrays are articulated (having one degree of freedom),
   therefore the Solar Array frames, DART_SOLARARRAY_POS and
   DART_SOLARARRAY_NEG, are defined as CK frames with their orientation
   given relative to DART_SPACECRAFT. The orientation of these frames
   is provided by the mechanical gimbal angle given by each SADA 
   potentiometer.
   
   Given that the solar arrays are initially folded in the ROSA 
   (Roll Out Solar Array) mechanism, and are deployed after launch, 
   the gimbal reference frames are defined with respect to the ROSA 
   reference frames. The accounts for a portion of the rotation from
   body frame to solar array frame. There is a further 30 deg rotation
   on each gimbal due to mounting constraints.
   
   The ROSA frames are on opposite sides of the s/c and are not aligned
   relative to the spacecraft body axes. The current position of the ROSA 
   frame for each solar array can be computed in terms of the mechanical 
   gimbal angle  as follows: 
   
      c(a)  = cos(a); cd(a) = cosd(a)
      s(a)  = sin(a); sd(a) = sind(a)
      
      ap = +Y SADA angle; am = -Y SADA angle.
      
      SA-Y:
      
        .- -.        .-                       -.  .- -.     
        | X |        |  0 -s(am-30) -c(am-30)  |  | X |        
        | Y |     =  | -1  0           0       |  | Y |        
        | Z |        |  0  c(am-30) -s(am-30)  |  | Z |        
        `- -' S/C    `-                       -'  `- -' SA-Y 
        
      SA+Y:
      
        .- -.        .-                       -.  .- -.     
        | X |        |  0  s(ap-30)  c(ap-30)  |  | X |
        | Y |     =  |  1  0           0       |  | Y |   
        | Z |        |  0  c(ap-30) -s(ap-30)  |  | Z |        
        `- -' S/C    `-                       -'  `- -' SA+Y 

   
   Note, the subtraction of 30 accounts for a 30 deg (pi/6 rad) clocking
   applied to each SADA due to mounting restrictions.


   Both Solar Array frames (DART_SOLARARRAY_POS and DART_SOLARARRAY_NEG) are
   defined as follows:

      -  +X extends along the rotation axis of the gimbal and a 
         counter-clockwise rotation about this axis produces a 
         positive angle increase relative to the gimbal 
         potentiometer;
          
      -  +Y is the sun-positive normal vector that is to be aligned with
         the spacecraft-to-sun vector;

      -  +Z completes the right-handed frame;

      -  the origin of the frame is located at the yoke geometric center.


   This diagram illustrates the DART_SOLARARRAY_POS and DART_SOLARARRAY_NEG 
   frames. Both solar arrays are at a gimbal angle of 30 deg, and their +Z
   axes align with the DART_SPACECRAFT +Z axis. (denoted sa_pos, sa_neg)

   +Z side view:
   -------------
                                              +Ysa_pos ^  
                                                       |  
                                                       |
                                                       |      
                            o                          |      +Xsa_pos
                            |.------.        +Zsa_pos/'o---------> ====/ /==o
                            .-----------------------.        
                            |                      0|         
                            |       .-'''-.         |            
                            |    .'    ..   '.      |          
                            |   /   +Zsc   `. +Ysc  |      
                            |   |   |   o-------->  |    
                       Star |   \   `.  |   '       |    
                    Tracker |    '.   ` | '  Main   |    /      
                           >|       '---|- engine   |_  /            
                            |           |          0|_=/  HGA   
           +Xsa_neg         .-----------v-----------' /
      o==/ /=== <---------o/+Zsa_neg +Xsc            /
         -Y solar array   |
                          |                      +Zsc, +Zsa_pos, and +Zsa_neg  
                          |                      are out of the page.
                          |                      
                          v +Ysa_neg          


   These sets of keywords define solar array frames:

   \begindata

      FRAME_DART_SOLARARRAY_POS       = -135001
      FRAME_-135001_NAME              = 'DART_SOLARARRAY_POS'
      FRAME_-135001_CLASS             =  3
      FRAME_-135001_CLASS_ID          = -135001
      FRAME_-135001_CENTER            = -135
      CK_-135001_SCLK                 = -135
      CK_-135001_SPK                  = -135

      FRAME_DART_SOLARARRAY_NEG       = -135002
      FRAME_-135002_NAME              = 'DART_SOLARARRAY_NEG'
      FRAME_-135002_CLASS             =  3
      FRAME_-135002_CLASS_ID          = -135002
      FRAME_-135002_CENTER            = -135
      CK_-135002_SCLK                 = -135
      CK_-135002_SPK                  = -135

   \begintext


High-Gain Antenna Frames
------------------------------------------------------------------------

   The DART High Gain Antenna is attached to the s/c bus +Y panel by a 
   gimbal providing one degree of freedom to articulate during flight to
   track the Earth. 
   
   The HGA frame is first rotated 52.47 degrees counter-clockwise about the
   the s/c +Z axis. This intermediate frame is denoted as the ``self''
   frame. Then, a second rotation of +30 degrees about 
   the ``self`` frame +Y axis is performed to reach the final alignment, 
   denoted as the ``gimbal`` frame. As the gimbal 
   rotates, the ``HGA`` frame -- DART_HIGH_GAIN_ANTENNA --, representing 
   the current orientation of the antenna boresight, can be computed in 
   terms of the mechanical gimbal angle, a, as follows:

      c(a) = cos(a); cd(a) = cosd(a)
      s(a) = sin(a); sd(a) = sind(a)

      HGA:
                       S2SC                       G2S               HGA2G
      .- -.   .-                     -.    .-              -.   .-           -.
      | X |   | cd(52.47) -sd(52.47) 0 |   | c(30)  0 s(30) |   | c(a) 0 s(a) |
      | Y | = | sd(52.47)  cd(52.47) 0 | * | 0       1 0    | * | 0    1 0    |
      | Z |   | 0           0        1 |   | -s(30) 0 c(30) |   | s(a) 0 c(a) |
      `- -'   `-                      -'   `-              -'   `-           -'
       S/C                        

   
   The DART_HIGH_GAIN_ANTENNA frame is defined as follows:

      -  +X axis is aligned with the boresight of the antenna and is to 
         be aligned with the spacecraft-to-earth vector;

      -  +Y axis extends along the rotation axis of the gimbal, and a 
         counter-clockwise motion about this axis produces a positive angle 
         increase relative to the gimbal potentiometer;

      -  +Z axis completes the right hand frame;

      -  the origin of the frame is located at the phase center
         (theoretical and nominal location).
   
   
   The HGA angle ranges from 0 degrees at the lower hardstop (launch-lock) 
   position, to -55 degrees at the upper range of motion. Note, lower and 
   upper are used in reference to the s/c +Z axis: in the lower hardstop 
   position (0 deg), the antenna boresight has the largest -Z component 
   relative to the DART_SPACECRAFT frame. At the upper range of motion 
   (-55 deg), the antenna boresight has the largest +Z component relative 
   to the DART_SPACECRAFT frame. In operations, due to protective limits
   placed on the control, the angle will gimbal angle will never rise 
   above -3 deg or go below -52 deg.
   
   This diagram illustrates the DART HGA frame chain when the gimbal
   boresight is directly in the x-y plane of DART_SPACECRAFT. This
   corresponds to a gimbal angle of -30 deg. (denoted hga)

   +Z side view:
   -------------
                             o         
                             |.------.               /'@--o============/ /==o
                            .-----------------------.        +Y solar array
                            |                      0|         
                            |       .-'''-.         |            
                            |    .'    ..   '.      |        
                            |   /   +Zsc   `. +Ysc  |       +Yhga
                            |   |   |   o-------->  |      .
                       Star |   \   `.  |        ^        .       
                    Tracker |    '.   ` | ' .'    `.|    /          
                           >|       '--.|.-'        `.  / +Zhga               
                            |0          |          0|_'o'.        
                            `-----------v-----------' /    ' .+Xhga 
      o==/ /==========o>--@./         +Xsc           / HGA     '
         -Y solar array                                
                                                                
                                                 +Zsc and +Zhga are out 
                                                 of the page.              
                                                 
   This set of keywords defines the HGA frames:

   \begindata

      FRAME_DART_HIGH_GAIN_ANTENNA    = -135003
      FRAME_-135003_NAME              = 'DART_HIGH_GAIN_ANTENNA'
      FRAME_-135003_CLASS             =  3
      FRAME_-135003_CLASS_ID          = -135003
      FRAME_-135003_CENTER            = -135
      CK_-135003_SCLK                 = -135
      CK_-135003_SPK                  = -135

   \begintext


DRACO Frame
------------------------------------------------------------------------

   The Didymos Reconnaissance and Asteroid Camera for OpNav (DRACO) frame 
   -- DART_DRACO -- is defined by the camera design as follows:
   
      -  +Z axis is co-aligned with the s/c +Z axis.  The camera
         boresight is along the s/c -Z axis.
      
      -  +X axis is nominally rotated 135 degrees around the 
          s/c +Z axis

      -  +Y axis completes the right hand frame

      -  the origin of the frame is at the camera focal point.

   This diagram illustrates the camera frames:


   -Z side view (Payload):
   -----------------------
                                                   o
      o==/ /==========o--@'\               .------.|
       +Y solar array      +Xdraco -----------------.
                            |    ^              .> +Ydraco
                            |   | '.          .'    |< Star
                            |   '---'. ..   .'      |  Tracker
                            +Ysc      '.  .'        |
                            |  <--------x' +Zdraco  |          
                            |       '.  |  +Zdart   |
                            |         ' | ' .---.   |
                            |           |   |   |   |
                            |           |   '---'   |
                            `-----------v-----------'
                                       +Xsc          \.@--o============/ /==o
                                                         -Y solar array

                                                 +Zsc and +Zdraco are 
                                                  into the page.   

   +X side view:
   -------------
      
                                    +Zsc ___
                                    |___^___|  Main Engine 
                                    /   |   \           
                                  .-----|-----.                          
    .===\ \==========='.        .------ |-------.        .'============\ \===.
    ||__ / /__________||        |       |       |        ||____________/ /__||
    ||  / /           ||   \.---------- o--------> -./   ||            / /  ||
    ||  / /           ||    |       +Xsc       +Ysc |    ||            / /  ||
    ||  \ \           ||    |                       |    ||            \ \  ||
    ||  / /           ||    |                     .''''. ||            / /  ||
    ||  \ \           ||    |                    '      '||            \ \  ||
    ||  / /           ||===@|                    |  HGA  ||            / /  ||
    ||  \ \           ||    |                    '      '||            \ \  ||
    ||  / /           ||    |                     '._ .' ||            / /  ||
    ||  \ \           ||    |         :  +Zdraco    |    ||            \ \  || 
    ||  / /           ||    |       ::: ^           |    ||            / /  ||
    ||__\ \___________||   /`-----..---.|-----------'\   ||____________\ \__||
    ||  / /           ||          ||   ||     |          ||            / /  ||
    '===\ \===========.'          '-===-|-----'          '.============\ \===' 
       -Y Solar Array               |___o___|               +Y Solar Array  

                                                 +Xsc is out of the page.
      
   The DART_DRACO_BASE frame is the ideal, intended orientation of the
   DART_DRACO frame to DART_SPACECRAFT.

   \begindata

        FRAME_DART_DRACO_BASE        = -135101
        FRAME_-135101_NAME           = 'DART_DRACO_BASE'
        FRAME_-135101_CLASS          = 4
        FRAME_-135101_CLASS_ID       = -135101
        FRAME_-135101_CENTER         = -135
        TKFRAME_-135101_SPEC         = 'MATRIX'
        TKFRAME_-135101_RELATIVE     = 'DART_SPACECRAFT'
        TKFRAME_-135101_MATRIX       = ( -0.707107, -0.707107, 0.0,
                                          0.707107, -0.707107, 0.0,
                                          0.0,       0.0,      1.0 )
   \begintext

   The DART_DRACO_CRUISE frame is based on star calibrations and
   represents the orientation of the true DART_DRACO frame to
   DART_DRACO_BASE.

   \begindata

        FRAME_DART_DRACO_CRUISE      = -135102
        FRAME_-135102_NAME           = 'DART_DRACO_CRUISE'
        FRAME_-135102_CLASS          = 4
        FRAME_-135102_CLASS_ID       = -135102
        FRAME_-135102_CENTER         = -135
        TKFRAME_-135102_SPEC         = 'MATRIX'
        TKFRAME_-135102_RELATIVE     = 'DART_DRACO_BASE'
        TKFRAME_-135102_MATRIX       = (
           9.999809593534547e-01, 4.860188998885242e-03, 3.802564061190165e-03
          -4.872961812996770e-03, 9.999824923207679e-01, 3.356977079834627e-03
          -3.786181944045400e-03,-3.375442910282243e-03, 9.999871355229756e-01
                                       )

   \begintext

   The DART_DRACO_TERMINAL frame was used during terminal operations,
   based on the expected thermal environment.  It was uploaded to the
   spacecraft on 2022 Sep 02.

   \begindata

        FRAME_DART_DRACO_TERMINAL    = -135103
        FRAME_-135103_NAME           = 'DART_DRACO_TERMINAL'
        FRAME_-135103_CLASS          = 4
        FRAME_-135103_CLASS_ID       = -135103
        FRAME_-135103_CENTER         = -135
        TKFRAME_-135103_SPEC         = 'QUATERNION'
        TKFRAME_-135103_RELATIVE     = 'DART_SPACECRAFT'
        TKFRAME_-135103_Q            = ( 0.385006657984158,
                                        -0.00114441056377788,
                                        -0.00232570706525416,
                                        -0.922910155280013
                                       )

   \begintext

   The DART_DRACO frame is defined as a switch frame, where the cruise
   frame is used before 2022 Sep 02 and the terminal frame is used
   after that date.

   \begindata

        FRAME_DART_DRACO             = -135100
        FRAME_-135100_NAME           = 'DART_DRACO'
        FRAME_-135100_CLASS          = 6
        FRAME_-135100_CLASS_ID       = -135100
        FRAME_-135100_CENTER         = -135
        FRAME_-135100_ALIGNED_WITH   = (
          'DART_DRACO_CRUISE'
          'DART_DRACO_TERMINAL'
                                       )
        FRAME_-135100_START          = (
        @2021-NOV-27/12:00:00
        @2022-SEP-02/00:00:00
                                       )
        FRAME_-135100_STOP           = (
        @2022-SEP-02/00:00:00
        @2022-SEP-27/00:00:00
                                       )

   \begintext


Thruster positions
------------------------------------------------------------------------

There are three sets of four thrusters on the spacecraft.  The
positions of the nozzle exit in mm from the spacecraft center of mass
in the spacecraft frame are tabulated below.  This information is
captured in the DART structure SPK.


      Component          ID       X (mm)    Y (mm)   Z (mm)
      ----------------   -------  ------    ------   ------

      DART_THRUSTER_A1   -135201  683.95    285.01   1548.38
      DART_THRUSTER_A2   -135202 -683.95    285.01   1548.38
      DART_THRUSTER_A3   -135203 -683.95   -285.01   1548.38
      DART_THRUSTER_A4   -135204  683.95   -285.01   1548.38

      DART_THRUSTER_B1   -135211  683.95    285.01     96.01
      DART_THRUSTER_B2   -135212 -683.95    285.01     96.01
      DART_THRUSTER_B3   -135213 -683.95   -285.01     96.01
      DART_THRUSTER_B4   -135214  683.95   -285.01     96.01

      DART_THRUSTER_C1   -135221  679.02    389.97   1581.17 
      DART_THRUSTER_C2   -135222 -679.02    389.97   1581.17 
      DART_THRUSTER_C3   -135223 -679.02   -389.97   1581.17 
      DART_THRUSTER_C4   -135224  679.02   -389.97   1581.17 



DART NAIF ID Codes -- Definitions
=====================================================================

   This section contains name to NAIF ID mappings for the DART mission.
   Once the contents of this file are loaded into the KERNEL POOL, these
   mappings become available within SPICE, making it possible to use
   names instead of ID code in high level SPICE routine calls.
   
   \begindata
   
      NAIF_BODY_NAME   += ( 'DART' )                        
      NAIF_BODY_CODE   += ( -135   )


      NAIF_BODY_NAME   += ( 'DART_SPACECRAFT' )       
      NAIF_BODY_CODE   += ( -135000           )

      NAIF_BODY_NAME   += ( 'DART_SOLARARRAY_POS' )
      NAIF_BODY_CODE   += ( -135001      ) 

      NAIF_BODY_NAME   += ( 'DART_SOLARARRAY_NEG' )
      NAIF_BODY_CODE   += ( -135002      )

      NAIF_BODY_NAME   += ( 'DART_HIGH_GAIN_ANTENNA' )
      NAIF_BODY_CODE   += ( -135003    )


      NAIF_BODY_NAME   += ( 'DART_DRACO_1X1' )
      NAIF_BODY_CODE   += ( -135101          )

      NAIF_BODY_NAME   += ( 'DART_DRACO_2X2' )
      NAIF_BODY_CODE   += ( -135102          )
      

      NAIF_BODY_NAME   += ( 'DART_THRUSTER_A1' )
      NAIF_BODY_CODE   += ( -135201            )
      
      NAIF_BODY_NAME   += ( 'DART_THRUSTER_A2' )
      NAIF_BODY_CODE   += ( -135202            )
      
      NAIF_BODY_NAME   += ( 'DART_THRUSTER_A3' )
      NAIF_BODY_CODE   += ( -135203            )
      
      NAIF_BODY_NAME   += ( 'DART_THRUSTER_A4' )
      NAIF_BODY_CODE   += ( -135204            )
      
      NAIF_BODY_NAME   += ( 'DART_THRUSTER_B1' )
      NAIF_BODY_CODE   += ( -135211            )
      
      NAIF_BODY_NAME   += ( 'DART_THRUSTER_B2' )
      NAIF_BODY_CODE   += ( -135212            )
      
      NAIF_BODY_NAME   += ( 'DART_THRUSTER_B3' )
      NAIF_BODY_CODE   += ( -135213            )
      
      NAIF_BODY_NAME   += ( 'DART_THRUSTER_B4' )
      NAIF_BODY_CODE   += ( -135214            )
      
      NAIF_BODY_NAME   += ( 'DART_THRUSTER_C1' )
      NAIF_BODY_CODE   += ( -135221            )
      
      NAIF_BODY_NAME   += ( 'DART_THRUSTER_C2' )
      NAIF_BODY_CODE   += ( -135222            )
      
      NAIF_BODY_NAME   += ( 'DART_THRUSTER_C3' )
      NAIF_BODY_CODE   += ( -135223            )
      
      NAIF_BODY_NAME   += ( 'DART_THRUSTER_C4' )
      NAIF_BODY_CODE   += ( -135224            )
      
      NAIF_BODY_NAME   += ( 'DART_LICIA_MOUNT' )
      NAIF_BODY_CODE   += ( -135300            )
      
   \begintext
   

End of FK file.
