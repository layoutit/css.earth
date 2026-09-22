/** Bounded, data-only local import. It pins original bytes but makes no archive-origin or calibration claim. */
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, open, readdir, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { pinFile, writeProductRecord, type ProductInput } from '../product-record.mts';
import { sha256 } from '../../../src/platform/sha256.mts';
import { proposedFamilyProfiles } from './family-handlers.mts';
import { FAMILY_IDS, type CalibrationState, type DescriptorMember, type FamilyId, type MemberRole } from './product-descriptor.mts';
import { describeMixedNd, inspectMixedNd } from './families/f02-mixed-nd.mts';
import { describeHealpix, inspectHealpix } from './families/f14-healpix.mts';
import { describePhysicalCartesianGrid, inspectPhysicalCartesianGrid, type PhysicalGridContext } from './families/f16-cartesian-grid.mts';

export const LOCAL_IMPORT_SPEC_SCHEMA='cssearth-telescope-local-import-spec@1' as const;
export const LOCAL_IMPORT_SCHEMA='cssearth-telescope-local-import@1' as const;
export interface LocalImportSpec {
  readonly schema:typeof LOCAL_IMPORT_SPEC_SCHEMA;readonly datasetId:string;
  readonly sources:readonly {readonly path:string;readonly role:MemberRole;readonly name?:string}[];
  readonly declarations?:{readonly target?:string;readonly origin?:string;readonly familyHints?:readonly FamilyId[];readonly units?:string;readonly frame?:string;readonly calibrationState?:CalibrationState;readonly physicalContext?:PhysicalGridContext};
  readonly limits:{readonly maxMembers:number;readonly maxBytes:number;readonly maxFileBytes:number};
}
export interface LocalImportManifest {
  readonly schema:typeof LOCAL_IMPORT_SCHEMA;readonly datasetId:string;readonly declarations?:LocalImportSpec['declarations'];readonly limits:LocalImportSpec['limits'];
  readonly members:readonly DescriptorMember[];readonly proposedProfiles:readonly {readonly handlerId:string;readonly profileId:string}[];
  readonly descriptor?:{readonly path:string;readonly bytes:number;readonly sha256:string};
  readonly issues:readonly {readonly state:'unknown'|'unsupported';readonly reason:string}[];
}
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u;
const exact=(value:Record<string,unknown>,keys:readonly string[],label:string)=>{for(const key of Object.keys(value))if(!keys.includes(key))throw new TypeError(`${label} has unsupported field ${key}.`);};
const safeName=(value:string,label:string)=>{if(isAbsolute(value)||!value||value==='.'||value==='..'||value.split(/[\\/]/u).some(part=>!part||part==='.'||part==='..'))throw new TypeError(`${label} must be a contained relative path.`);return value.split('\\').join('/');};
const positive=(value:unknown,label:string)=>{const number=requireFiniteNumber(value,label);if(!Number.isSafeInteger(number)||number<=0)throw new TypeError(`${label} must be a positive whole number.`);return number;};
export function parseLocalImportSpec(value:unknown):LocalImportSpec{
  const root=requireRecord(value,'local import specification');exact(root,['schema','datasetId','sources','declarations','limits'],'local import specification');if(root.schema!==LOCAL_IMPORT_SPEC_SCHEMA)throw new TypeError('Unsupported local import specification schema.');
  const datasetId=requireString(root.datasetId,'dataset id');if(!ID.test(datasetId))throw new TypeError('Dataset id must be a stable identifier.');
  const sources=requireArray(root.sources,'import sources').map((raw,index)=>{const row=requireRecord(raw,`source ${index}`);exact(row,['path','role','name'],`source ${index}`);const role=requireString(row.role,'source role');if(!['science','support','label','coordinates','quality','uncertainty','calibration','response','provenance'].includes(role))throw new TypeError(`Unsupported source role ${role}.`);return {path:requireString(row.path,'source path'),role:role as MemberRole,...(row.name===undefined?{}:{name:safeName(requireString(row.name,'source name'),'source name')})};});
  if(!sources.length)throw new TypeError('Local import needs at least one source.');
  const limits=requireRecord(root.limits,'import limits');exact(limits,['maxMembers','maxBytes','maxFileBytes'],'import limits');const parsedLimits={maxMembers:positive(limits.maxMembers,'maxMembers'),maxBytes:positive(limits.maxBytes,'maxBytes'),maxFileBytes:positive(limits.maxFileBytes,'maxFileBytes')};if(parsedLimits.maxFileBytes>parsedLimits.maxBytes)throw new TypeError('maxFileBytes cannot exceed maxBytes.');
  let declarations:LocalImportSpec['declarations'];if(root.declarations!==undefined){const row=requireRecord(root.declarations,'import declarations');exact(row,['target','origin','familyHints','units','frame','calibrationState','physicalContext'],'import declarations');const state=row.calibrationState===undefined?undefined:requireString(row.calibrationState,'declared calibration state');if(state!==undefined&&!['raw','archive-calibrated','locally-reproduced','reconstructed','model-derived','unknown'].includes(state))throw new TypeError('Unsupported declared calibration state.');const familyHints=row.familyHints===undefined?undefined:requireArray(row.familyHints,'family hints').map(entry=>{const family=requireString(entry,'family hint');if(!(FAMILY_IDS as readonly string[]).includes(family))throw new TypeError(`Unknown family hint ${family}.`);return family as FamilyId;});let physicalContext:PhysicalGridContext|undefined;if(row.physicalContext!==undefined){const context=requireRecord(row.physicalContext,'physical source context');exact(context,['frame','frameBasis','depthBasis','sourceUrl','citation','license','quantity','unit','meanHdu','uncertaintyHdu','uncertaintyForm'],'physical source context');const form=requireString(context.uncertaintyForm,'physical uncertainty form'),sourceUrl=requireString(context.sourceUrl,'physical source URL');if(form!=='standard-deviation')throw new TypeError('Physical Cartesian imports require standard-deviation uncertainty.');if(new URL(sourceUrl).protocol!=='https:')throw new TypeError('Physical Cartesian source URL must be HTTPS.');physicalContext={frame:requireString(context.frame,'physical frame'),frameBasis:requireString(context.frameBasis,'physical frame basis'),depthBasis:requireString(context.depthBasis,'physical depth basis'),sourceUrl,citation:requireString(context.citation,'physical citation'),license:requireString(context.license,'physical licence'),quantity:requireString(context.quantity,'physical quantity'),unit:requireString(context.unit,'physical quantity unit'),meanHdu:positive(context.meanHdu,'mean HDU'),uncertaintyHdu:positive(context.uncertaintyHdu,'uncertainty HDU'),uncertaintyForm:form};}declarations={...(row.target===undefined?{}:{target:requireString(row.target,'declared target')}),...(row.origin===undefined?{}:{origin:requireString(row.origin,'declared origin')}),...(familyHints?{familyHints}:{}),...(row.units===undefined?{}:{units:requireString(row.units,'declared units')}),...(row.frame===undefined?{}:{frame:requireString(row.frame,'declared frame')}),...(state===undefined?{}:{calibrationState:state as CalibrationState}),...(physicalContext?{physicalContext}:{})};}
  return {schema:LOCAL_IMPORT_SPEC_SCHEMA,datasetId,sources,...(declarations?{declarations}:{}),limits:parsedLimits};
}

interface PendingFile {readonly source:string;readonly logical:string;readonly role:MemberRole;readonly bytes:number}
async function enumerate(source:string,logical:string,role:MemberRole):Promise<PendingFile[]>{
  const status=await lstat(source);if(status.isSymbolicLink())throw new TypeError(`Local import refuses symbolic link ${source}.`);
  if(status.isFile())return [{source,logical,role,bytes:status.size}];
  if(!status.isDirectory())throw new TypeError(`Local import accepts only regular files and directories: ${source}.`);
  const result:PendingFile[]=[];for(const entry of (await readdir(source,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(entry.isSymbolicLink())throw new TypeError(`Local import refuses symbolic link ${resolve(source,entry.name)}.`);result.push(...await enumerate(resolve(source,entry.name),`${logical}/${entry.name}`,role));}return result;
}
const mediaType=(path:string)=>/\.fits?$/iu.test(path)?'application/fits':/\.xml$/iu.test(path)?'application/xml':/\.json$/iu.test(path)?'application/json':/\.csv$/iu.test(path)?'text/csv':'application/octet-stream';
async function prefix(path:string):Promise<Uint8Array>{const file=await open(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0));try{const bytes=Buffer.alloc(16*1024),answer=await file.read(bytes,0,bytes.length,0);return bytes.subarray(0,answer.bytesRead);}finally{await file.close();}}

const LOCAL_QUALIFIERS=new Map([
  ['astropy-mixed-nd-fits@1','F02'],
  ['astropy-healpix-fits@1','F14'],
  ['astropy-physical-cartesian-grid@1','F16'],
] as const);
async function qualifyLocalImport(spec:LocalImportSpec,members:readonly DescriptorMember[],candidates:readonly {readonly handlerId:string;readonly profileId:string}[],staging:string):Promise<{readonly descriptor?:{readonly path:string;readonly bytes:number;readonly sha256:string};readonly issue?:LocalImportManifest['issues'][number]}> {
  const supported=candidates.filter(candidate=>LOCAL_QUALIFIERS.has(candidate.profileId as 'astropy-mixed-nd-fits@1'|'astropy-healpix-fits@1'|'astropy-physical-cartesian-grid@1'));
  const hints=spec.declarations?.familyHints;
  if(hints?.includes('F16')&&spec.declarations?.physicalContext===undefined)return{issue:{state:'unsupported',reason:'Physical Cartesian FITS import requires declarations.physicalContext; XYZ axes alone do not establish a physical volume.'}};
  if(!hints?.length&&candidates.length>1)return{issue:{state:'unknown',reason:'Several handlers recognized these bytes. Add one familyHints entry and import again before a content validator selects a route.'}};
  const selected=supported.filter(candidate=>!hints?.length||hints.includes(LOCAL_QUALIFIERS.get(candidate.profileId as 'astropy-mixed-nd-fits@1'|'astropy-healpix-fits@1'|'astropy-physical-cartesian-grid@1')!));
  if(selected.length!==1){
    if(selected.length>1)return{issue:{state:'unknown',reason:'The declared family still selects several content-qualified routes; the import remains pinned without choosing one.'}};
    if(candidates.length)return{issue:{state:'unsupported',reason:'Recognized profiles need metadata or dependency closure that this local import cannot yet qualify.'}};
    return{};
  }
  const science=members.filter(member=>member.role==='science');
  if(science.length!==1)return{issue:{state:'unknown',reason:`The selected local profile requires exactly one science member; this import has ${science.length}.`}};
  const member=science[0]!,pin={path:resolve(staging,member.path),bytes:member.bytes,sha256:member.sha256},profile=selected[0]!;
  try{
    const acquisition={kind:'local-import' as const,identity:'import.json'},calibration={state:'unknown' as const,basis:['Local byte import and content inspection establish structure, not archive origin or calibration.']};
    const value=profile.profileId==='astropy-mixed-nd-fits@1'
      ?describeMixedNd({id:spec.datasetId,member,inspection:await inspectMixedNd(pin),producingRecord:'import.product.json',acquisition,calibration})
      :profile.profileId==='astropy-healpix-fits@1'
        ?describeHealpix({id:spec.datasetId,member,map:await inspectHealpix(pin),producingRecord:'import.product.json',acquisition,calibration})
        :spec.declarations?.physicalContext===undefined?(()=>{throw new TypeError('Physical Cartesian FITS import requires declarations.physicalContext; XYZ axes alone do not establish a physical volume.');})()
        :describePhysicalCartesianGrid({id:spec.datasetId,member,context:spec.declarations.physicalContext,inspection:await inspectPhysicalCartesianGrid(pin,spec.declarations.physicalContext),producingRecord:'import.product.json',target:spec.declarations.target,acquisition});
    const path=resolve(staging,'descriptor.json');await writeFile(path,`${JSON.stringify(value,null,2)}\n`);return{descriptor:{path:'descriptor.json',...await pinFile(path)}};
  }catch(error){return{issue:{state:'unsupported',reason:`The selected ${profile.profileId} content validator refused the imported bytes: ${error instanceof Error?error.message:String(error)}`}};}
}

export async function importLocalArtifact(value:unknown,outputDirectory:string):Promise<{readonly directory:string;readonly manifest:string;readonly receipt:string;readonly descriptor?:string;readonly value:LocalImportManifest}>{
  const spec=parseLocalImportSpec(value),destination=resolve(outputDirectory),pending:PendingFile[]=[];
  for(const [index,source] of spec.sources.entries()){const path=resolve(source.path),name=safeName(source.name??(basename(path)||`source-${index+1}`),`source ${index} name`);pending.push(...await enumerate(path,name,source.role));}
  pending.sort((a,b)=>a.logical.localeCompare(b.logical));if(new Set(pending.map(file=>file.logical.toLowerCase())).size!==pending.length)throw new TypeError('Local import member paths collide.');
  if(!pending.length)throw new TypeError('Local import found no regular files.');
  if(pending.length>spec.limits.maxMembers)throw new RangeError('Local import member limit exceeded.');let declaredBytes=0;for(const file of pending){if(file.bytes>spec.limits.maxFileBytes)throw new RangeError(`Local import file limit exceeded: ${file.logical}.`);declaredBytes+=file.bytes;if(!Number.isSafeInteger(declaredBytes)||declaredBytes>spec.limits.maxBytes)throw new RangeError('Local import byte limit exceeded.');}
  await mkdir(dirname(destination),{recursive:true});await mkdir(destination);const staging=await mkdtemp(`${destination}.partial-`);
  try{
    const members:DescriptorMember[]=[],inputs:ProductInput[]=[];let copiedBytes=0;
    for(const [index,file] of pending.entries()){
      const target=resolve(staging,'files',file.logical),rel=relative(resolve(staging,'files'),target);if(rel==='..'||rel.startsWith('../'))throw new TypeError('Local import path escapes staging.');await mkdir(dirname(target),{recursive:true});
      const before=await pinFile(file.source);if(before.bytes!==file.bytes)throw new Error(`Local source changed during enumeration: ${file.source}.`);await copyFile(file.source,target,constants.COPYFILE_EXCL);const copied=await pinFile(target),after=await pinFile(file.source);if(copied.sha256!==before.sha256||copied.bytes!==before.bytes||after.sha256!==before.sha256||after.bytes!==before.bytes)throw new Error(`Local source changed during import: ${file.source}.`);
      copiedBytes+=copied.bytes;if(copiedBytes>spec.limits.maxBytes)throw new RangeError('Local import byte limit exceeded.');const id=`member-${String(index+1).padStart(4,'0')}`;members.push({id,path:`files/${file.logical}`,role:file.role,...copied,mediaType:mediaType(file.logical)});inputs.push({role:`local ${file.role}`,identity:file.source,...before});
    }
    const recognized=proposedFamilyProfiles(await Promise.all(members.map(async member=>({path:member.path,prefix:await prefix(resolve(staging,member.path))})))),candidates=[...recognized,...(spec.declarations?.physicalContext&&spec.declarations.familyHints?.includes('F16')?[{handlerId:'f16-cartesian-grid',profileId:'astropy-physical-cartesian-grid@1'} as const]:[])];
    const qualification=await qualifyLocalImport(spec,members,candidates,staging);
    const issues:LocalImportManifest['issues']=[{state:'unknown',reason:spec.declarations?.origin?'Origin was declared by the importer and remains unverified; local byte integrity does not establish it.':'No archive origin was declared; local byte integrity does not establish origin.'},...(spec.declarations?[{state:'unknown' as const,reason:'Target, family, units, frame and calibration metadata in declarations are user-supplied assertions until a handler qualifies each applicable fact.'}]:[]),...(candidates.length?[]:[{state:'unsupported' as const,reason:'No registered handler recognized the imported bytes. Original files remain pinned.'}]),...(qualification.issue?[qualification.issue]:[])];
    const manifestValue:LocalImportManifest={schema:LOCAL_IMPORT_SCHEMA,datasetId:spec.datasetId,...(spec.declarations?{declarations:spec.declarations}:{}),limits:spec.limits,members,proposedProfiles:candidates,...(qualification.descriptor?{descriptor:qualification.descriptor}:{}),issues};const manifest=resolve(staging,'import.json');await writeFile(manifest,`${JSON.stringify(manifestValue,null,2)}\n`);
    const implementation=sha256(Buffer.concat(await Promise.all(['local-import.mts','family-handlers.mts','product-descriptor.mts','families/f02-mixed-nd.mts','families/f14-healpix.mts','families/f16-cartesian-grid.mts'].map(name=>readFile(new URL(name,import.meta.url))))));
    const receipt=resolve(staging,'import.product.json');await writeProductRecord(receipt,{telescope:'local import',stage:'telescope-local-import',inputs,parameters:{datasetId:spec.datasetId,declarations:spec.declarations??{},limits:spec.limits,classification:'Handler profiles are candidates until content and metadata qualification confirms them.'},software:[{name:'cssEarth telescope local import',version:implementation}]},[...members.map(member=>({path:member.path,file:resolve(staging,member.path)})),{path:'import.json',file:manifest},...(qualification.descriptor?[{path:qualification.descriptor.path,file:resolve(staging,qualification.descriptor.path)}]:[])]);
    await rmdir(destination);await rename(staging,destination);return {directory:destination,manifest:resolve(destination,'import.json'),receipt:resolve(destination,'import.product.json'),...(qualification.descriptor?{descriptor:resolve(destination,qualification.descriptor.path)}:{}),value:manifestValue};
  }catch(error){await rm(staging,{recursive:true,force:true});await rmdir(destination).catch(()=>{});throw error;}
}
