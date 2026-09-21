# Exact excerpt from src/NbodyGradient/src/kepler_init.jl at the pinned author-repository commit.
# It defines the Table 2 transit convention used by the retained qualification fixture.
period = elements[1]
semi = cbrt(GNEWT*mass*period^2/4/pi^2)
ecc2=elements[3]^2+elements[4]^2
ecc=sqrt(ecc2)
omega = atan(elements[4],elements[3])
f1 = 1.5*pi-omega
sqrt1mecc2 = sqrt(1.0-ecc^2)
tp=(elements[2]+period*sqrt1mecc2/2.0/pi*(ecc*sin(f1)/(1.0+ecc*cos(f1))
    -2.0/sqrt1mecc2*atan(sqrt1mecc2*tan(0.5*f1),1.0+ecc)))
n = 2pi/period
m=n*(time-tp)
