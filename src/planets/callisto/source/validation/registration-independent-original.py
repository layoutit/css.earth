from pathlib import Path
import json,hashlib,math,xml.etree.ElementTree as E
import numpy as np
import rasterio
from scipy.ndimage import map_coordinates,gaussian_filter
from PIL import Image,ImageDraw,ImageFont
p=Path('/tmp/b3-callisto');root=Path('/Users/ekrof/fed/cssEarth-pluto-small-moons')
fit=json.loads((p/'registration-exploratory.json').read_text());parameters=fit['parameters'];lat,lon,roll,cx,cy,r=parameters;lat,lon,roll=np.radians([lat,lon,roll]);ratio=739976.3/2410.3
photo=np.array(Image.open(p/'PIA03456-usgs.png'))[:,:,:3];grey=photo@np.array([.299,.587,.114]);H,W=grey.shape;yy,xx=np.mgrid[:H,:W];dx=(xx-cx)/(r*ratio);dy=(yy-cy)/(r*ratio);a=1+dx*dx+dy*dy;disc=ratio*ratio-a*(ratio*ratio-1);t=(ratio-np.sqrt(np.maximum(0,disc)))/a
O=np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)]);EE=np.array([-np.sin(lon),np.cos(lon),0]);N=np.cross(O,EE)
xe=t*(dx*np.cos(roll)+dy*np.sin(roll));yn=t*(dx*np.sin(roll)-dy*np.cos(roll));z=ratio-t
xyz=O[:,None,None]*z+EE[:,None,None]*xe+N[:,None,None]*yn
lons=np.degrees(np.arctan2(xyz[1],xyz[0]))%360;lats=np.degrees(np.arctan2(xyz[2],np.hypot(xyz[0],xyz[1])))
with rasterio.open(root/'src/planets/callisto/source/callisto-global-1km.tif') as f:
 data=f.read(1);transform=f.transform;R=f.crs.to_dict()['R'];metricX=R*np.radians(lons-180);metricY=R*np.radians(lats);col=(metricX-transform.c)/transform.a-.5;row=(metricY-transform.f)/transform.e-.5
 predicted=map_coordinates(data,[row,col],order=1,mode='constant',cval=0,prefilter=False,output=np.float32)
 meta={'width':f.width,'height':f.height,'dtype':f.dtypes[0],'transform':list(transform),'projection':f.crs.to_proj4(),'nodata':f.nodata}
 del data
valid=(disc>=0)&((xx-cx)**2+(yy-cy)**2<(r*.79)**2)&(predicted>0)
def corr(a,b):
 a=a.astype(float)-np.mean(a);b=b.astype(float)-np.mean(b);return float(np.sum(a*b)/math.sqrt(np.sum(a*a)*np.sum(b*b)))
quad=[]
for name,sx,sy in [('upper-left',0,0),('upper-right',1,0),('lower-left',0,1),('lower-right',1,1)]:
 q=valid&((xx>=W/2)if sx else(xx<W/2))&((yy>=H/2)if sy else(yy<H/2));quad.append({'region':name,'heldOutByRoot':sx!=sy,'pixels':int(q.sum()),'unblurredNcc':corr(grey[q],predicted[q]),'highPassSigma6Ncc':corr((grey-gaussian_filter(grey,6))[q],(predicted-gaussian_filter(predicted,6))[q])})
# Gazetteer coordinates were not used by the camera fit. The underlying image
# quadrants are identified separately, so no training pixels are called holdouts.
ns={'k':'http://www.opengis.net/kml/2.2'};gaz=E.fromstring((p/'agent-nomenclature.kml').read_bytes());names={'Vili','Valfodr','Alfr','Loni','Bran','Vidarr','Egres','Grimr'};features=[]
for pm in gaz.findall('.//k:Placemark',ns):
 d={e.attrib['name']:e.text for e in pm.findall('.//k:SimpleData',ns)}
 if d['clean_name']not in names:continue
 glon,glat=np.radians([float(d['center_lon']),float(d['center_lat'])]);pos=np.array([math.cos(glat)*math.cos(glon),math.cos(glat)*math.sin(glon),math.sin(glat)]);e,n,z=pos@EE,pos@N,pos@O
 x=cx+r*ratio/(ratio-z)*(e*np.cos(roll)+n*np.sin(roll));y=cy+r*ratio/(ratio-z)*(e*np.sin(roll)-n*np.cos(roll));xi,yi=int(round(x)),int(round(y));radius=12
 P=grey[yi-radius:yi+radius+1,xi-radius:xi+radius+1];scores=[]
 for oy in range(-4,5):
  for ox in range(-4,5):scores.append((corr(P,predicted[yi-radius+oy:yi+radius+1+oy,xi-radius+ox:xi+radius+1+ox]),ox,oy))
 best=max(scores);features.append({'name':d['clean_name'],'latitudeDegrees':float(d['center_lat']),'eastLongitudeDegrees':float(d['center_lon']),'diameterKm':float(d['diameter']),'gazetteerUrl':d['link'].replace('http:','https:'),'expectedPhotoPixel':[float(x),float(y)],'heldOutQuadrant':bool((x<W/2)!=(y<H/2)),'unshiftedLocalNcc':corr(P,predicted[yi-radius:yi+radius+1,xi-radius:xi+radius+1]),'bestDiagnosticNcc':best[0],'diagnosticMapOffsetPixels':list(best[1:]),'diagnosticSearchBoundary':max(abs(best[1]),abs(best[2]))==4})
# Annotations only. Pixels remain unchanged in the separate raw output files.
mask=disc>=0;out=np.uint8(np.clip(predicted,0,255));out[~mask]=0;Image.fromarray(out).save(p/'agent-native-predicted.png')
Image.fromarray(photo).save(p/'agent-source-unmodified.png')
left=Image.fromarray(photo);right=Image.fromarray(out).convert('RGB');drawer=[ImageDraw.Draw(left),ImageDraw.Draw(right)]
for f in features:
 x,y=f['expectedPhotoPixel']
 for d in drawer:d.line((x-6,y,x+6,y),fill=(255,255,0),width=1);d.line((x,y-6,x,y+6),fill=(255,255,0),width=1);d.text((x+7,y+3),f['name'],fill=(255,255,0))
combined=Image.new('RGB',(W*2,H));combined.paste(left,(0,0));combined.paste(right,(W,0));combined.save(p/'agent-named-fixed-camera.png')
thumbs=Image.new('RGB',(6*100,math.ceil(len(features)/2)*116),(30,30,30));draw=ImageDraw.Draw(thumbs)
for i,f in enumerate(features):
 x,y=map(lambda t:int(round(t)),f['expectedPhotoPixel']);box=(x-20,y-20,x+20,y+20);pair=[Image.fromarray(photo).crop(box),Image.fromarray(out).convert('RGB').crop(box)];baseX=(i%2)*300;baseY=(i//2)*116
 for j,img in enumerate(pair):thumbs.paste(img.resize((100,100),Image.Resampling.NEAREST),(baseX+j*104,baseY))
 draw.text((baseX,baseY+100),f['name']+' | plate / native map',fill=(255,255,255))
thumbs.save(p/'agent-feature-patches.png')
report={'status':'fixed-camera diagnostic; human visual review pending','parametersUnchanged':parameters,'fitSha256':hashlib.sha256((p/'registration-exploratory.json').read_bytes()).hexdigest(),'sourcePhotoSha256':hashlib.sha256((p/'PIA03456-usgs.png').read_bytes()).hexdigest(),'gazetteerKmzSha256':hashlib.sha256((p/'agent-CALLISTO-nomenclature.kmz').read_bytes()).hexdigest(),'mapMetadata':meta,'method':'Original unblurred 15138×7569 uint8 map sampled bilinearly at its exact projected pixel centers. No model, roll, radius, center or holdout refit. Local offsets are diagnostic only and never alter the camera. High-pass NCC is an additional diagnostic, not a source-image transformation.','quadrants':quad,'features':features,'outputHashes':[{'path':str(p/n),'sha256':hashlib.sha256((p/n).read_bytes()).hexdigest()}for n in ['agent-source-unmodified.png','agent-native-predicted.png','agent-named-fixed-camera.png','agent-feature-patches.png']]}
(p/'agent-fixed-camera-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'quadrants':quad,'features':features},indent=2))
