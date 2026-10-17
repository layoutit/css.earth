/** CUDA Python carried by strict TypeScript, following galaxy-fit.mts.
 * Ported from the owner-accepted b30 v8/v9 lanes (2026-10-13).
 * Python files are materialized only in a temporary directory; no scratch checkout is required.
 */
export const PHYSICS = String.raw`"""v8 switches and shared source-band conventions; CCM89 (ApJ 345,245)."""
import sys
FLAGS={'discHeights':('exp','sech2old'),'dustRef':('a0','r'),'localSharpen':('off','on'),'dustField':('physical','legacy'),'gaiaModel':('population','legacy'),'scatter':('on','off'),'slabTransfer':('mixed','midpoint'),'localSampling':('native','grid'),'scatterViews':('faceSide','all')}

def scatter_in_view(physics, view):
    if view not in ('sky', 'face', 'side'):
        raise ValueError('unknown scattering observable: '+view)
    # NASA's catalog-star map and Gaia counts contain direct, extincted starlight;
    # DESI images contain diffuse light. faceSide omits only in-scattered emission
    # from the sky observable, retaining identical total extinction (absorption +
    # scattering out of the beam) in all views and the SKIRT closure in face/side.
    # Population Gaia counts already exclude diffuse light in both modes.
    return physics['scatter']=='on' and (physics.get('scatterViews','all')=='all' or view in ('face','side'))
def options(argv=None):
    argv=sys.argv[1:] if argv is None else argv;out={}
    for n,choices in FLAGS.items():
        value=choices[0]
        for i,a in enumerate(argv):
            if a.startswith('--'+n+'='):value=a.split('=',1)[1]
            elif a=='--'+n:
                if i+1>=len(argv):raise ValueError('missing '+n)
                value=argv[i+1]
        if value not in choices:raise ValueError(f'{n} must be one of {choices}')
        out[n]=value
    return out

def flag_args(flags):return [f'--{n}={v}' for n,v in flags.items()]
def ccm(l,rv):
    x=1/l
    if x<1.1:return (.574-.527/rv)*x**1.61
    y=x-1.82
    a=1+.17699*y-.50447*y**2-.02427*y**3+.72085*y**4+.01979*y**5-.77530*y**6+.32999*y**7
    b=1.41338*y+2.28305*y**2+1.07233*y**3-5.38434*y**4-.62251*y**5+5.30260*y**6-2.09002*y**7
    return a+b/rv
REF={'dustSmooth':None,'dustTextured':None,'dustLocal':.54,'dustArms':None,'dustVergely':.55}  # None = exact A_V normalization of CCM, rather than A0(550).
GAIA_G_UM=.673       # nominal G effective wavelength, Jordi et al. 2010; monochromatic approximation.

def normalise(argv):
    out=[];i=0
    while i<len(argv):
        a=argv[i]
        if a.startswith('--') and a[2:] in FLAGS:
            if i+1>=len(argv):raise ValueError('missing '+a)
            out.append(a+'='+argv[i+1]);i+=2
        else:out.append(a);i+=1
    # Saved settings precede explicit relocation/comparison flags. Last value wins.
    return [a for i,a in enumerate(out) if not a.startswith('--') or not any(b.split('=',1)[0]==a.split('=',1)[0] for b in out[i+1:] if b.startswith('--'))]

LEGACY={'discHeights':'sech2old','dustRef':'r','localSharpen':'on','dustField':'legacy','gaiaModel':'legacy','scatter':'off','slabTransfer':'midpoint','localSampling':'grid','scatterViews':'all'}
def record_physics(record):
    # Records before v8 carry the original physical model. Never impose b30 on them.
    return {**LEGACY, **record.get('physics',{})}
`;

export const PRECOMPUTE = String.raw`"""precompute.py on the GPU, with the model's structure as options, so a structural variant is seconds, not minutes.

Usage: precompute_gpu.py <work dir with the npz grids> <out dir> [--arms=<reid-arms.npz>] [--hole=1.32] [--hR=2.6]
  [--hRthick=2.0] [--views=face,side,sun,allsky]
Same fields, views, shells and sampling as precompute.py (its v6 text is the reference), with:
  --hole   the thin disc's central hole (Robin et al. 2003 h-, kpc; 0 = none)
  --hR     the thin disc's scale length (kpc; Bland-Hawthorn & Gerhard 2016: 2.6 +- 0.5)
  --hRthick the thick disc's scale length (kpc; 2.0 +- 0.2)
  --youngHz the young stars' (and arm dust lanes') sech^2 scale height (kpc; 0.1)
  --zSun    the Sun's height above the plane for the analytic layers (kpc; 0.0208, Bennett & Bovy 2019; 0 = as precompute.py)
  --fadeIn/--fadeOut the measured local dust fades into the model between these radii (kpc; default no fade)
  --vergely  Vergely et al. 2022's 50 pc cube: measured dust between the Edenhofer map and its box (--vergelyFade 0.3 kpc)
  --textured the textured dust grid (default <work>/combined-sim.npz; calibrate_texture.py writes calibrated ones)
  --local   the measured local dust grid (local-density.mts output; default <work>/local-density.npz, 10 pc)
  --skyWidth the whole-sky view's width (960; height is half), --skyPer samples per distance shell (16)
  --youngHR their radial scale length (kpc; 0 = no fall-off, as precompute.py)
The bar is always the Sormani et al. (2022) old stars less the reference discs (2.6 and 2.0 kpc, no hole), so a disc
variant never changes the bar. Writes <out>/<view>-<field>.f32 and <out>/views.json (as precompute.py), plus
<out>/structure.json (the options)."""
import json, os, sys, time
import numpy as np, torch
import torch.nn.functional as F
from physics8 import normalise, options
sys.argv=[sys.argv[0]]+normalise(sys.argv[1:])
PHYSICS=options()
if PHYSICS['localSampling']=='native' and (PHYSICS['dustField']!='physical' or PHYSICS['localSharpen']!='off'):
    raise ValueError('native local sampling requires physical dust and sharpening off')
CONTRAST=float(next((a.split("=",1)[1] for a in sys.argv if a.startswith("--farContrast=")),1))
if not .3<=CONTRAST<=2.5: raise ValueError("farContrast outside .3..2.5")
args = [a for a in sys.argv[1:] if not a.startswith('--')]; W, O = args[0], args[1]
opt = {a.split('=')[0][2:]: a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--')}
HOLE = float(opt.get('hole', 1.32)); YHZ = float(opt.get('youngHz', 0.15)); YHR = float(opt.get('youngHR', 3)); ZSUN = float(opt.get('zSun', 0.0208)); GIN = float(opt.get('gradIn', 0)); GOUT = float(opt.get('gradOut', 8)); HR = float(opt.get('hR', 2.6)); HRT = float(opt.get('hRthick', 2.0))
opt.setdefault('scatterCalibration', W+'/scatter-calibration.json')
opt.setdefault('illuminationFit', W+'/illumination-fit.json')
ARMS = opt.get('arms', f'{W}/reid-arms.npz'); VIEWS = opt.get('views', 'face,side,allsky').split(',')
torch.manual_seed(0)
os.makedirs(O, exist_ok=True); dev = torch.device('cuda'); t0 = time.time()
# --smooth: the large-scale dust cube (default the combined build's)
S = np.load(opt.get('smooth', W + '/combined-smooth-zext.npz')); go, gs = S['originKpc'], S['spacingKpc']; n = np.array(S['density'].shape)
g = lambda a: torch.from_numpy(np.ascontiguousarray(a, dtype=np.float32)).to(dev)
x = g(go[0] + np.arange(n[0]) * gs[0]); y = g(go[1] + np.arange(n[1]) * gs[1]); z = g(go[2] + np.arange(n[2]) * gs[2])
XX, YY, ZZ = torch.meshgrid(x, y, z, indexing='ij'); R = torch.hypot(XX - 8.277, YY)
ZP = ZZ + ZSUN                                       # height above the Galactic plane: the Sun is 20.8 pc above it (Bennett & Bovy 2019)
def disc(hR, hz, norm, hole=0.0, zz=None, reference=False):
    # Both profiles integrate to 2h: retain Sigma/(2h), BHG2016 exp heights 300/900 pc.
    zp=ZP if zz is None else zz
    vertical=torch.exp(-zp.abs()/hz) if PHYSICS["discHeights"]=="exp" and not reference else 1/torch.cosh(zp/hz)**2
    d=norm*torch.exp(-(R-8.277)/hR)*vertical
    if hole > 0: d = d * (1 - torch.exp(-R / hole + R / hR)) / (1 - np.exp(-8.277 / hole + 8.277 / hR))
    return d
L = np.load(W + '/galaxy-light.npz')
bar = (g(L['oldStars']) - disc(2.6, 0.3, 33 / 600, zz=ZZ, reference=True) - disc(2.0, 0.9, 0.12 * 33 / 1800, zz=ZZ, reference=True)).clamp_min(0); del L   # galaxy-light's discs sit at the Sun's height
thin = disc(HR, 0.3, 33 / 600, HOLE); thick = disc(HRT, 0.9, 0.12 * 33 / 1800)
vz = 1 / torch.cosh(ZP / YHZ) ** 2                 # young stars' and arm dust lanes' layer (sech^2, kpc)
# star formation (young stars, the arms' dust lanes) falls outward: exp(-(R - R0) / youngHR), 1 at the Sun (0 = flat)
if YHR > 0: vz = vz * torch.exp(-(R - 8.277) / YHR)
A = np.load(ARMS); T = g(np.load(W + '/sim-texture.npz')['texture'])
LOC = np.load(opt.get('local', W + '/local-density-4pc.npz')); loc = LOC['local']; lo, lsp = LOC['originKpc'], LOC['spacingKpc']
# the measured map fades into the model over its outer part instead of ending at a sphere: weight 1 inside --fadeIn kpc,
# 0 at --fadeOut (the map reaches 1.25 kpc), applied to the measured dust and to where it replaces the model
FIN = float(opt.get('fadeIn', 0.9)); FOUT = float(opt.get('fadeOut', 1.25))
_li = [lo[a] + np.arange(loc.shape[a]) * lsp[a] for a in range(3)]
_rr = np.sqrt(_li[0][:, None, None] ** 2 + _li[1][None, :, None] ** 2 + _li[2][None, None, :] ** 2)
_w = np.clip((FOUT - _rr) / max(FOUT - FIN, 1e-6), 0, 1) if FOUT > FIN else np.ones_like(_rr)
locz = g(np.nan_to_num(loc) * _w)[None, None]; locf = g(np.isfinite(loc).astype(np.float32) * _w)[None, None]
def sample(vol, pts, origin, spacing):          # vol (1,1,X,Y,Z); pts (...,3) kpc from the Sun -> trilinear, 0 outside
    sh = pts.shape[:-1]; nX, nY, nZ = vol.shape[2:]
    idx = (pts.reshape(-1, 3) - torch.tensor(origin, device=dev, dtype=torch.float32)) / torch.tensor(spacing, device=dev, dtype=torch.float32)
    grid = torch.stack([idx[:, 2] / (nZ - 1), idx[:, 1] / (nY - 1), idx[:, 0] / (nX - 1)], -1) * 2 - 1
    return F.grid_sample(vol, grid.view(1, 1, 1, -1, 3), mode='bilinear', padding_mode='zeros', align_corners=True).view(sh)
# Vergely et al. 2022 (A&A 664, A174), measured dust between the Edenhofer map and its box (--vergely=<50 pc cube>,
# A0(550 nm) per pc -> A_V per kpc), fading out over --vergelyFade kpc at the box's sides and 0.1 kpc at its top/bottom
VP = opt.get('vergely', W+'/explore_cube_density_values_050pc_v2.fits')
if VP:
    def _fits(path):                   # a single-image FITS (primary HDU, BITPIX -32): header cards, then big-endian floats
        raw = open(path, 'rb').read(); h = {}; i = 0
        while True:
            card = raw[i:i + 80].decode('ascii'); i += 80
            if card.startswith('END'): break
            if '=' in card[:10]:
                k, v = card[:8].strip(), card[10:].split('/')[0].strip().strip("'").strip()
                try: h[k] = float(v) if '.' in v else int(v)
                except ValueError: h[k] = v
        i = ((i + 2879) // 2880) * 2880; assert h['BITPIX'] == -32
        shape = tuple(h[f'NAXIS{a}'] for a in range(h['NAXIS'], 0, -1))
        return h, np.frombuffer(raw, '>f4', count=int(np.prod(shape)), offset=i).reshape(shape)
    _h, _d = _fits(VP); _d = _d.astype(np.float32) * 1000.0                                # (z, y, x) -> A_V / kpc
    _st = _h['STEP'] / 1000.0; _sun = (_h['SUN_POSX'], _h['SUN_POSY'], _h['SUN_POSZ'])
    vcube = g(np.ascontiguousarray(_d.transpose(2, 1, 0)))[None, None]                  # (1, 1, X, Y, Z)
    vorig = tuple(-(_sun[a] - 0.5) * _st for a in range(3)); vsp = (_st, _st, _st)
    _half = [((_d.shape[2 - a] - 1) / 2) * _st for a in range(3)]; VF = float(opt.get('vergelyFade', 1.0))
    def vweight(P):                    # 1 well inside the box, 0 outside
        w = torch.ones(P.shape[:-1], device=dev)
        for a, f in ((0, VF), (1, VF), (2, 0.1)):
            c = vorig[a] + _half[a]; w = w * ((_half[a] - (P[..., a] - c).abs()) / f).clamp(0, 1)
        return w
pts = torch.stack([XX, YY, ZZ], -1)
locG = torch.cat([sample(locz, pts[i:i + 64], lo, lsp) for i in range(0, n[0], 64)]); locM = torch.cat([sample(locf, pts[i:i + 64], lo, lsp) for i in range(0, n[0], 64)])
nativeLocal=None
if PHYSICS['localSampling']=='native':
    from native_local8 import NativeLocal
    nativeLocal=NativeLocal(locz[0,0].cpu().numpy(),lo,lsp,go,gs,n,dev,float(opt.get('nativeStepPc',1)))
    locG=nativeLocal.volume()
    # The outer components remain the existing coarse fields; conserve the
    # native support when averaging their one-time replacement weights too.
    locM=torch.from_numpy(nativeLocal.remap(locf[0,0].cpu().numpy())).to(dev).clamp(0,1)
    del locf
if VP:
    wVg = torch.cat([vweight(pts[i:i + 64]) for i in range(0, n[0], 64)]); dV = torch.cat([sample(vcube, pts[i:i + 64], vorig, vsp) for i in range(0, n[0], 64)])
    dustV = dV * wVg * (1 - locM)
else: wVg = torch.zeros_like(locM); dustV = torch.zeros_like(locM)
del pts, XX, YY
replacement=(1-locM)*(1-wVg)
# Contrast is dimensionless rho/rho_ref before support masking/integration, with conserved global density.
far_stats={}
def far(raw,name):
    if PHYSICS['dustField']=='legacy':return g(raw)*replacement
    # Shape/anchor on CPU: the extended grid exceeds one GiB; do not retain duplicate GPU cubes.
    d=np.maximum(raw,0).astype(np.float32);small=d[::4,::4,::4];ref=float(np.median(small[small>0]))
    if CONTRAST!=1:
        shaped=d*np.maximum(d/ref,1e-30)**(CONTRAST-1);shaped*=d.sum(dtype=np.float64)/shaped.sum(dtype=np.float64)
    else:shaped=d
    wm=wVg[::4,::4,::4].cpu().numpy();lm=locM[::4,::4,::4].cpu().numpy();dv=dustV[::4,::4,::4].cpu().numpy();zz=ZP[::4,::4,::4].cpu().numpy()
    valid=(wm>.8)&(lm<.05)&(dv>.01)&(small>.01)&(abs(zz)<.3)
    if not valid.any():raise ValueError('no far-dust overlap anchor')
    anchor=float(np.median(dv[valid]/(wm[valid]*(1-lm[valid]))/shaped[::4,::4,::4][valid]))
    if not np.isfinite(anchor) or anchor<=0:raise ValueError('invalid far-dust anchor')
    far_stats[name]={'rhoRefMagPerKpc':ref,'overlapMedianGain':anchor,'overlapSampleVoxels':int(valid.sum()),'contrast':CONTRAST,'anchorStride':4}
    # In-place multiply avoids a second full GPU allocation.
    result=g(shaped);result.mul_(anchor).mul_(replacement);return result

arms = g(A['arms'])[:, :, None] * vz
# thinOuter: the thin disc's outer, younger share (the galaxy fit's thinGradient), 0 inside --gradIn to 1 beyond --gradOut kpc
fields = {'bar': lambda: bar, 'thin': lambda: thin, 'thinOuter': lambda: thin * ((R - GIN) / (GOUT - GIN)).clamp(0, 1), 'thick': lambda: thick, 'oldArms': lambda: g(A['oldArms'])[:, :, None] * thin, 'arms': lambda: arms,
          'armsMajor': lambda: g(A['armsMajor'])[:, :, None] * vz, 'armsMinor': lambda: g(A['armsMinor'])[:, :, None] * vz, 'armsTex': lambda: arms * T,
          'dustSmooth': lambda: far(S['density'],'smooth'), 'dustVergely': lambda: dustV, 'dustTextured': lambda: far(np.load(opt.get('textured', W + '/combined-sim-cal-zext.npz'))['density'],'textured'),
          'dustLocal': lambda: locG, 'dustArms': lambda: g(A['armsDust'])[:, :, None] * vz * T * (replacement if PHYSICS['dustField']=='physical' else 1)}
def dirs_of(ls, bs):
    LL, BB = torch.meshgrid(torch.deg2rad(g(ls)), torch.deg2rad(g(bs)), indexing='xy')
    return torch.stack([torch.cos(BB) * torch.cos(LL), torch.cos(BB) * torch.sin(LL), torch.sin(BB)], -1)
SKYW = int(opt.get('skyWidth', 960)); SKYPER = int(opt.get('skyPer', 16))   # sky size, samples per shell
sunE = np.concatenate([[0.02], np.geomspace(0.05, 25, 16)]); skyE = np.concatenate([[0.01], np.geomspace(0.03, 25, 16)])
RAYS = {'sun': (dirs_of(np.linspace(60, -60, 600), np.linspace(20, -20, 200)), sunE, 12), 'allsky': (dirs_of(np.linspace(180, -180, SKYW, endpoint=False), np.linspace(90, -90, SKYW // 2)), skyE, SKYPER)}
def rays(name, k, f):
    dirs, edges, per = RAYS[name]; h, w = dirs.shape[:2]; out = torch.zeros(len(edges) - 1, h, w, device=dev); vol = f[None, None]
    if nativeLocal is not None and (k=='dustLocal' or k.startswith('scatterLocal')):
        return nativeLocal.rays(dirs,edges,sample,None if k=='dustLocal' else k[-1])
    for s in range(len(edges) - 1):
        ds = np.geomspace(edges[s], edges[s + 1], per); step = np.diff(np.concatenate([[edges[s]], ds]))
        for dist, dl in zip(ds, step):
            P = dirs * float(dist)
            if PHYSICS['dustField']=='physical': v=sample(vol,P,go,gs)
            elif k == 'dustLocal': v = sample(locz, P, lo, lsp)
            elif k == 'dustVergely': v = (sample(vcube, P, vorig, vsp) * vweight(P) * (1 - sample(locf, P, lo, lsp))) if VP else torch.zeros(P.shape[:-1], device=dev)
            else:
                v = sample(vol, P, go, gs)
                if k in ('dustSmooth', 'dustTextured'):           # replaced by the measured maps inside their support
                    v = v * (1 - sample(locf, P, lo, lsp)) * ((1 - vweight(P)) if VP else 1)
            out[s] += v * float(dl)
    return out
def axis(f, ax, K, order):
    idx = np.array_split(np.arange(f.shape[ax])[::order], K)
    return torch.stack([f.index_select(ax, torch.tensor(ii.copy(), device=dev)).sum(ax) * float(gs[ax]) for ii in idx])
SIDEK=int(opt.get('sideSlabs',96 if PHYSICS['dustField']=='physical' else 12))
meta = {'views': {},'physics':PHYSICS,'farContrast':CONTRAST}
shape = {'face': (int(n[0]), int(n[1])), 'side': (int(n[0]), int(n[2])), 'sun': (600, 200), 'allsky': (SKYW, SKYW // 2)}
p99 = {v: {} for v in VIEWS}
for k, make in fields.items():
    f = make()
    for v in VIEWS:
        if v == 'face': out = axis(f, 2, 8, -1).transpose(1, 2).flip(1)
        elif v == 'side': out = axis(f, 1, SIDEK, 1).transpose(1, 2).flip(1)
        else: out = rays(v, k, f)
        a = out.float(); pos = a[a > 0]
        p99[v][k] = float(torch.quantile(pos[torch.randperm(pos.numel(), device=dev)[:2_000_000]], 0.99)) if pos.numel() else 1.0
        a.cpu().numpy().astype(np.float32).tofile(f'{O}/{v}-{k}.f32')
    print('prepared',k,flush=True)
    del f
if PHYSICS['scatter']=='on':
    from scatter8_prepare import prepare_sources
    extra,illumination=prepare_sources(fields,n,gs,go,opt,dev,p99,PHYSICS,nativeLocal)
    meta['illumination']=illumination
    for k,make in extra.items():
        f=make()
        for v in VIEWS:
            if v=='face':out=axis(f,2,8,-1).transpose(1,2).flip(1)
            elif v=='side':out=axis(f,1,SIDEK,1).transpose(1,2).flip(1)
            else:out=rays(v,k,f)
            out.cpu().numpy().astype(np.float32).tofile(f'{O}/{v}-{k}.f32')
        print('prepared',k,flush=True)
        del f
    fields.update(extra)
meta['farDensity']=far_stats
if nativeLocal is not None:meta['nativeLocal']=nativeLocal.audit
for v in VIEWS:
    w, h = shape[v]; K = {'face': 8, 'side': SIDEK, 'sun': 16, 'allsky': 16}[v]
    meta['views'][v] = {'width': w, 'height': h, 'slabs': K, 'fields': list(fields), 'p99': p99[v],
                        **({'shellEdgesKpc': sunE.tolist()} if v == 'sun' else {}), **({'shellEdgesKpc': skyE.tolist(), 'projection': 'equirectangular-galactic'} if v == 'allsky' else {})}
json.dump(meta, open(f'{O}/views.json', 'w'), indent=1)
json.dump({'physics':PHYSICS,'farContrast':CONTRAST,'farDensity':far_stats,'vergelyFade':float(opt.get('vergelyFade',1.0)), 'smooth':os.path.basename(opt.get('smooth',W+'/combined-smooth-zext.npz')), 'nativeStepPc':float(opt.get('nativeStepPc',1)), 'skyPer':SKYPER, 'sideSlabs':SIDEK,'vergely': os.path.basename(VP) if VP else None, 'fadeIn': FIN, 'fadeOut': FOUT, 'textured': os.path.basename(opt.get('textured', 'combined-sim.npz')), 'gradIn': GIN, 'gradOut': GOUT, 'zSun': ZSUN, 'local': os.path.basename(opt.get('local', 'local-density.npz')), 'skyWidth': SKYW, 'youngHz': YHZ, 'youngHR': YHR, 'hole': HOLE, 'hR': HR, 'hRthick': HRT, 'arms': os.path.basename(ARMS)}, open(f'{O}/structure.json', 'w'))
print(json.dumps({'out': O, 'seconds': round(time.time() - t0, 1), 'views': VIEWS}), flush=True)
`;

export const NATIVE_LOCAL = String.raw`"""One native trilinear local field, with conservative cell integrals and converged rays.

The 4 pc archive contains block averages. Reconstruct it with nonnegative
unit-integral tensor-product tent functions. Its full-space integral is exactly
sum(density)*prod(spacing). No projected sharpening or mass renormalization.
"""
import numpy as np
import torch
from scipy.sparse import csr_matrix
from scipy.ndimage import map_coordinates

def tent_integral(t):
    t=np.asarray(t,dtype=np.float64)
    return np.where(t<=-1,0,np.where(t<0,(t+1)**2/2,np.where(t<1,1-(1-t)**2/2,1)))

def overlap(origin,spacing,count,target_origin,target_spacing,target_count):
    centers=origin+np.arange(count)*spacing
    target=target_origin+np.arange(target_count)*target_spacing
    a=(target[:,None]-target_spacing/2-centers)/spacing
    b=(target[:,None]+target_spacing/2-centers)/spacing
    return csr_matrix((tent_integral(b)-tent_integral(a))*spacing/target_spacing)

class NativeLocal:
    def __init__(self,density,origin,spacing,grid_origin,grid_spacing,grid_shape,dev,step_pc=1):
        self.density=np.asarray(density,dtype=np.float32)
        if self.density.ndim!=3 or not np.isfinite(self.density).all() or (self.density<0).any():
            raise ValueError('native local density must be finite and nonnegative')
        if not 0<float(step_pc)<=4:raise ValueError('nativeStepPc must be in (0,4]')
        self.origin=np.asarray(origin);self.spacing=np.asarray(spacing);self.go=np.asarray(grid_origin)
        self.gs=np.asarray(grid_spacing);self.shape=tuple(int(x) for x in grid_shape);self.dev=dev;self.step=float(step_pc)/1000
        self.matrices=[overlap(origin[a],spacing[a],density.shape[a],grid_origin[a],grid_spacing[a],grid_shape[a]) for a in range(3)]
        self.products={};self.audit={}

    def remap(self,density):
        # Sparse exact integrals of the trilinear reconstruction over coarse cells.
        a=np.asarray(density,dtype=np.float32)
        active=[np.flatnonzero(np.diff(m.indptr)) for m in self.matrices]
        for axis,m in enumerate(self.matrices):
            m=m[active[axis]]
            a=np.moveaxis(a,axis,0);rest=a.shape[1:]
            a=(m@a.reshape(a.shape[0],-1)).astype(np.float32).reshape((m.shape[0],)+rest)
            a=np.moveaxis(a,0,axis)
        out=np.zeros(self.shape,np.float32);out[np.ix_(*active)]=a
        return out

    def volume(self):
        a=self.remap(self.density)
        native=float(self.density.sum(dtype=np.float64)*np.prod(self.spacing))
        coarse=float(a.sum(dtype=np.float64)*np.prod(self.gs))
        self.audit={'nativeIntegralMagKpc2':native,'coarseIntegralMagKpc2':coarse,'relativeError':coarse/native-1,
                    'spacingPc':(self.spacing*1000).tolist(),'rayStepPc':self.step*1000,'kernel':'nonnegative trilinear tents; exact cell integrals'}
        if abs(coarse/native-1)>2e-6:raise ValueError('native local conservation failed or target truncates source')
        return torch.from_numpy(a).to(self.dev)

    def source(self,band,jfine):
        # Interpolate smooth J onto native nodes, then retain one native source
        # interpolant for both ray and finite-volume projections.
        j=jfine.detach().cpu().numpy();d=np.empty_like(self.density)
        axes=[(self.origin[a]+np.arange(self.density.shape[a])*self.spacing[a]-self.go[a])/self.gs[a] for a in range(3)]
        for start in range(0,d.shape[0],8):
            coords=np.meshgrid(axes[0][start:start+8],axes[1],axes[2],indexing='ij')
            vals=map_coordinates(j,np.asarray(coords),order=1,mode='constant',cval=0,prefilter=False)
            d[start:start+8]=self.density[start:start+8]*vals
        self.products[band]=d
        mapped=self.remap(d)
        src=float(d.sum(dtype=np.float64)*np.prod(self.spacing));dst=float(mapped.sum(dtype=np.float64)*np.prod(self.gs))
        if abs(dst/src-1)>2e-6:raise ValueError('native scattering conservation failed')
        self.audit['scatter'+band]={'nativeIntegral':src,'coarseIntegral':dst,'relativeError':dst/src-1}
        return torch.from_numpy(mapped).to(self.dev)

    def rays(self,dirs,edges,sample,band=None,step_pc=None):
        # Midpoint quadrature bounded by 1/4 of a source cell, never by far-shell
        # logarithmic spacing; chunk pixels to respect shared GPU memory.
        density=self.density if band is None else self.products[band]
        vol=torch.from_numpy(density).to(self.dev)[None,None]
        h,w=dirs.shape[:2];directions=dirs.reshape(-1,3);out=torch.zeros(len(edges)-1,h*w,device=self.dev)
        last=self.origin+(np.array(density.shape)-1)*self.spacing
        outer=float(np.linalg.norm(np.maximum(abs(self.origin),abs(last))+self.spacing))
        step=self.step if step_pc is None else float(step_pc)/1000
        for k,(a,b) in enumerate(zip(edges[:-1],edges[1:])):
            b=min(b,outer)
            if b<=a:continue
            count=int(np.ceil((b-a)/step));dl=(b-a)/count
            distances=torch.tensor(a+(np.arange(count)+.5)*dl,device=self.dev,dtype=torch.float32)
            for start in range(0,len(directions),8192):
                pts=directions[start:start+8192,None,:]*distances[None,:,None]
                out[k,start:start+8192]=sample(vol,pts,self.origin,self.spacing).sum(1)*dl
        return out.reshape(len(edges)-1,h,w)
`;

export const POPULATION = String.raw`"""One count predictor for even-pixel training and odd-pixel validation.
Sharma et al. (2011) Galaxia LFs; Gaia DR3 Table 5.8 G-r per-star transform in extraction.
G extinction is CCM89 at 673 nm (Jordi et al. 2010), explicitly a fixed-effective-wavelength approximation.
"""
import json,math
from pathlib import Path
import numpy as np,torch
from physics8 import REF,ccm,GAIA_G_UM
class PopulationCounts:
    def __init__(self,argv,dev):
        root=Path(__file__).resolve().parent
        self.path=next((a.split('=',1)[1] for a in argv if a.startswith('--populationLF=')),str(root/'investigate/gaia-plane/population-lfs.npz'))
        self.selection_path=next((a.split('=',1)[1] for a in argv if a.startswith('--selection=')),str(root/'investigate/gaia-plane/selection.npz'))
        Z=np.load(self.path);stats=json.load(open(Path(self.path).with_suffix('.json')));self.dev=dev
        self.grid=torch.tensor(Z['g_edges'],device=dev,dtype=torch.float32)
        self.cfs={}
        for name,ids in [('thin',[3,4,5,6]),('outer',[1,2]),('young0',[1]),('young1',[0]),('thick',[7]),('bar',[9])]:
            # Exact sampled r luminosity moment, not luminosity at the centre of a logL histogram bin.
            lum=sum(stats[str(i)]['weighted_luminosity'] for i in ids)
            h=Z['g_hist'][ids].sum(0)/lum
            self.cfs[name]=torch.tensor(np.r_[0,np.cumsum(h)],device=dev,dtype=torch.float32)
        gp=next(a.split('=',1)[1] for a in argv if a.startswith('--gaia='));G=np.load(gp)
        self.selection=np.ones_like(G['n'],dtype=np.float32)
        if self.selection_path!='off':
            sel=np.load(self.selection_path)['prob']
            if sel.shape!=self.selection.shape or not np.isfinite(sel).all() or np.any((sel<0)|(sel>1)):raise ValueError('invalid cached selection probabilities')
            self.selection=sel.astype(np.float32)
    def fraction(self,name,M):
        i=torch.searchsorted(self.grid,M.contiguous()).clamp(1,len(self.grid)-1);a,b=self.grid[i-1],self.grid[i]
        cf=self.cfs[name];f=cf[i-1]+((M-a)/(b-a)).clamp(0,1)*(cf[i]-cf[i-1])
        return torch.where(M<self.grid[0],torch.zeros_like(f),torch.where(M>=self.grid[-1],cf[-1],f))
    def predict(self,q,D,edges,T0,A0,idx,gedges,physics,meta,ties=(),selection=None):
        q=dict(q);q.update({a:k*q[b] for a,b,k in ties});P=len(q['barRatio']);N=len(idx);v=lambda n:q[n][:,None];take=lambda n,k:D[n][k].flatten()[idx][None]
        tau=torch.zeros(P,N,device=self.dev);counts=torch.zeros(P,N,len(gedges)-1,device=self.dev);rv=2.5+1.5*q['reddening'];ratio={d:ccm(GAIA_G_UM,rv)/(ccm(ref,rv) if ref is not None else torch.ones_like(rv)) if physics['dustRef']=='a0' else .95*torch.ones_like(rv) for d,ref in REF.items()}
        for k in range(len(edges)-1):
            smooth=take('dustSmooth',k);text=take('dustTextured',k);far=(smooth+(text-smooth)*v('dustTexture')).clamp_min(0)
            if physics['dustField']=='legacy':far=far**v('dustContrast')
            loc=take('dustLocal',k)
            if physics['localSharpen']=='on':
                rad=q['localSharpenRadius'].round().long();blur=torch.where(rad[:,None]==1,take('locBlur1',k),take('locBlur2',k));loc=(loc+v('localSharpen')*(loc-blur)).clamp_min(0)
            ag=v('dustStrength')*far*ratio['dustSmooth'][:,None]+v('localDustGain')*loc*ratio['dustLocal'][:,None]+v('armsDustGain')*take('dustArms',k)*ratio['dustArms'][:,None]+v('vergelyGain')*take('dustVergely',k)*ratio['dustVergely'][:,None]
            # Intrinsic r light only: no reverse attenuation, HII, scattering, nearLight or camera knobs.
            thin=(take('thin',k)+v('oldArmContrast')*take('oldArms',k))/T0
            f=(v('thinGradient')*take('thinOuter',k)/take('thin',k).clamp_min(1e-30)).clamp(0,1)
            tex=take('tex',k);arms=take('armsMajor',k)+v('minorArmGain')*take('armsMinor',k)
            young=v('youngGain')*arms/A0*torch.maximum(v('texFloor'),tex)**v('texPower')
            d=math.sqrt(edges[k]*edges[k+1]);mu=5*math.log10(d*100);M=gedges[None,None,:]-mu-(tau+ag/2)[:,:,None]
            fractions={name:self.fraction(name,M).diff(dim=-1).clamp_min(0) for name in self.cfs}
            counts+=d*d*(thin[:,:,None]*((1-f)[:,:,None]*fractions['thin']+f[:,:,None]*fractions['outer'])+v('thickRatio')[:,:,None]*take('thick',k)[:,:,None]/T0*fractions['thick']+v('barRatio')[:,:,None]*take('bar',k)[:,:,None]/T0*fractions['bar']+young[:,:,None]*((1-v('youngBlue'))[:,:,None]*fractions['young0']+v('youngBlue')[:,:,None]*fractions['young1']))
            tau+=ag
        return counts if selection is None else counts*selection[None]
`;

export const SCATTER = String.raw`"""Prepare a single 3D reference illumination and dust-weighted scattering source per view.
The inexpensive isotropic closure is calibrated on SKIRT9, never on sky residuals.
"""
import json
from pathlib import Path
import numpy as np,torch
import torch.nn.functional as F
from physics8 import REF,ccm
from scatter_kernels import intensity,isotropic

def prepare_sources(fields,n,gs,go,opt,dev,p99,physics,nativeLocal=None):
    if physics['dustField']!='physical':raise ValueError('scattering source preparation requires physical dust')
    calibration=json.load(open(opt['scatterCalibration']))
    p=json.load(open(opt['illuminationFit']))['params'].copy();p.update(dustStrength=1,localDustGain=1,vergelyGain=1,localSharpen=0)
    T0,A0=p99['face']['thin'],p99['face']['arms'];kernel=(4,4,2);nn=tuple(int(n[i]//kernel[i]) for i in range(3));cell=np.array(gs)*kernel
    toCPU=lambda f:f.detach().cpu().numpy()
    pool=lambda f:F.avg_pool3d(torch.from_numpy(np.ascontiguousarray(f))[None,None],kernel)[0,0].numpy()
    E=np.zeros((3,*nn));total={}
    terms=[('thin',1/T0,[1.649,1,.516]),('oldArms',p['oldArmContrast']/T0,[1.649,1,.516]),('thinOuter',p['thinGradient']/T0,[1.380-1.649,0,.749-.516]),('bar',p['barRatio']/T0,[1.750,1,.472]),('thick',p['thickRatio']/T0,[1.546,1,.521])]
    for name,gain,color in terms:
        f=toCPU(fields[name]());total[name]=float(f.sum(dtype=np.float64)*float(np.prod(gs)))/T0;a=pool(f);E+=a[None]*np.array(color)[:,None,None,None]*gain;del f
    # Same reference texture and arm populations as the compositor, no visual near-light factor.
    arms=toCPU(fields['arms']());tex=toCPU(fields['armsTex']())/np.maximum(arms,1e-30);mod=np.maximum(p['texFloor'],tex)**p['texPower']
    young=np.array([1.240,1,.852])*(1-p['youngBlue'])+np.array([.947,1,1.098])*p['youngBlue']
    for name,gain in [('armsMajor',1),('armsMinor',p['minorArmGain'])]:
        f=toCPU(fields[name]())*mod/A0;total[name]=float(f.sum(dtype=np.float64)*float(np.prod(gs)));E+=pool(f)[None]*young[:,None,None,None]*p['youngGain']*gain;del f
    hii=(toCPU(fields['armsMajor']())+p['minorArmGain']*toCPU(fields['armsMinor']()))/A0*np.maximum(tex-2,0)**1.5
    E+=pool(hii)[None]*np.array([.6,1,.75])[:,None,None,None]*p['youngGain']*p['hiiRatio'];del arms,tex,mod,hii
    rv=2.5+1.5*p['reddening'];DT=np.zeros_like(E)
    for name,gain in [('dustTextured',1),('dustLocal',1),('dustVergely',1),('dustArms',p['armsDustGain'])]:
        f=toCPU(fields[name]());a=pool(f);ext=np.array([ccm(l,rv)/((ccm(REF[name],rv) if REF[name] is not None else 1) if physics['dustRef']=='a0' else ccm(.64,rv)) for l in [.92,.64,.48]])
        DT+=a[None]*gain/1.086*ext[:,None,None,None];del f
    u=calibration['meanFreePathIndex'];i=int(u);paths=calibration['meanFreePathGridKpc'];frac=calibration['axisFraction']
    J=((1-(u-i))*isotropic(E,cell,paths[i])+(u-i)*isotropic(E,cell,paths[i+1]))*(1-frac)+intensity(E,DT*.5,cell)*frac
    extra={};coeff=np.array(calibration['coefficients_zrg'])*np.array(calibration['albedo_zrg'])/1.086
    # Interpolate a cell-centred illumination to the native lattice; all observers integrate this same source field.
    for b,band in enumerate('zrg'):
        jb=torch.tensor(J[b],dtype=torch.float32)[None,None]
        jfine=F.interpolate(jb,size=tuple(int(x) for x in n),mode='trilinear',align_corners=False)[0,0]*float(coeff[b])
        for name in ('Smooth','Textured','Local','Arms','Vergely'):
            if name=='Local' and nativeLocal is not None:
                localSource=nativeLocal.source(band,jfine)
                # Store compact CPU data; don't retain another full GPU cube.
                localSource=localSource.cpu()
                extra[f'scatter{name}{band}']=lambda source=localSource:source.to(dev)
            else:
                extra[f'scatter{name}{band}']=lambda name=name,jfine=jfine:(fields['dust'+name]().cpu()*jfine).to(dev)
    return extra,{'params':p,'rTotals':total,'calibration':calibration,'note':'Frozen reference radiation geometry/spectrum; DE scales total r luminosity only. No sky-specific scattering calibration.'}
`;

export const SCATTER_KERNELS = String.raw`import numpy as np
from scipy.signal import fftconvolve

def escape(dt):return np.where(dt<1e-6,1-dt/2,-np.expm1(-dt)/np.maximum(dt,1e-30))
def intensity(e,dt,cell):
    # Six equal solid-angle ordinates; exact cell-centred direct intensity, no scattering iteration.
    J=np.zeros_like(e)
    for ax in range(3):
        for sign in (1,-1):
            E=np.moveaxis(e,ax+1,0);T=np.moveaxis(dt,ax+1,0)*cell[ax];I=np.zeros_like(E[0]);V=np.zeros_like(E)
            for i in range(len(E))[::sign]:
                V[i]=I*np.exp(-T[i]/2)+E[i]*cell[ax]/2*escape(T[i]/2)
                I=I*np.exp(-T[i])+E[i]*cell[ax]*escape(T[i])
            J+=np.moveaxis(V,0,ax+1)/6
    return J

def isotropic(e,cell,length):
    # Homogeneous mean-free-path closure of integral e exp(-r/ell)/(4 pi r^2) dV.
    # Isotropic geometry; one ell in kpc fitted jointly to both observer directions.
    axes=[np.arange(-n,n+1)*c for n,c in zip((94,94,79),cell)]
    xx,yy,zz=np.meshgrid(*axes,indexing='ij');r=np.sqrt(xx*xx+yy*yy+zz*zz)
    r0=(3*np.prod(cell)/(4*np.pi))**(1/3)
    kernel=np.exp(-r/length)/(4*np.pi*np.maximum(r,r0)**2)*np.prod(cell)
    kernel[94,94,79]=length*(1-np.exp(-r0/length))
    return np.stack([fftconvolve(b,kernel,mode='same') for b in e])

`;
