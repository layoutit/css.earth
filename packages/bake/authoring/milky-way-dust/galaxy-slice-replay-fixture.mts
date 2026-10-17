export const REPLAY_FIXTURE = String.raw`
import os,json,sys,subprocess,numpy as np
root,script,controls=sys.argv[1:];os.makedirs(root,exist_ok=True)
z,y,x=np.mgrid[:5,:5,:5]
q=dict(camRG=-.2,camRB=.1,camGR=.15,camGB=-.1,camBR=.05,camBG=.1,wbSkyR=1.3,wbSkyB=.8,camSaturation=.7)
m=dict(dims=[5,5,5],box=[-.17,1.43,-.4,1.2,-.08,.24],originKpc=[-.17,-.4,-.08],spacingKpc=[.4,.4,.08],camera=q,extinctionPerChannel=[.6,1,1.3])
json.dump(m,open(root+'/meta.json','w'));json.dump({'params':{'logExposure':-.7}},open(root+'/fit.json','w'))
e=np.stack((.1+x*.11+y*.03,.05+y*.08+z*.02,.03+z*.09+x*.01),axis=-1).astype('<f4');e.tofile(root+'/emission.f32')
(.01+np.stack((x+y,y+z,z+x),axis=-1)*.003).astype('<f4').tofile(root+'/scatter.f32')
(.02+x*.05+y*.03+z*.07).astype('<f4').tofile(root+'/dust.f32')
subprocess.run([sys.executable,script,root,root+'/out',root+'/fit.json',controls],check=True)
`;
