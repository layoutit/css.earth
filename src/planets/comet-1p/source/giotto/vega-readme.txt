                        00readme.txt

   The magnetometers on Vega 1 and Vega 2 (PI: Prof. Willi Riedler) were
designed to measure the magnetic field and its low-frequency fluctuations in the
cometary and solar wind interaction zone and in interplanetary space. The
instrument on each spacecraft consisted of two fluxgate sensor units (one axial
and triaxial) mounted 1 m apart on a 2-m boom.
The axial unit was oriented along the spacecraft symmetry (X) axis, which was
perpendicular to the solar panels and pointed toward the Sun. Each sensor had a
dynamic range of ± 100 nT and a sensitivity of 0.05 nT.  Magnetic field vectors
were measured with a sampling frequency of 10 vectors per second. The
magnetometers operated in three data rate modes: 1) the measured components were
averaged during 2.5 minutes and transmitted to telemetry; 2) the measured
components were averaged during 1 minute and transmitted to telemetry; 3) direct
transmission mode, the measured components were transmitted to telemetry without
averaging.  Cruise phase data were mostly taken in the 2.5-min averaging mode.

    During the cruise phase from Earth to Venus (12/84-06/85) both Vega-1 and
Vega-2 spacecraft had one-axis orientation i.e. the spacecraft X axis was
maintained sunward-pointing, while the spacecraft Y and Z axes rotated about the
X axis.  The spin phase of this rotation was not known, therefore the directions
of By and Bz components are unknown. Magnetometer data for this period are
presented in spacecraft coordinates as Br (directed radially from spacecraft to
the Sun), Bysc, Bzsc. From the providers: "It is proposed to use for analysis of
the interplanetary magnetic field during this period the Br component and the
total B=sqrt(Bxsc^2+Bysc^2+Bzsc^2). Bysc and Bzsc components are included in the
data, but keep in mind that the orientation of these axes is unknown. It can be
considered as fixed during periods up to a few hours, so the data can be used to
look for IMF discontinues and IMF orientation variations. "

      After Venus flybys (June, 11-15, 1985) up to Comet Halley (March, 6 and 9, 1986)
and sometimes later Vega-1 and Vega-2 had three-axis stabilized orientations.
After-Venus magnetic field data are presented in spacecraft-centered solar ecliptic (SE)
coordinate system as Br, Bzse, Byse, B, where Br is directed from the spacecraft to 
the Sun, Bzse is directed along Bz axes of the Solar Ecliptic system (to ecliptic pole),
Byse completes the right handed set and B=sqrt(Br^2+By^2+Bz^2).

     Spacecraft position data are presented in HelioGraphic Inertial (HGI)
system.  For a description of this system, see
http://nssdc.gsfc.nasa.gov/space/helios/plan_des.html

The contents of each of the 2.5-min records -

    WORD  FORMAT    MEANING                              UNITS/COMMENTS

     1     I4       Year                                1984,1985, etc.
     2     I3       Month                               1,...,12
     3     I3       Day                                 1...,31
     4     I3       Hour                                0,...,23
     5     I3       Minute                              0,...,59
     6     I3       Second                              0,...,59
     7    F7.1      Magnetic field radial (+ to Sun) component, nT
     8    F7.1      Magnetic Field Bysc or Byse component, nT
     9    F7.1      Magnetic field Bzsc or Bzse component, nT
    10    F7.1      Total magnetic field B, nT
    11    F7.2      Spacecraft radial distance from Sun, au
    12    F7.1      HGI Spacecraft position  azimuth, degrees
    13    F7.1      HGI Spacecraft position  elevation, degrees
    14     I2       Flag=1 -magnetic data in SE, =0 - in spacecraft system  
------------------------------------------------------------------

   Mean hour data are presented in RTN system, spacecraft position in HelioGraphic
Inertial (HGI) system.
   The contents of each of the mean hour records -

    WORD  FORMAT    MEANING                              UNITS/COMMENTS

     1     I4       Year                                1984,1985, etc.
     2     I3       Month                               1,...,12
     3     I3       Day                                 1...,31
     4     I3       Hour                                0,...,23
     5    F7.1      Magnetic field radial Br  (+ from Sun) component, nT
     6    F7.1      Magnetic Field Bt component, nT (9999.9 if no data)
     7    F7.1      Magnetic field Bn component, nT (9999.9 if no data)
     8    F7.1      Average value of total magnetic field |B|, nT
     9    F7.3      Spacecraft radial distance from Sun, au
    10    F7.1      HGI Spacecraft position  azimuth, degrees
    11    F7.1      HGI Spacecraft position  elevation, degrees

  The  RTN  system is fixed at  a  spacecraft  (or the planet). The R axis
is directed radially away from the Sun, the T axis is the cross product of
the solar rotation axis and the R axis, and the N axis is the cross  product
of  R  and  T.  At  zero  Heliographic Latitude  when the spacecraft is in the 
solar equatorial plane the N and solar rotation axes are parallel.


------------------------------------------------------------------

     VEGA MAGNETIC FIELD FLYBY PHASE DATA 

  The FLYBY_1M (one minute) and FLYBY_HR (high resolution) files of the magnetic
field data contains data for intervals of the closest approach of the VEGA spacecrafts
to Halley comet.
    Files contains the following data: magnetic field data in SE coordinate system (for 
FLYBY_1M)  or in cometocentric (solar) ecliptic coordinates, CSE (for FLYBY_HR) and 
the position of the spacecraft in  CSE.
   CSE (CometoCentric ecliptic coordinate system) for the SC position: origin at comet
position, x-axis from comet to the Sun, z-axis to ecliptic northpole, (x,y)-plane is parallel
to the ecliptic plane.   
   CSE coordinate system for the magnetic field data: axes are parallel to the CSE system
for the position. This coord. system is valid only for VERY SHORT TIME, about 4 hours
around the closest approach of the SC to the Comet, since for a larger angular distance
of the SC from the Comet, the direction to the Sun from both objects will be 
different.

The contents of each of before flyby and flyby record -

    WORD  FORMAT    MEANING                              UNITS/COMMENTS

     1     I4       Year                                1984,1985, etc.
     2     I3       Month                               1,...,12
     3     I3       Day                                 1...,31
     4     I3       Hour                                0,...,23
     5     I3       Minute                              0,...,59
     6    F7.1      Second                              0,...,59.999
     7    F7.1      Magnetic Bx component (SE or CSE), nT
     8    F7.1      Magnetic Field By (SE or CSE), nT
     9    F7.1      Magnetic field Bz (SE or CSE), nT
    10    F7.1      Total magnetic field B, nT
    11    F7.2      X spacecraft position, CSE system, km
    12    F7.1      Y spasecraft position, CSE system, km
    13    F7.1      Z spacerarft position, CSE system, km
    14    F7.1      Distance between spacecraft and Halley comet, km 
------------------------------------------------------------------

Data were reprocessed in IZMIRAN, contact person: Dr. V.Styazhkin
(sva@izmiran.ru)

V. Petrov, Sep 2004
