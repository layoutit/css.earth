/** Explicit cube selections; Astropy NDData owns weighted arithmetic and uncertainty propagation. */
export const CUBE_OUTPUT_PYTHON = String.raw`
from astropy.nddata import NDDataArray, StdDevUncertainty
class CubeOutput:
    def __init__(self, request, shape, centers, edges, dataunit, error_valid):
        self.kind=request['kind']; self.wave=centers; self.width=shape[-1]; self.height=shape[-2]
        self.policy=request.get('uncertainty','omit')
        if self.policy not in ('omit','independent'): raise ValueError('Choose uncertainty omit or independent')
        if dataunit is None: raise ValueError('Aggregation requires qualified science units')
        if centers is None: raise ValueError('Aggregation requires a qualified wavelength axis')
        if self.policy=='independent' and not error_valid: raise ValueError('Independent propagation requires validated sample uncertainties')
        self.selection_unit=dataunit; self.unit=str(dataunit)
        self.definition=''; self.selection=request; self.results={}; self.weight_unit=None
        if self.kind=='aperture-spectrum':
            # A fixed footprint avoids changing the measured region at masked wavelengths.
            if self.width*self.height>1000000: raise ValueError('Aperture exceeds the one-million-pixel image budget')
            def region(box):
                if not isinstance(box,list) or len(box)!=4 or any(type(v)!=int for v in box): raise ValueError('Region requires integer X0,Y0,X1,Y1')
                x0,y0,x1,y1=box
                if not 0<=x0<x1<=self.width or not 0<=y0<y1<=self.height: raise ValueError('Region must be nonempty and in bounds; upper bounds are exclusive')
                mask=np.zeros((self.height,self.width),dtype=bool); mask[y0:y1,x0:x1]=True
                return mask
            source=region(request.get('aperture')); background=request.get('background')
            weights=source.astype(float)/source.sum(); required=source.copy()
            if background!='none':
                bg=region(background)
                if (source&bg).any(): raise ValueError('Source and background regions must not overlap')
                weights-=bg.astype(float)/bg.sum(); required|=bg
            self.weights=weights; self.required=required
            self.definition='Mean per-pixel spectrum'+(' minus mean background' if background!='none' else '; no background subtraction')
            self.output_shape=(len(centers),)
        else:
            if self.width*self.height>1000000: raise ValueError('Output exceeds the one-million-pixel budget')
            if edges is None: raise ValueError('Band integration requires qualified spectral bin edges; tabulated centers alone are insufficient')
            lo=np.minimum(edges[:-1],edges[1:]); hi=np.maximum(edges[:-1],edges[1:])
            def band(interval):
                if not isinstance(interval,list) or len(interval)!=2 or not all(isinstance(v,(int,float)) and np.isfinite(v) for v in interval): raise ValueError('Band requires two finite wavelengths')
                a,b=interval
                if not 0<a<b: raise ValueError('Band wavelengths must be positive and increasing')
                weights=np.maximum(0,np.minimum(hi,b)-np.maximum(lo,a))
                if not np.isclose(weights.sum(),b-a,rtol=1e-9,atol=0): raise ValueError('Requested band is outside the qualified spectral bins')
                return weights
            weights=band(request.get('band')); required=weights>0
            if self.kind=='band-image':
                weights/=weights.sum(); self.definition='Wavelength-bin-weighted mean image'
            elif self.kind=='feature-map':
                continuum=request.get('continuum')
                if not isinstance(continuum,list) or len(continuum)!=4: raise ValueError('Feature map needs two bracketing continuum bands')
                a,b,c,d=continuum; left=band([a,b]); right=band([c,d]); low,high=request['band']
                if not b<=low<high<=c: raise ValueError('Continuum bands must bracket the feature without overlap')
                required|=(left>0)|(right>0)
                left/=left.sum(); right/=right.sum()
                xleft=np.dot(left,centers); xright=np.dot(right,centers)
                if not xright>xleft: raise ValueError('Continuum bands need distinct sampled wavelengths')
                fraction=(centers-xleft)/(xright-xleft)
                weights=weights-left*np.dot(weights,1-fraction)-right*np.dot(weights,fraction)
                self.unit=str(dataunit*u.um); self.weight_unit=u.um
                self.definition='Continuum-subtracted wavelength integral; positive emission, negative absorption'
            else: raise ValueError('Unknown cube aggregation')
            self.weights=weights; self.required=required
            self.output_shape=(self.height,self.width)

    def add(self, channel, y, start, values, sigma, good):
        stop=start+len(values)
        if self.kind=='aperture-spectrum':
            needed=self.required[y,start:stop]
            if not needed.any(): return
            weights=self.weights[y,start:stop][needed]; values=values[needed]; sigma=sigma[needed]; good=good[needed]; slot=channel
        elif self.required[channel]:
            weights=self.weights[channel]; slot=y
        else: return
        samples=NDDataArray(np.where(good,values,0),mask=~good,unit=self.selection_unit,
            uncertainty=StdDevUncertainty(np.where(good,sigma,0)) if self.policy=='independent' else None)
        weighted=samples.multiply(NDDataArray(weights,unit=self.weight_unit))
        if self.kind=='aperture-spectrum': weighted=weighted.sum(operation_ignores_mask=False)
        self.results[slot]=self.results[slot].add(weighted) if slot in self.results else weighted

    def result(self):
        rows=[self.results[i] for i in range(self.output_shape[0])]
        mask=np.stack([r.mask for r in rows])
        values=np.where(mask,np.nan,np.stack([r.data for r in rows]))
        sigma=np.where(mask,np.nan,np.stack([r.uncertainty.array for r in rows])) if self.policy=='independent' else np.full_like(values,np.nan)
        return values,sigma,{'definition':self.definition,'unit':self.unit,'selection':self.selection,
            'arithmetic':'Astropy NDDataArray multiply/sum/add with StdDevUncertainty',
            'uncertaintyPolicy':self.policy,'maskPolicy':'All selected samples required; missing samples are not renormalized.',
            'uncertaintyLabel':'Conditional ±1σ (independent samples)' if self.policy=='independent' else 'Uncertainty not propagated (covariance unknown)'}
`;
