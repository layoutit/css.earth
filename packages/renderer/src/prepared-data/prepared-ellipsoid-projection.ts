import { requirePreparedMatrix4, readPreparedMatrix4, multiplyPreparedMatrix4, preparedRotationMatrix4, invertPreparedAffineMatrix4, transformPreparedPoint, serializePreparedMatrix4 } from '@cssearth/core';
import type { Matrix4 } from '../solar-system/types.js';
import { projectEyeEllipsoid, requirePhysicalProjection } from './physical-projection.js';
import type { PhysicalProjection } from './physical-projection.js';
export interface CounterTransport { counterPrecision?:number;counterFractionDigits?:number;counterFractionScale?:number; }
export interface EllipsoidProjectionPlan extends CounterTransport {equatorialRadius:number;polarRadius:number;coverageScale:number;bodySystemMatrix:Matrix4;bodyMeshMatrix:Matrix4;materialSystemMatrix:Matrix4;materialMeshMatrix:Matrix4;baseProjection:Matrix4;centerTranslation:Matrix4;inverseCenterTranslation:Matrix4;textureEllipse?:{center:readonly[number,number];covariance:readonly[number,number,number]};}
export interface EllipsoidView {degrees:number;counterMatrix:Matrix4|string;projection:PhysicalProjection;}
interface Covariance {xx:number;xy:number;yy:number;}
type Matrix2 = readonly (readonly number[])[];
// Immutable object transforms and shape dimensions arrive from preparation.
// Only the current shared camera basis and light roll vary during publication.
export function createPreparedEllipsoidProjection({ projection, width, height = width }: {projection:EllipsoidProjectionPlan;width:number;height?:number}) {
  if (!(width > 0) || !(height > 0) || !Number.isFinite(width) || !Number.isFinite(height) ||
      !(["equatorialRadius", "polarRadius", "coverageScale"] as const).every(key => Number.isFinite(projection?.[key]) && projection[key] > 0)) {
    throw new TypeError("Prepared ellipsoid dimensions must be positive and finite.");
  }
  const matrices = {
    bodySystemMatrix: Object.freeze([...requirePreparedMatrix4(projection.bodySystemMatrix)]),
    bodyMeshMatrix: Object.freeze([...requirePreparedMatrix4(projection.bodyMeshMatrix)]),
    materialSystemMatrix: Object.freeze([...requirePreparedMatrix4(projection.materialSystemMatrix)]),
    materialMeshMatrix: Object.freeze([...requirePreparedMatrix4(projection.materialMeshMatrix)]),
    baseProjection: Object.freeze([...requirePreparedMatrix4(projection.baseProjection)]),
    centerTranslation: Object.freeze([...requirePreparedMatrix4(projection.centerTranslation)]),
    inverseCenterTranslation: Object.freeze([...requirePreparedMatrix4(projection.inverseCenterTranslation)]),
  };
  const counterTransport: CounterTransport = Object.freeze({
    ...(projection.counterPrecision === undefined ? {} : { counterPrecision: projection.counterPrecision }),
    ...(projection.counterFractionDigits === undefined ? {} : { counterFractionDigits: projection.counterFractionDigits }),
    ...(projection.counterFractionScale === undefined ? {} : { counterFractionScale: projection.counterFractionScale }),
  });
  const precision = (value: number | undefined): value is number => Number.isInteger(value) && value !== undefined && value >= 1 && value <= 16;
  if (counterTransport.counterPrecision !== undefined && !precision(counterTransport.counterPrecision) ||
      counterTransport.counterFractionDigits !== undefined && (!precision(counterTransport.counterPrecision) ||
        !precision(counterTransport.counterFractionDigits) || !(counterTransport.counterFractionScale !== undefined && counterTransport.counterFractionScale > 0) || !Number.isFinite(counterTransport.counterFractionScale)) ||
      counterTransport.counterFractionScale !== undefined && counterTransport.counterFractionDigits === undefined) {
    throw new TypeError("Prepared matrix transport precision is invalid.");
  }
  const equatorialRadius = projection.equatorialRadius * projection.coverageScale;
  const polarRadius = projection.polarRadius * projection.coverageScale;
  const textureCenter = projection.textureEllipse?.center ?? [width/2,height/2];
  const [xx,xy,yy] = projection.textureEllipse?.covariance ?? [(width/2)**2,0,(height/2)**2];
  if (!textureCenter.every(Number.isFinite) || ![xx,xy,yy].every(Number.isFinite) || !(xx>0) || !(xx*yy-xy*xy>0)) {
    throw new TypeError('Prepared texture ellipse must be finite and positive definite.');
  }
  const textureX=Math.sqrt(xx),textureSkew=xy/textureX,textureY=Math.sqrt(yy-textureSkew**2);
  const textureFrame=[textureX,textureSkew,0,0,0,textureY,0,0,0,0,1,0,textureCenter[0],textureCenter[1],0,1];
  return ({ degrees, counterMatrix, projection: physical }: EllipsoidView) => {
    if (!Number.isFinite(degrees)) {
      throw new TypeError("Prepared ellipsoid view must be finite.");
    }
    const localRotation = multiplyPreparedMatrix4(matrices.centerTranslation,
      multiplyPreparedMatrix4(preparedRotationMatrix4("z", degrees), matrices.inverseCenterTranslation));
    const materialProjection = multiplyPreparedMatrix4(matrices.baseProjection, localRotation);
    const scene = requirePhysicalProjection(physical).eyeFromScene;
    const counter = readPreparedCounterMatrix(counterMatrix, counterTransport);
    const body = multiplyPreparedMatrix4(multiplyPreparedMatrix4(scene, matrices.bodySystemMatrix), matrices.bodyMeshMatrix);
    const parent = multiplyPreparedMatrix4(multiplyPreparedMatrix4(
      multiplyPreparedMatrix4(scene, matrices.materialSystemMatrix), counter), matrices.materialMeshMatrix);
    const material = multiplyPreparedMatrix4(parent, materialProjection);
    const target = projectEyeEllipsoid(transformPreparedPoint(body, 0, 0, 0, 1), [
      transformPreparedPoint(body, 1, 0, 0, 0), transformPreparedPoint(body, 0, 1, 0, 0), transformPreparedPoint(body, 0, 0, 1, 0),
    ], [equatorialRadius, equatorialRadius, polarRadius], physical.focalPixels);
    const texture=multiplyPreparedMatrix4(material,textureFrame);
    const source = projectEyeEllipsoid(transformPreparedPoint(texture,0,0,0,1), [
      transformPreparedPoint(texture,1,0,0,0),transformPreparedPoint(texture,0,1,0,0),
    ], [1,1], physical.focalPixels);
    if (!target || !source) {
      const tangent=tangentDisc(body,texture,[equatorialRadius,equatorialRadius,polarRadius]);
      if (!tangent) return serializePreparedMatrix4(materialProjection);
      return serializePreparedMatrix4(multiplyPreparedMatrix4(multiplyPreparedMatrix4(
        invertPreparedAffineMatrix4(parent),tangent),invertPreparedAffineMatrix4(textureFrame)));
    }
    const covarianceScale = Math.max(target.covariance.xx, target.covariance.yy, source.covariance.xx, source.covariance.yy);
    const normalized = (value: Covariance): Covariance => ({ xx: value.xx / covarianceScale, xy: value.xy / covarianceScale, yy: value.yy / covarianceScale });
    const correction = multiplyMatrix2(covarianceSquareRoot(normalized(target.covariance)), invertMatrix2(covarianceSquareRoot(normalized(source.covariance)), 0));
    const tx = target.center[0] - correction[0][0] * source.center[0] - correction[0][1] * source.center[1];
    const ty = target.center[1] - correction[1][0] * source.center[0] - correction[1][1] * source.center[1];
    // An affine correction in projected coordinates is a homogeneous eye
    // transform: screen translation multiplies depth, never world metres.
    const screenCorrection = [
      correction[0][0], correction[1][0], 0, 0,
      correction[0][1], correction[1][1], 0, 0,
      -tx / physical.focalPixels, -ty / physical.focalPixels, 1, 0,
      0, 0, 0, 1,
    ];
    return serializePreparedMatrix4(multiplyPreparedMatrix4(
      multiplyPreparedMatrix4(invertPreparedAffineMatrix4(parent), screenCorrection), material));
  };
}

function tangentDisc(body: Matrix4, texture: Matrix4, radii: readonly number[]): Matrix4 | null {
  const sphere=body.map((value,index)=>index<12?value*radii[Math.floor(index/4)]:value);
  const inverse=invertPreparedAffineMatrix4(sphere),eye=[inverse[12],inverse[13],inverse[14]];
  const distance=Math.hypot(...eye);
  if (!(distance>1)) return null;
  const normal=eye.map(value=>value/distance);
  const dot=(a:readonly number[],b:readonly number[])=>a.reduce((sum,value,i)=>sum+value*b[i],0);
  const direction=(column:number)=>{
    const p=transformPreparedPoint(inverse,texture[column],texture[column+1],texture[column+2],0);
    return [p.x,p.y,p.z];
  };
  const sourceX=direction(0),sourceY=direction(4);
  let x=sourceX.map((value,i)=>value-normal[i]*dot(sourceX,normal));
  if(Math.hypot(...x)<1e-10)x=sourceY.map((value,i)=>value-normal[i]*dot(sourceY,normal));
  const length=Math.hypot(...x); x=x.map(value=>value/length);
  let y=[normal[1]*x[2]-normal[2]*x[1],normal[2]*x[0]-normal[0]*x[2],normal[0]*x[1]-normal[1]*x[0]];
  if(dot(y,sourceY)<0)y=y.map(value=>-value);
  const radius=Math.sqrt(1-1/(distance*distance));
  const center=transformPreparedPoint(sphere,normal[0]/distance,normal[1]/distance,normal[2]/distance,1);
  const a=transformPreparedPoint(sphere,x[0]*radius,x[1]*radius,x[2]*radius,0);
  const b=transformPreparedPoint(sphere,y[0]*radius,y[1]*radius,y[2]*radius,0);
  // Bring the entire retained disc ahead of the solid surface without changing
  // a single projected ray. Its conic can cross the eye plane: CSS clips that
  // part naturally, so grazing surface views do not require a bounded ellipse.
  const bodyRadius=Math.max(...[0,4,8].map(i=>Math.hypot(sphere[i],sphere[i+1],sphere[i+2])));
  const clearance=Math.hypot(body[12],body[13],body[14])-bodyRadius;
  const extent=Math.hypot(center.x,center.y,center.z)+Math.hypot(a.x,a.y,a.z)+Math.hypot(b.x,b.y,b.z);
  const scale=clearance>0?Math.min(1,clearance/(4*extent)):1;
  return [a.x*scale,a.y*scale,a.z*scale,0,b.x*scale,b.y*scale,b.z*scale,0,
    normal[0],normal[1],normal[2],0,center.x*scale,center.y*scale,center.z*scale,1];
}

// Some retained references consumed CSSOM numeric transport before projection.
// Its precision is prepared data. Preserve that input without reparsing DOM or
// changing the higher-precision transform that the common view owner publishes.
export function readPreparedCounterMatrix(value: Matrix4 | string | undefined, projection: CounterTransport): Matrix4 {
  const values = readPreparedMatrix4(value);
  if (projection.counterPrecision === undefined) return values;
  const components = typeof value === "string" ? value.slice(9, -1).split(",").map(value => value.trim()) : values.map(String);
  const fastDecimal = projection.counterFractionDigits !== undefined && !components.some(value => /e/iu.test(value));
  return values.map((number, index) => {
    const fraction = components[index].split(".")[1];
    if (fastDecimal && fraction !== undefined && projection.counterFractionDigits !== undefined && fraction.length >= projection.counterFractionDigits) {
      number = Math.sign(number) * (Math.trunc(Math.abs(number)) +
        Number(fraction.slice(0, projection.counterFractionDigits)) * (projection.counterFractionScale ?? 1));
    }
    return Number(number.toPrecision(projection.counterPrecision));
  });
}

function covarianceSquareRoot(matrix: Covariance): Matrix2 {
  const determinantRoot = Math.sqrt(Math.max(0, matrix.xx * matrix.yy - matrix.xy ** 2));
  const divisor = Math.sqrt(Math.max(Number.EPSILON, matrix.xx + matrix.yy + 2 * determinantRoot));
  return [[(matrix.xx + determinantRoot) / divisor, matrix.xy / divisor],
    [matrix.xy / divisor, (matrix.yy + determinantRoot) / divisor]];
}

function invertMatrix2(matrix: Matrix2, minimumDeterminant = 1e-12): Matrix2 {
  const determinant = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
  if (!Number.isFinite(determinant) || determinant === 0 || Math.abs(determinant) < minimumDeterminant) throw new RangeError("Prepared material projection became singular.");
  return [[matrix[1][1] / determinant, -matrix[0][1] / determinant], [-matrix[1][0] / determinant, matrix[0][0] / determinant]];
}

function multiplyMatrix2(left: Matrix2, right: Matrix2): Matrix2 {
  return [[left[0][0] * right[0][0] + left[0][1] * right[1][0], left[0][0] * right[0][1] + left[0][1] * right[1][1]],
    [left[1][0] * right[0][0] + left[1][1] * right[1][0], left[1][0] * right[0][1] + left[1][1] * right[1][1]]];
}
