"""Independent small source comparison; does not import the VIMS converter."""
import argparse,json,math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--repo-root',type=Path,default=Path.cwd())
parser.add_argument('--output-dir',type=Path,default=Path('output/b7-source-review'))
parser.add_argument('--font',help='Optional TrueType font; changes labels only, never numerical evidence.')
args=parser.parse_args();args.output_dir.mkdir(parents=True,exist_ok=True)
canvas=Image.new('RGB',(1580,900),'white'); draw=ImageDraw.Draw(canvas)
font=ImageFont.truetype(args.font,16) if args.font else ImageFont.load_default(size=16)
results={}
for index,(body,pia,name,west,lat,url) in enumerate([
 ('dione','PIA18434','Creusa',76.32,49.19,'https://planetarynames.wr.usgs.gov/Feature/1331'),
 ('rhea','PIA18438','Inktomi',112.10,-14.10,'https://planetarynames.wr.usgs.gov/Feature/14671')]):
 root=args.repo_root/f'src/planets/{body}/source'
 cube=root/f'vims/data/{body}/{body}_notnorm_pc_modified_2.img'
 with cube.open('rb') as f:
  f.seek(11*180*360*4); vims=np.frombuffer(f.read(180*360*4),dtype='<f4').reshape(180,360)
 image=Image.open(root/f'observations/{pia}.jpg'); image.draft('RGB',(720,360)); image=image.resize((360,180),resample=Image.Resampling.BOX)
 iss=np.array(image); score={}
 for key,samples in [('as-declared',vims),('north-south-flip',vims[::-1]),('east-west-flip',vims[:,::-1]),('longitude-180-shift',np.roll(vims,180,axis=1))]:
  good=np.isfinite(samples)&(samples!=-999);good[:30]=False;good[150:]=False
  score[key]=float(np.corrcoef(samples[good],iss[:,:,0][good])[0,1])
 lon=360-west; row=int(math.floor(90-lat)); col=int(math.floor(lon))
 reference=np.array([float(vims[r,c]) for r,c in [(row,col),(int(90+lat),col),(row,int(west)),(row,(col+180)%360)]])
 results[body]={'comparison':pia,'band':12,'wavelengthMicrometers':1.06495,'nativeShape':[360,180],
  'orientationCorrelationAgainstISSRedChannel':score,
  'anchor':{'name':name,'longitudeWestDegrees':west,'longitudeEastDegrees':lon,'latitudeDegrees':lat,'source':url,'nativeIndexZeroBased':[col,row],
  'nativeIF':float(reference[0]),'wrongNorthSouthIF':float(reference[1]),'wrongLongitudeSignIF':float(reference[2]),'wrong180ShiftIF':float(reference[3])},
  'qualification':'Supports row direction and longitude orientation only. Source-pixel absolute registration remains unresolved.'}
 for side,array,title in [(0,iss,f'{body.title()} ISS {pia}'),(1,vims,f'{body.title()} VIMS band12:1.06495 µm')]:
  x0=45+side*745; y0=80+index*415
  if array.ndim==2:
   good=(array!=-999)&np.isfinite(array)
   gray=np.where(good,np.clip(array/.65,0,1)*255,40).astype('uint8')
   tile=Image.fromarray(gray).convert('RGB')
  else: tile=Image.fromarray(array)
  canvas.paste(tile.resize((720,360),resample=Image.Resampling.NEAREST),(x0,y0))
  draw.text((x0,y0-25),title,fill='black',font=font)
  for latitude in [-90,-45,0,45,90]: draw.text((x0-38,y0+int((90-latitude)*2)-8),str(latitude),fill='black',font=font)
  for longitude in [0,90,180,270,360]: draw.text((x0+int(longitude*2)-8,y0+365),str(longitude),fill='black',font=font)
  px=x0+int(lon*2);py=y0+int((90-lat)*2)
  draw.line((px-7,py,px+7,py),fill='#f43f5e',width=2);draw.line((px,py-7,px,py+7),fill='#f43f5e',width=2)
  draw.text((px+8,py-22),name,fill='#f43f5e',font=font)
draw.text((30,15),'Native VIMS / independent ISS comparison: orientation proof, not subpixel registration',fill='black',font=font)
draw.text((30,39),'East longitude 0–360° across columns; north90° to south−90° across rows. Gray VIMS gaps remain missing.',fill='black',font=font)
canvas.save(args.output_dir/'registration-comparison.png')
(args.output_dir/'registration-evidence.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
