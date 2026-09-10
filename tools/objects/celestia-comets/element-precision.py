# Independent offline diagnostic of rounding in the printed JPL elements.
# Standard-library Decimal at 70 digits; never used for scene preparation.
import json,decimal,re,math
from pathlib import Path
D=decimal.Decimal;decimal.getcontext().prec=70
pi=D('3.1415926535897932384626433832795028841971693993751058209749445923078164')
def sc(x):
    s=t=x;c=u=D(1)
    for k in range(1,150):
        t*=-x*x/D(2*k*(2*k+1));s+=t
        u*=-x*x/D((2*k-1)*(2*k));c+=u
    return s,c
def evaluate(v):
    e,q,inc,node,peri,tp,n,m,ta,a=map(D,v[2:12]);inc*=pi/180;node*=pi/180;peri*=pi/180;m*=pi/180;sign=D(-1) if m<0 else D(1);m=abs(m)
    lo=D(0);hi=D(10)
    for i in range(220):
        h=(lo+hi)/2
        if e>1: sh=(h.exp()-(-h).exp())/2;ch=(h.exp()+(-h).exp())/2;res=e*sh-h-m
        else: sh,ch=sc(h);res=h-e*sh-m
        if res>0:hi=h
        else:lo=h
    if e>1:x=a*(ch-e);y=-a*((e-1)*(e+1)).sqrt()*sh*sign
    else:x=a*(ch-e);y=a*(1-e*e).sqrt()*sh
    si,ci=sc(inc);sn,cn=sc(node);sp,cp=sc(peri)
    p=[(cp*cn-sp*sn*ci)*x+(-sp*cn-cp*sn*ci)*y,(cp*sn+sp*cn*ci)*x+(-sp*sn+cp*cn*ci)*y,sp*si*x+cp*si*y]
    return p,abs(a*(1-e)-q)
results=[]
for catalog in sorted(Path('src/planets').glob('comet-*/source/reference/celestia.ssc')):
    s=catalog.parent;id=s.parents[1].name
    line=(s/'horizons-elements.txt').read_text().split('$$SOE')[1].strip().splitlines()[0]
    fields=[v.strip() for v in line.split(',')]
    p,qerr=evaluate(fields)
    vector=(s/'horizons-vectors.txt').read_text().split('$$SOE')[1].strip().splitlines()[1]
    expected=list(map(D,vector.split(',')[2:5]))
    error=sum((a-b)**2 for a,b in zip(p,expected)).sqrt()
    results.append({'id':id,'highPrecisionElementEpochErrorKm':float(error),'printedPerihelionInconsistencyKm':float(qerr)})
print(json.dumps(results,indent=2))
