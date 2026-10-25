/** Compare columns over the full published OGLE aperture, including overlapping boxes. */
import type {Cell,cellSampler} from './ogle.mts';
export interface DustPixel {ra:number;dec:number;av:number;area:number;}
export function regionalColumns(pixels:Iterable<DustPixel>,sample:ReturnType<typeof cellSampler>){const groups=new Map<number,{cell:Cell;sum:number;area:number;count:number}>();let matched=0;for(const p of pixels){const cells=sample.containing(p.ra,p.dec);if(cells.length)matched++;for(const cell of cells){const g=groups.get(cell.id)??{cell,sum:0,area:0,count:0};g.sum+=p.av*p.area;g.area+=p.area;g.count++;groups.set(cell.id,g);}}return{groups,matched};}
