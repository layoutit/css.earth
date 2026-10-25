/** A material-only experiment may reuse linear photons, never a changed physical field. */
import {need} from '../inputs.mts';import type {Configuration} from '../sequence-state.mts';
export function samePhysicalField(a:Configuration,b:Configuration){const physical=(v:Configuration)=>{const {version,parent,change,details,...rest}=v;return rest;};return JSON.stringify(physical(a))===JSON.stringify(physical(b));}
export function requireMaterialOnly(a:Configuration,b:Configuration){need(a.details.referenceProjectionVersion===b.version&&samePhysicalField(a,b),'Changed physical fields cannot reuse a parent photon projection');}
