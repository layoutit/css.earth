/** The telescope's human screens: a saved session, an exploration and an artifact's outputs, with the commands they suggest. */
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { formatAnswer } from './observation-query/query.mts';
import { assessRequest } from './requests/request-satisfaction.mts';
import type { ExplorationSession, Session } from './session.mts';
import type { OutputChoice } from './delivery/outputs.mts';
import type { SourceRelevance } from './products/source-relevance.mts';
import type { ProductSoftware } from '@cssearth/objects';
import type { SourceProcessingSoftware } from './products/source-product-contract.mts';
import type { DeliveryContext } from './delivery/delivery-context.mts';
import type { FamilyOperation } from './family-handler.mts';
import { requireString } from '@cssearth/core';

const briefDiagnostic=(value:string)=>value.length<=280?value:`${value.slice(0,279).trimEnd()}… (full reason in saved result)`;
export function formatSession(session: Session, directory: string,verbose=false): string {
  const answer=session.answer,lines = [`${session.target} · ${answer.request.kind} · ${answer.request.wavelengthMicrometres.join('–')} µm`, ''];
  const append=(heading:string,rows:readonly string[],total=rows.length)=>{
    if(!rows.length)return;
    lines.push('',`${heading} (${total}):`);
    for(const row of verbose?rows:rows.slice(0,5))lines.push(`  ${verbose?row:briefDiagnostic(row)}`);
    if(!verbose&&rows.length>5)lines.push(`  ${rows.length-5} more in the saved result.`);
  };
  if(answer.endpoint.coverage==='incomplete')lines.push('Search coverage is incomplete; provider or indexed-source results below cannot establish a negative.');
  for (const choice of session.choices) {
    const verdict = choice.product ? assessRequest(answer.request, choice.product.facts) : undefined;
    lines.push(`${choice.pick}. ${choice.telescope} / ${choice.mode} / ${choice.observation}`,
      `   ${choice.state === 'ready' ? 'Data qualified' : 'Qualification required'}${verdict ? `; request ${verdict.status}` : ''}`);
    if (verdict) for (const [name, v] of Object.entries(verdict.constraints)) if (v.answer !== 'yes') lines.push(`   ${name}: ${v.answer}. ${v.reason}`);
  }
  if (!session.choices.length) {
    lines.push(`No retrievable observation. Workflow: ${answer.endpoint.status}.`);
    if (answer.targetResolution.status !== 'resolved') lines.push(formatAnswer(answer).trim());
  }
  const services=[...answer.archiveAccess?.services??[]].sort((a,b)=>(a.state==='unavailable'||a.state==='overflow'?0:1)-(b.state==='unavailable'||b.state==='overflow'?0:1));
  const providerRows=verbose?services.map(service=>`${service.service}: ${service.state}. ${service.reason}`):(()=>{
    const groups=new Map<string,{state:string;reason:string;names:string[]}>();
    for(const service of services){const key=`${service.state}\u0000${service.reason}`,group=groups.get(key);if(group)group.names.push(service.service);else groups.set(key,{state:service.state,reason:service.reason,names:[service.service]});}
    return [...groups.values()].map(group=>group.names.length===1?`${group.names[0]}: ${group.state}. ${group.reason}`:`${group.names.length} providers ${group.state}: ${group.reason} (${group.names.join(', ')})`);
  })();
  append('Provider status',providerRows,services.length);
  append('Indexed coverage',answer.targetCoverage.filter(coverage=>coverage.state!=='observed').map(coverage=>`${coverage.telescope}: ${coverage.state}. ${coverage.reason}`));
  append('Source intake',answer.sourceIntakeIssues?.map(issue=>`${issue.state}: ${issue.path}. ${issue.reason}`)??[]);
  if(!session.choices.length)append('Candidate mode blockers',answer.candidates.map(candidate=>`${candidate.telescope} / ${candidate.mode}: ${candidate.selectionAssessment.blockers.map(blocker=>blocker.reason).join('; ')||'No exact qualified artifact or executable qualification action.'}`));
  append('Unselectable archive records',answer.archiveAccess?.records.filter(record=>!record.products.length).map(record=>`${record.observation.key}: ${record.observation.target.status}. ${record.issues.join('; ')}`)??[]);
  lines.push('', `Saved: ${displayPath(resolve(directory, 'query.json'))}`);
  if (session.choices.length) lines.push(`Next: telescope get ${shellWord(displayPath(directory))} --pick N`);
  else if(answer.endpoint.coverage==='incomplete')lines.push('Resolve the provider or source errors, or narrow the request; then save a new query in a new directory.');
  return `${lines.join('\n')}\n`;
}

export const shellWord = (value:string):string => /^[A-Za-z0-9_./,:@+%=-]+$/u.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
export const displayPath = (path:string):string => {
  const local=relative(process.cwd(),resolve(path));
  return local&&!isAbsolute(local)&&local!=='..'&&!local.startsWith(`..${sep}`)?local:path;
};
const displayTime = (start:string|null,end:string|null):string => start === null ? 'date unknown' : end && end !== start ? `${start} to ${end}` : start;
function displayWavelengths(value:readonly (number|null)[]|readonly (readonly [number,number])[]):string {
  if(!value.length)return 'wavelength unknown';
  const ranges = Array.isArray(value[0]) ? value as readonly (readonly [number,number])[] : [value as readonly [number|null,number|null]];
  return ranges.map(range=>range[0]===null||range[1]===null?'unknown':`${range[0]}–${range[1]} µm`).join(', ');
}
export function formatExploration(session:ExplorationSession & {readonly directory:string},verbose=false):string {
  const answer=session.answer,resolution=answer.targetResolution;
  const title=resolution.status==='resolved'?resolution.canonical.name:answer.target;
  const lines=[title,''];
  if(answer.outcome.coverage==='target-unresolved')lines.push('Target unresolved; no archive search was run.');
  else if(answer.outcome.selection==='available')lines.push(`${session.choices.length} retrievable choice(s) in this bounded search.${answer.outcome.coverage==='incomplete'?' Search coverage is incomplete.':''}`);
  else if(answer.outcome.coverage==='incomplete')lines.push('Search incomplete; no retrievable observation was confirmed. Check the search limits and unresolved discoveries below.');
  else if(answer.unsupported.length)lines.push(`No retrievable observation in this configured, bounded search; ${answer.unsupported.length} discovery record(s) lack a supported route or do not match the filters.`);
  else lines.push('No retrievable observation in this configured, bounded search. This does not establish that no observation exists.');
  for(const choice of session.choices){
    const d=choice.display,size=d.advertisedKilobytes===null?'size unknown':`${d.advertisedKilobytes} kB advertised`;
    const instrument = d.instrument === choice.telescope || d.instrument.startsWith(`${choice.telescope} / `)
      ? d.instrument : `${choice.telescope} / ${d.instrument}`;
    lines.push(`${choice.pick}. ${instrument} · ${displayTime(d.observationTime.startIso,d.observationTime.endIso)} · ${d.productKind??'product kind unknown'}`,
      `   ${choice.state==='ready'?'Qualified product available':'Retrieval and qualification available'} · ${size} · ${d.metadataBasis} metadata`,
      `   ${displayWavelengths(d.wavelengthsMicrometres)}`,
      `   ${choice.reason}`);
    const limitations=[...new Set(choice.limitations)];
    for(const limitation of verbose?limitations:limitations.slice(0,3))lines.push(`   Limitation: ${limitation}`);
    if(!verbose&&limitations.length>3)lines.push(`   ${limitations.length-3} more distinct limitation(s) in the saved result.`);
  }
  for(const service of answer.services)if('sharpest' in service&&service.sharpest?.length){
    lines.push('',`Spacecraft images in OPUS (${service.images} of ${service.opusTarget}; sharpest per instrument):`);
    for(const [index,image] of service.sharpest.entries())lines.push(`  OPUS ${index+1}. ${image.instrument} · ${image.startTime} · ${image.centreResolutionKmPerPixel??'unknown'} km/px at body centre${image.pixelsAcross===null?'':` · ${image.pixelsAcross} px across`} · ${image.instrumentImages} images · ${image.opusId}`);
    lines.push(`  Fetch native image and label: telescope fetch ${shellWord(displayPath(resolve(session.directory,'explore.json')))} --archive opus --pick N --out DIRECTORY`);
  }
  for(const service of answer.services)if('instruments' in service&&(service.instruments.length||service.sources?.length)){
    lines.push('',`Live archive leads (${service.service}; ${service.scope}):`);
    for(const lead of service.instruments)lines.push(`  ${lead.telescope} / ${lead.instrument} · ${lead.records} record(s) · example ${lead.sample}`);
    if(service.sources?.length){
      const archive='koaid' in service.sources[0]!?'keck':'uri' in service.sources[0]!?'gemini':'obsid' in service.sources[0]!?'chandra':'spitzer';
      const archiveLabel=archive[0]!.toUpperCase()+archive.slice(1);
      lines.push(`  ${service.sources.length} ${archiveLabel} source choice(s) sampled:`);
      for(const [index,source] of (verbose?service.sources:service.sources.slice(0,8)).entries()){
        const identity='koaid' in source?source.koaid:'uri' in source?source.name:'obsid' in source?String(source.obsid):String(source.aorKey);
        lines.push(`  ${archiveLabel} ${index+1}. ${source.instrument} · ${identity} · archive name ${source.targetName}`);
      }
      if(!verbose&&service.sources.length>8)lines.push(`  ${service.sources.length-8} more source lead(s) in the saved result.`);
      lines.push(`  Fetch source: telescope fetch ${shellWord(displayPath(resolve(session.directory,'explore.json')))} --archive ${archive} --pick N --out DIRECTORY`);
      lines.push('  Native source bytes only; target association and calibration remain unresolved.');
    }else lines.push('  Discovery only; no exact acquisition or qualification route is implied.');
  }
  const wwt=answer.curatedImagery;
  if(wwt?.state==='indexed'&&wwt.total){
    lines.push('',`WWT curated imagery (${wwt.total} title/frame match${wwt.total===1?'':'es'}; pinned catalog ${wwt.revision.slice(0,12)}):`);
    const displayed=verbose?wwt.matches:wwt.matches.slice(0,5);
    const catalogText=(value:string)=>value.replace(/[\p{Cc}\p{Cf}]+/gu,' ').replace(/\s+/gu,' ').trim();
    for(const [index,image] of displayed.entries()){
      lines.push(`  WWT ${index+1}. ${briefDiagnostic(catalogText(image.name))} · ${catalogText(image.bandPass)} · ${catalogText(image.projection)} · ${image.matchBasis} match`,
        `    Credit: ${briefDiagnostic(catalogText(image.credits))||'not supplied by WWT'} · ${image.catalogUrl}`);
      if(verbose&&image.dataSetType==='Sky')lines.push(`    WWT projection origin: RA ${image.position.centerXDegrees}°, Dec ${image.position.centerYDegrees}° (not a verified footprint)`);
    }
    if(wwt.matches.length>displayed.length)lines.push(`  ${wwt.matches.length-displayed.length} more match(es) in the saved result.`);
    if(wwt.total>wwt.matches.length)lines.push(`  ${wwt.total-wwt.matches.length} additional match(es) omitted by the ${wwt.limit}-entry cap.`);
    lines.push(`  Static image: telescope wwt-image ${shellWord(displayPath(resolve(session.directory,'explore.json')))} --pick N --level 0..3 --out DIRECTORY`);
    lines.push('  Display imagery only; these are not selectable observations or qualified science products.');
  }else if(wwt?.state==='unavailable')lines.push('',`WWT curated imagery unavailable: ${wwt.reason}`);
  const wwtFits=answer.wwtFits;
  if(wwtFits?.state==='indexed'&&wwtFits.matches.length){
    lines.push('',`WWT-hosted FITS source leads for ${answer.target} (${wwtFits.matches.length}; target association only):`);
    for(const lead of wwtFits.matches)lines.push(`  WWT FITS ${lead.pick}. ${lead.imageset} · ${lead.bandPass} · ${lead.sourceUrl}`,`    Target association: ${lead.evidence}`);
    lines.push(`  Retrieve original numeric tile: telescope wwt-fits ${shellWord(displayPath(resolve(session.directory,'explore.json')))} --pick N --level 0 --x 0 --y 0 --out DIRECTORY`,
      '  Tile units, uncertainty, celestial WCS and original exposure identity remain unresolved.');
  }else if(wwtFits?.state==='unavailable')lines.push('',`WWT FITS leads unavailable: ${wwtFits.reason}`);
  const appendIssues=(heading:string,issues:readonly {readonly identity?:string;readonly scope:string;readonly reason:string}[],total=issues.length)=>{
    if(!issues.length)return;
    lines.push('',`${heading} (${total}):`);
    for(const issue of verbose?issues:issues.slice(0,5)){
      const row=`${issue.identity??issue.scope}: ${issue.reason}`;
      lines.push(`  ${verbose?row:briefDiagnostic(row)}`);
    }
    if(!verbose&&issues.length>5)lines.push(`  ${issues.length-5} more in the saved result.`);
  };
  const statusIssues=verbose?answer.issues:(()=>{
    const groups=new Map<string,{issue:(typeof answer.issues)[number];identities:string[]}>();
    for(const issue of answer.issues){
      const key=issue.scope==='provider'?`${issue.code}\u0000${issue.reason}`:`${issue.code}\u0000${issue.identity??''}\u0000${issue.reason}`;
      const group=groups.get(key);
      if(group)group.identities.push(issue.identity??issue.scope);
      else groups.set(key,{issue,identities:[issue.identity??issue.scope]});
    }
    return [...groups.values()].map(({issue,identities})=>identities.length===1?issue:{...issue,identity:`${identities.length} providers (${identities.join(', ')})`});
  })();
  appendIssues('Search limits and provider status',statusIssues,answer.issues.length);
  appendIssues('Unresolved discoveries',answer.unresolved);
  appendIssues('Unsupported discoveries',answer.unsupported);
  lines.push('',`Saved: ${displayPath(resolve(session.directory,'explore.json'))}`);
  if(session.choices.length)lines.push(`Continue explicitly: telescope get ${shellWord(displayPath(session.directory))} --pick N`);
  if(answer.outcome.coverage==='incomplete'){
    const blocked=answer.issues.some(issue=>issue.code==='provider-unavailable'||issue.code==='provider-overflow'||issue.code==='source-unavailable');
    lines.push(blocked?'Resolve the provider or source errors above, or narrow the search; then start a new exploration.':'Inspect unresolved metadata or adjust the filters; then start a new exploration.');
    if(answer.issues.some(issue=>issue.code==='provider-overflow'))
      lines.push('A same-filter retry cannot extend a bounded sample. Narrow with --instrument NAME or --from ISO --to ISO and save in a new directory.');
    else lines.push(`Retry in a new directory: ${['telescope','explore',...session.arguments,'--out','NEW_DIRECTORY'].map(shellWord).join(' ')}`);
  }else if(answer.outcome.coverage==='target-unresolved')lines.push('Check the target name or use a suggestion above, then start a new exploration.');
  return `${lines.join('\n')}\n`;
}

export interface ArtifactInspection {
  readonly artifact:string;readonly target?:string;readonly source:string;readonly productReceipt?:string;readonly sourceContext?:DeliveryContext;
  readonly outputs:readonly OutputChoice[];readonly terminal?:boolean;readonly profiles?:readonly {readonly handlerId:string;readonly profileId:string}[];readonly issues?:readonly string[];readonly familyOperations?:readonly FamilyOperation[];readonly relevance?:SourceRelevance;readonly software?:readonly ProductSoftware[];readonly sourceProcessing?:readonly SourceProcessingSoftware[];
}
export interface InspectedArtifact {
  readonly artifact:string;readonly target?:unknown;readonly source:unknown;readonly productReceipt?:string;readonly sourceContext?:DeliveryContext;
  readonly outputs:readonly OutputChoice[];readonly terminal?:boolean;readonly profiles?:readonly {readonly handlerId:string;readonly profileId:string}[];readonly issues?:readonly string[];readonly familyOperations?:readonly FamilyOperation[];readonly relevance?:SourceRelevance;readonly software?:readonly ProductSoftware[];readonly sourceProcessing?:readonly SourceProcessingSoftware[];
}
export const artifactScreen=(result:InspectedArtifact,path:string):ArtifactInspection=>({artifact:result.artifact,...(result.productReceipt||/\.product\.json$/u.test(path)?{productReceipt:resolve(result.productReceipt??path)}:{}),...(typeof result.target==='string'?{target:result.target}:{}),source:resolve(requireString(result.source,'artifact source')),...(result.sourceContext?{sourceContext:result.sourceContext}:{}),outputs:result.outputs,...(result.terminal?{terminal:true}:{}),...(result.profiles?{profiles:result.profiles}:{}),...(result.issues?{issues:result.issues}:{}),...(result.familyOperations?{familyOperations:result.familyOperations}:{}),...(result.relevance?{relevance:result.relevance}:{}),...(result.software?{software:result.software}:{}),...(result.sourceProcessing?{sourceProcessing:result.sourceProcessing}:{})});
export function contextText(context:DeliveryContext|undefined):string|undefined {
  if(!context)return undefined;
  return context.kind==='exploration'?'No scientific acceptance criteria requested.':`Scientific request: ${context.assessment.status}.`;
}
export function outputCommand(source:string,choice:OutputChoice):string {
  const args=['telescope','export',source,'--output',choice.kind];
  if(choice.hdu!==undefined)args.push('--hdu',String(choice.hdu));
  if(choice.structure)args.push('--structure',choice.structure);
  for(const parameter of choice.parameters??[]){
    const placeholder={plane:'N',pixel:'X,Y',band:'LO,HI',aperture:'X0,Y0,X1,Y1',background:'none|X0,Y0,X1,Y1',continuum:'L0,L1,R0,R1',uncertainty:'omit|independent',geometry:'FILE'}[parameter];
    args.push(`--${parameter}`,placeholder??parameter.toUpperCase());
  }
  args.push('--out','DIRECTORY');
  return args.map(shellWord).join(' ');
}
export function formatArtifact(result:ArtifactInspection,verbose=false):string {
  const lines=[`${result.target??'Artifact'} · ${result.artifact}`,`Source: ${displayPath(result.source)}`];
  const context=contextText(result.sourceContext);if(context)lines.push(context);
  if(result.relevance){
    const relevance=result.relevance;
    lines.push('',`Source relevance for ${relevance.target}:`,
      `Archive name: ${relevance.archiveTarget.status}${relevance.archiveTarget.name?` (${relevance.archiveTarget.name})`:''}. ${relevance.archiveTarget.reason}`,
      `Recorded field: ${relevance.field.status}${relevance.field.basis?` (${relevance.field.basis})`:''}. ${relevance.field.reason}`,
      `Detection: ${relevance.detection.status}. ${relevance.detection.reason}`);
    for(const [label,item] of [['Kind',relevance.fit.kind],['Wavelength',relevance.fit.wavelength],['Family',relevance.fit.family]] as const)
      if(item.status!=='not-requested')lines.push(`${label}: ${item.status}. ${item.reason}`);
    for(const item of relevance.contents){
      const facts=[item.structure,item.shape?`shape ${item.shape.join('×')}`:undefined,item.usableSamples===undefined?undefined:`${item.usableSamples} usable samples`,item.unit?`unit ${item.unit}`:undefined,item.mask?`mask ${item.mask}`:undefined,item.uncertainty?`uncertainty ${item.uncertainty}`:undefined].filter(Boolean);
      lines.push(`Native content: ${facts.join(' · ')}`);
      if(item.calibration.length)lines.push(`   Recorded calibration fields: ${verbose?item.calibration.join('; '):item.calibration.slice(0,3).join('; ')}${!verbose&&item.calibration.length>3?` (+${item.calibration.length-3} more with --verbose)`:''}`);
      if(item.field)lines.push(`   Field: ${item.field.status}. ${item.field.reason}`);
    }
    lines.push(`Next: ${relevance.next}`);
  }
  if(result.software?.length)lines.push('',`Recorded software for this run: ${result.software.map(item=>`${item.name} ${item.version}`).join('; ')}`);
  if(result.sourceProcessing?.length){lines.push('Source-declared earlier processing:');for(const item of result.sourceProcessing)lines.push(`  ${item.name} ${item.version} · ${item.evidence}`);}
  if(result.productReceipt)lines.push(`Software citations: telescope ascl --product ${shellWord(displayPath(result.productReceipt))}`);
  if(result.profiles?.length)lines.push(`Proposed profiles: ${result.profiles.map(profile=>`${profile.handlerId}/${profile.profileId}`).join(', ')}.`);
  for(const issue of result.issues??[])lines.push(`Limitation: ${issue}`);
  if(result.outputs.length){
    lines.push('','Supported next operations:');
    result.outputs.forEach((choice,index)=>{
      const identity=[choice.kind,choice.hdu===undefined?undefined:`HDU ${choice.hdu}`,choice.structure,choice.shape?`shape ${choice.shape.join('×')}`:undefined].filter(Boolean).join(' · ');
      lines.push(`${index+1}. ${identity}: ${choice.available?'available':'unavailable'}.`,`   ${choice.reason}`);
      if(choice.unit)lines.push(`   Unit: ${choice.unit.value} (${choice.unit.source})`);
      if(choice.spectral?.centersMicrometres.length)lines.push(`   Wavelength coordinates: ${choice.spectral.centersMicrometres[0]}–${choice.spectral.centersMicrometres.at(-1)} µm (${choice.spectral.centersMicrometres.length} samples)`);
      for(const limitation of choice.limitations??[])lines.push(`   Limitation: ${limitation}`);
      if(choice.available)lines.push(`   Next: ${outputCommand(displayPath(result.source),choice)}`);
    });
  }
  if(result.familyOperations?.length){
    lines.push('','Family operations:');
    result.familyOperations.forEach((operation,index)=>{
      const required=operation.parameters.filter(parameter=>parameter.id!=='out'&&parameter.required);
      lines.push(`${result.outputs.length+index+1}. ${operation.id} · ${operation.componentId}: ${operation.available?'available':'unavailable'}.`, `   ${operation.reason}`);
      if(required.length)lines.push(`   Required parameters: ${required.map(parameter=>parameter.description).join(' ')}`);
      if(verbose)lines.push(`   Owner: ${operation.owner.module}#${operation.owner.export}`);
      for(const limitation of operation.limitations)lines.push(`   Limitation: ${limitation}`);
      if(operation.available)lines.push(`   Next: ${['telescope','family-run',displayPath(result.source),operation.id,'--component',operation.componentId,...(required.length?['--params','PARAMS.json']:[]),'--out','DIRECTORY'].map(shellWord).join(' ')}`);
    });
  }
  if(!result.outputs.length&&!result.familyOperations?.length)lines.push('No further supported outputs. This artifact is terminal.');
  return `${lines.join('\n')}\n`;
}
