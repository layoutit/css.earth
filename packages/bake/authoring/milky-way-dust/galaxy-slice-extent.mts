/** Opt-in image-plane extension. The canonical field still owns every slab interval. */
export const GALAXY_SLICE_EXTENT_SETUP = String.raw`
image_dims=m['dims'];extended={};extent_meta=None
if opts.get('inPlaneField'):
 if mode!='outside-display':raise ValueError('Image extension requires uniform slab-local outside display')
 path=opts['inPlaneField'];extent_meta=json.load(open(path+'/meta.json'))
 for key in ('spacingKpc','camera','extinctionPerChannel','record','physics'):
  if extent_meta[key]!=m[key]:raise ValueError('Image extension changes canonical '+key)
 image_dims=extent_meta['dims']
 offset=np.rint((np.array(origin)-extent_meta['originKpc'])/spacing).astype(int)
 if np.max(np.abs((np.array(origin)-extent_meta['originKpc'])/spacing-offset))>1e-4:raise ValueError('Image extension must share the canonical grid')
 if any(offset[a]<0 or offset[a]+m['dims'][a]>image_dims[a] for a in range(3)):raise ValueError('Image extension must contain the original field')
 ex,ey,ez=image_dims
 for vol,name,channels in ((E,'emission',3),(D,'dust',1),(S,'scatter',3)):
  shape=(ez,ey,ex,3) if channels==3 else (ez,ey,ex)
  extended[id(vol)]=np.memmap(path+'/'+name+'.f32',dtype='<f4',mode='r',shape=shape)
def extend_plane(vol,axis,i,f,core):
 if not extended:return core
 a=2-axis;n=image_dims[axis];j=i+offset[axis]
 if j<0 or j>=n-1:raise ValueError('Slab escaped image field')
 image=np.take(extended[id(vol)],j,axis=a).astype('float64')*(1-f)+np.take(extended[id(vol)],j+1,axis=a).astype('float64')*f
 h=1 if axis==0 else 0;v=1 if axis==2 else 2
 # Reuse the canonical samples, never recompute/retune its accepted image area.
 image[offset[v]:offset[v]+m['dims'][v],offset[h]:offset[h]+m['dims'][h]]=core
 return image
def extended_texture(rgba,axis):
 if not extended:return rgba,{}
 h=1 if axis==0 else 0;v=1 if axis==2 else 2
 height,width=rgba.shape[:2];cy=height-offset[v]-m['dims'][v];cx=offset[h]
 ys,xs=np.nonzero(rgba[...,3]);margin=3
 x0=max(0,min(cx,int(xs.min()) if len(xs) else cx)-margin)
 x1=min(width,max(cx+m['dims'][h],int(xs.max())+1 if len(xs) else cx+m['dims'][h])+margin)
 y0=max(0,min(cy,int(ys.min()) if len(ys) else cy)-margin)
 y1=min(height,max(cy+m['dims'][v],int(ys.max())+1 if len(ys) else cy+m['dims'][v])+margin)
 # Two texture pixels occupy one retained CSS pixel. Preserve the canonical raster phase.
 x0=max(0,x0-int((cx-x0)%2));y0=max(0,y0-int((cy-y0)%2))
 x1=min(width,x1+int((x1-cx-m['dims'][h])%2));y1=min(height,y1+int((y1-cy-m['dims'][v])%2))
 # Keep the accepted texel-to-world calibration exactly: the old crop has the same four edges.
 du=(box[2*h+1]-box[2*h])/m['dims'][h];dv=(box[2*v+1]-box[2*v])/m['dims'][v]
 u0=box[2*h]+(x0-cx)*du;u1=box[2*h]+(x1-cx)*du
 v0=box[2*v]+(height-y1-offset[v])*dv;v1=box[2*v]+(height-y0-offset[v])*dv
 return rgba[y0:y1,x0:x1].copy(),{'imageBounds':[float(u0),float(u1),float(v0),float(v1)],'canonicalCrop':[int(cx-x0),int(cy-y0),m['dims'][h],m['dims'][v]]}
`;
