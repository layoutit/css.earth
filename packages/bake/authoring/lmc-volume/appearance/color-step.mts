/** CLI defaults follow the selected retained base, including calls without a parent argument. */
import {need} from '../inputs.mts';
export function colorStep(versionArgument:string|undefined,parentArgument?:string){const version=Number(versionArgument??32),parent=Number(parentArgument??(version===36?32:31));need((version===32||version===36)&&Number.isSafeInteger(parent)&&parent>0&&parent<version,'Invalid young-color version or parent');return{version,parent};}
