/** Content-sized terminal cells, with no control sequences from archive metadata. */
import { oneLine, archiveCounts } from './cli-summary.mts';
import { archiveLabel } from './cli-archive.mts';
import type { ExplorationSession, Session } from '../session.mts';
import { fieldLabel } from '../exploration.mts';
export function cell(value:string,width:number):string {
  const text=Array.from(oneLine(value));return (text.length>width?`${text.slice(0,width-1).join('')}…`:text.join('')).padEnd(width);
}
export function row(values:readonly string[],widths:readonly number[]):string {return values.map((value,index)=>cell(value,widths[index]!)).join('  ').trimEnd();}
function contentTable(headings:readonly string[],rows:readonly (readonly string[])[]):string[] {
  const size=(text:string)=>Array.from(oneLine(text)).length;
  const minimum=headings.map(size),widths=headings.map((heading,index)=>Math.max(size(heading),...rows.map(values=>size(values[index]!))));
  while(widths.reduce((sum,width)=>sum+width,0)+(widths.length-1)*2>100){
    const candidates=widths.map((width,index)=>({width,index})).filter(({width,index})=>width>minimum[index]!);
    candidates.sort((a,b)=>b.width-a.width);
    if(!candidates.length)break;
    const index=candidates[0]!.index; widths[index]=widths[index]!-1;
  }
  return [row(headings,widths),...rows.map(values=>row(values,widths))];
}
const known=(value:string|null|undefined):string=>!value||oneLine(value).toLowerCase()==='unknown'?'—':value;
function instrumentMode(choice:ExplorationSession['choices'][number]):string {
  if(archiveLabel(choice)==='ALMA') {
    const instrument=known(choice.display.instrument);
    return instrument==='—'||oneLine(instrument).toUpperCase()==='ALMA'?'—':instrument;
  }
  return known(choice.display.instrument||choice.mode);
}
export function wavelengthText(value:readonly (number|null)[]|readonly (readonly [number,number])[]):string {
  if(!value.length||value.every(entry=>entry===null))return '—';
  const ranges=Array.isArray(value[0])?value as readonly (readonly [number,number])[]:[value as readonly [number|null,number|null]];
  const mm=ranges.every(range=>range.every(n=>n!==null&&n>=1000)),scale=mm?1000:1;
  const number=(n:number)=>String(Number((n/scale).toPrecision(3)));
  const text=ranges.map(([lo,hi])=>lo===null||hi===null?'—':lo===hi?number(lo):`${number(lo)}–${number(hi)}`).join(', ');
  return text==='—'?text:`${text} ${mm?'mm':'µm'}`;
}
export function explorationTable(session:ExplorationSession,all=false):string[] {
  const resolution=session.answer.targetResolution,target=resolution.status==='position'?fieldLabel(resolution.region):resolution.status==='resolved'?resolution.requested:session.target,
    identity=resolution.status==='resolved'?resolution.canonical.name:resolution.status;
  const archives=Object.entries(archiveCounts(session,true)).map(([archive,count])=>`${archive} ${count}`).join(', ');
  const lines=[`${oneLine(target??'Field')} · ${session.choices.length} observations${archives?` (${archives})`:''}`,`Resolved: ${oneLine(identity)}`];
  const rows=(all?session.choices:session.choices.slice(0,10)).map(choice=>[String(choice.pick),archiveLabel(choice),
    choice.telescope==='Source archive'?choice.observation:instrumentMode(choice),known(choice.display.observationTime.startIso?.slice(0,10)),known(choice.display.productKind),
    wavelengthText(choice.display.wavelengthsMicrometres),choice.state==='ready'?'ready':'needs check']);
  lines.push('',...contentTable(['#','Archive','Instrument / mode','Date','Kind','Wavelength','State'],rows));
  return lines;
}
export function queryTable(session:Session):string[] {
  return contentTable(['#','Archive','Mode','State'],session.choices.slice(0,10).map(choice=>[String(choice.pick),choice.telescope,choice.mode,choice.state==='ready'?'ready':'needs check']));
}
