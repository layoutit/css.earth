export const EXTENT_FIXTURE = String.raw`
import os,json,sys,subprocess,numpy as np
from PIL import Image
root,script,controls=sys.argv[1:];os.makedirs(root,exist_ok=True)
z,y,x=np.mgrid[:5,:5,:5]
q=dict(camRG=-.2,camRB=.1,camGR=.15,camGB=-.1,camBR=.05,camBG=.1,wbSkyR=1.3,wbSkyB=.8,camSaturation=.7)
m=dict(dims=[5,5,5],box=[-.17,1.43,-.4,1.2,-.08,.24],originKpc=[-.17,-.4,-.08],spacingKpc=[.4,.4,.08],camera=q,extinctionPerChannel=[.6,1,1.3])
json.dump(m,open(root+'/meta.json','w'));json.dump({'params':{'logExposure':-.7}},open(root+'/fit.json','w'))
e=np.stack((.1+x*.11+y*.03,.05+y*.08+z*.02,.03+z*.09+x*.01),axis=-1).astype('<f4');e.tofile(root+'/emission.f32')
(.01+np.stack((x+y,y+z,z+x),axis=-1)*.003).astype('<f4').tofile(root+'/scatter.f32')
(.02+x*.05+y*.03+z*.07).astype('<f4').tofile(root+'/dust.f32')
subprocess.run([sys.executable,script,root,root+'/out',root+'/fit.json',controls],check=True)
path=root+'/extended';os.makedirs(path);em={**m,'dims':[17,17,17],'originKpc':(np.array(m['originKpc'])-6*np.array(m['spacingKpc'])).tolist()}
for key in ('physics','record'):m[key]=em[key]={} if key=='physics' else 'fixture'
json.dump(m,open(root+'/meta.json','w'));json.dump(em,open(path+'/meta.json','w'))
zz,yy,xx=np.mgrid[:17,:17,:17];signal=np.maximum(0,1-((xx-8)**2+(yy-8)**2+(zz-8)**2)/25)**2
for name,n in [('emission',3),('dust',1),('scatter',3)]:
 a=np.repeat(signal[...,None],3,axis=3)*[.3,.2,.1] if n==3 else signal*.03
 a.astype('<f4').tofile(path+'/'+name+'.f32')
opts=json.loads(controls);opts['inPlaneField']=path
subprocess.run([sys.executable,script,root,root+'/candidate',root+'/fit.json',json.dumps(opts)],check=True)
data=json.load(open(root+'/candidate/prototype.json'))
for leaf in data['leaves']:
 old=np.array(Image.open(root+'/out/'+leaf['texturePath']));new=np.array(Image.open(root+'/candidate/'+leaf['texturePath']))
 x,y,w,h=leaf['canonicalCrop'];assert np.array_equal(new[y:y+h,x:x+w],old),'image extension changes original pixels'
 assert np.max(new[:3,:,3])==np.max(new[-3:,:,3])==np.max(new[:,:3,3])==np.max(new[:,-3:,3])==0,'image extension lost its empty border'
assert 'intervals' not in data and 'directionalSets' not in data
print('IMAGE EXTENSION CORE AND EMPTY BORDER VERIFIED')
`;
