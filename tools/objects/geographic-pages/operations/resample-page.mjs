// Preparation only: integrate source pixel areas at exact geographic addresses.
// Rounding each page's crop independently shifts adjacent images by a fraction
// of a source pixel. Shared geographic sample positions must remain identical.
export function resamplePageRgba(rgba, sourceWidth, sourceHeight, bounds, width, height) {
  const { x0, y0, x1, y1 } = bounds;
  if (rgba.length !== sourceWidth * sourceHeight * 4 ||
      ![x0, y0, x1, y1].every(Number.isFinite) ||
      x0 < 0 || y0 < 0 || x1 > sourceWidth || y1 > sourceHeight ||
      x1 <= x0 || y1 <= y0 || !Number.isSafeInteger(width) || width < 1 ||
      !Number.isSafeInteger(height) || height < 1) {
    throw new Error("City page sampling extends beyond its pinned source crop.");
  }
  const weights = (start, end, count) => Array.from({ length: count }, (_, i) => {
    const a = start + (end - start) * i / count;
    const b = start + (end - start) * (i + 1) / count;
    const samples = [];
    for (let p = Math.floor(a); p < Math.ceil(b); p += 1) {
      const weight = Math.max(0, Math.min(b, p + 1) - Math.max(a, p)) / (b - a);
      if (weight) samples.push([p, weight]);
    }
    return samples;
  });
  const xs = weights(x0, x1, width), ys = weights(y0, y1, height);
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let red = 0, green = 0, blue = 0, alpha = 0;
      for (const [sy, wy] of ys[y]) for (const [sx, wx] of xs[x]) {
        const offset = (sy * sourceWidth + sx) * 4;
        const weight = wy * wx * rgba[offset + 3];
        alpha += weight;
        red += weight * rgba[offset];
        green += weight * rgba[offset + 1];
        blue += weight * rgba[offset + 2];
      }
      const offset = (y * width + x) * 4;
      if (alpha) {
        output[offset] = Math.round(red / alpha);
        output[offset + 1] = Math.round(green / alpha);
        output[offset + 2] = Math.round(blue / alpha);
      }
      output[offset + 3] = Math.round(alpha);
    }
  }
  return output;
}

// Preparation-only reprojection onto the accepted face. Integrate the source
// pixel box enclosing each tiny projective footprint, with premultiplied alpha.
// Keep two mapped rows; no global raster or runtime reprojection is introduced.
export function resampleMappedPageRgba(rgba,sourceWidth,sourceHeight,map,width,height,covered=null) {
  const output=Buffer.alloc(width*height*4);
  const row=y=>Array.from({length:width+1},(_,x)=>map(x/width,y/height));
  let previous=row(0);
  for(let y=0;y<height;y++) {
    const next=row(y+1);
    for(let x=0;x<width;x++) {
      const coverage=covered?([.25,.75].reduce((sum,dy)=>sum+[.25,.75].reduce((n,dx)=>
        n+Number(covered((x+dx)/width,(y+dy)/height)),0),0))/4:1;
      if (!coverage) continue;
      const a=previous[x],b=previous[x+1],c=next[x],d=next[x+1];
      const x0=Math.min(a[0],b[0],c[0],d[0]),x1=Math.max(a[0],b[0],c[0],d[0]);
      const y0=Math.min(a[1],b[1],c[1],d[1]),y1=Math.max(a[1],b[1],c[1],d[1]);
      if(![x0,x1,y0,y1].every(Number.isFinite)||x0<0||y0<0||x1>sourceWidth||y1>sourceHeight||x1<=x0||y1<=y0) {
        throw new Error('Reprojected city texel exceeds its pinned source window.');
      }
      let red=0,green=0,blue=0,alpha=0;
      for(let sy=Math.floor(y0);sy<Math.ceil(y1);sy++)for(let sx=Math.floor(x0);sx<Math.ceil(x1);sx++) {
        const area=(Math.min(x1,sx+1)-Math.max(x0,sx))*(Math.min(y1,sy+1)-Math.max(y0,sy));
        const offset=(sy*sourceWidth+sx)*4,weight=area*rgba[offset+3];
        alpha+=weight;red+=weight*rgba[offset];green+=weight*rgba[offset+1];blue+=weight*rgba[offset+2];
      }
      const offset=(y*width+x)*4;
      if(alpha){output[offset]=Math.round(red/alpha);output[offset+1]=Math.round(green/alpha);output[offset+2]=Math.round(blue/alpha);}
      output[offset+3]=Math.round(coverage*alpha/((x1-x0)*(y1-y0)));
    }
    previous=next;
  }
  return output;
}

