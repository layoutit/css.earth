/** Scientific output policy for planetary depth-like products. It performs no inversion or rendering. */
import type {ProductComponent} from './product-descriptor.mts';

export type PlanetaryOutputKind='native'|'slice'|'profile'|'coverage'|'isosurface'|'interactive-html'|'body-attachment';
export interface PlanetaryOutputVerdict {readonly output:PlanetaryOutputKind;readonly available:boolean;readonly reason:string;readonly labelRequirement?:string}
const answer=(output:PlanetaryOutputKind,available:boolean,reason:string,labelRequirement?:string):PlanetaryOutputVerdict=>({output,available,reason,...(labelRequirement?{labelRequirement}:{})});
const depthAxis=(component:ProductComponent)=>component.depth&&component.depth.coordinate!=='none'?component.axes.find(axis=>axis.role===component.depth!.coordinate):undefined;

/** Enforce the minimum scientific contract before an adapter can publish a planetary product. */
export function assertPlanetaryProductSemantics(component:ProductComponent):void{
  if(!component.support||!component.depth||!component.observability)throw new TypeError('Planetary products require support, depth, and observability semantics.');
  if(!component.sampling||new Set(component.sampling.axes.map(axis=>axis.axisId)).size!==component.axes.length||component.axes.some(axis=>!component.sampling!.axes.some(sample=>sample.axisId===axis.id)))throw new TypeError('Planetary products require one sampling declaration for every axis.');
  if(!component.resolution)throw new TypeError('Planetary products require an explicit resolution state; sampling cannot substitute for it.');
  if(!component.uncertainty)throw new TypeError('Planetary products require an explicit uncertainty state, including none-supplied or unknown.');
  if(!component.quantity.unit)throw new TypeError('Planetary products require an explicit quantity unit, including 1 for dimensionless quantities.');
  if(!component.frame)throw new TypeError('Planetary products require an explicit coordinate frame.');
  for(const axis of component.axes)if(!axis.unit||!axis.reference||!axis.derivation)throw new TypeError(`Planetary axis ${axis.id} requires unit, reference, and derivation evidence.`);
  if(component.support.class!=='observed-samples'&&!component.inference)throw new TypeError(`${component.support.class} requires a retained inference method.`);
  if(component.depth.coordinate==='pressure'&&component.observability.measurementOperator==='microwave-radiative-transfer'&&component.support.class==='observed-samples')throw new TypeError('Microwave observations may retain channel brightness temperatures, but a pressure-coordinate field requires an explicit retrieval or reconstruction.');
  if((component.observability.measurementOperator==='gravity-integral'||component.observability.measurementOperator==='magnetic-induction')&&component.observability.localization!=='non-unique')throw new TypeError('Gravity and magnetic integral responses must retain non-unique localization.');
  if(['geometric-depth','altitude','radius'].includes(component.depth.coordinate)&&component.depth.conversion.state==='unavailable')throw new TypeError(`${component.depth.coordinate} requires a native or derived physical-coordinate basis.`);
}

/** Decide outputs only from retained descriptor facts. Coordinate spacing never becomes resolution evidence here. */
export function planetaryOutputPolicy(component:ProductComponent):readonly PlanetaryOutputVerdict[]{
  try{assertPlanetaryProductSemantics(component);}catch(error){const reason=error instanceof Error?error.message:String(error);return(['native','slice','profile','coverage','isosurface','interactive-html','body-attachment'] as const).map(output=>answer(output,false,reason));}
  const depth=component.depth!,observability=component.observability!,grid=component.representation.kind==='physical-field'&&component.representation.topology==='grid',dimensions=component.axes.length,vertical=depthAxis(component),coverage=observability.coverage.memberIds.length>0;
  const native=answer('native',true,'Native members preserve the qualified quantity, coordinates, support, and evidence closure.');
  const slice=answer('slice',grid&&dimensions>=2,grid&&dimensions>=2?'A qualified grid has at least two retained semantic axes.':'Slices require a qualified grid with at least two semantic axes.');
  const profile=answer('profile',vertical!==undefined,vertical?'The requested depth-like coordinate is retained explicitly.':'Profiles require an explicit delay, depth, pressure, altitude, or radius axis.');
  const coverageOutput=answer('coverage',coverage,coverage?'The exact observed tracks, rays, stations, channels, trajectories, cells, or profiles remain linked.':'No exact measurement-support members are retained.');
  const surface=answer('isosurface',grid&&dimensions===3,grid&&dimensions===3?'A three-axis scalar grid can produce quantity-threshold surfaces.':'Isosurfaces require a qualified three-axis scalar grid.','Label every surface as a threshold of the retained quantity; never as composition, density, or a geologic boundary unless that is the qualified quantity.');
  const html=answer('interactive-html',(grid&&dimensions>=2)||coverage,(grid&&dimensions>=2)||coverage?'A grid or exact coverage geometry has a faithful interactive view.':'Interactive output requires a qualified grid or exact coverage geometry.','Show unsupported regions and the native depth coordinate; cosmetic filling cannot become support.');
  const coordinate=depth.coordinate,cartesian=['body-fixed-x','body-fixed-y','body-fixed-z'].every(role=>component.axes.some(axis=>axis.role===role)),convertible=cartesian||depth.conversion.state!=='unavailable',bodyCoordinate=cartesian||coordinate==='geometric-depth'||coordinate==='altitude'||coordinate==='radius',localized=observability.localization!=='non-unique',labelledModel=!localized&&component.support!.class!=='observed-samples'&&component.inference!==undefined,body=grid&&bodyCoordinate&&convertible&&(localized||labelledModel);
  const bodyReason=!grid?'Body attachment requires a qualified grid.':!bodyCoordinate?`${coordinate} is not a body-placement coordinate.`:!convertible?'The coordinate has no qualified physical conversion.':!localized&&!labelledModel?'A non-unique integral response cannot be attached as measured localized matter.':'The coordinate, conversion, support class, inference, and frame permit a labelled body attachment.';
  const bodyLabel=body?(labelledModel?'Label the rendering as an inferred model or ensemble; it is not a uniquely measured interior.':'Retain datum, conversion method, parameters, uncertainty, frame, and unsupported mask.'):undefined;
  return[native,slice,profile,coverageOutput,surface,html,answer('body-attachment',body,bodyReason,bodyLabel)];
}
export function requirePlanetaryOutput(component:ProductComponent,output:PlanetaryOutputKind):PlanetaryOutputVerdict{const found=planetaryOutputPolicy(component).find(value=>value.output===output)!;if(!found.available)throw new TypeError(`${output} refused: ${found.reason}`);return found;}
