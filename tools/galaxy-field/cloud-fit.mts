import type { Point } from './catalogue.mts';
/** Bounded k-means Gaussian count field. Covariances retain filament orientation. */
export function fitClouds(points: readonly Point[], recipe: {count:number;iterations:number;minimumMembers:number;covarianceFloorMpc2:number;maximumBrightness:number;exposure:number}) {
  const k = Math.min(recipe.count, points.length);
  const centers = Array.from({length:k},(_,i)=>{const p=points[Math.floor(i*points.length/k)]!;return [p.x,p.y,p.z];});
  const assignments = new Int32Array(points.length);
  for(let round=0;round<recipe.iterations;round++){
    const sums=centers.map(()=>[0,0,0,0]);
    points.forEach((p,i)=>{let best=0,min=Infinity;centers.forEach((c,j)=>{const d=(p.x-c[0]!)**2+(p.y-c[1]!)**2+(p.z-c[2]!)**2;if(d<min){min=d;best=j;}});assignments[i]=best;const s=sums[best]!;s[0]!+=p.x;s[1]!+=p.y;s[2]!+=p.z;s[3]!++;});
    sums.forEach((s,i)=>{if(s[3]!>0)centers[i]=[s[0]!/s[3]!,s[1]!/s[3]!,s[2]!/s[3]!];});
  }
  const groups=centers.map(()=>({count:0,covariance:Array<number>(9).fill(0)}));
  points.forEach((p,i)=>{const j=assignments[i]!,c=centers[j]!,g=groups[j]!,d=[p.x-c[0]!,p.y-c[1]!,p.z-c[2]!];g.count++;for(let a=0;a<3;a++)for(let b=0;b<3;b++)g.covariance[a*3+b]!+=d[a]!*d[b]!;});
  return groups.flatMap((g,i)=>{
    if(g.count<recipe.minimumMembers)return [];
    const covariance=g.covariance.map((v,j)=>v/g.count+(j%4===0?recipe.covarianceFloorMpc2:0));
    const [a,b,c,,d,e,,,f]=covariance;
    const determinant=a!*(d!*f!-e!*e!)-b!*(b!*f!-e!*c!)+c!*(b!*e!-d!*c!);
    const density=g.count/Math.sqrt(Math.max(1e-12,determinant));
    return [{position:centers[i],covariance,radius:3*Math.sqrt(Math.max(covariance[0]!,covariance[4]!,covariance[8]!)),brightness:Math.min(recipe.maximumBrightness,recipe.exposure*Math.log1p(density)),count:g.count}];
  });
}
