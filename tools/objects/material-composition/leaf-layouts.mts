import { sha256 } from '../../../src/platform/sha256.mts';
import type {LayeredPresentationRecipe} from './presentation-recipe.mts';

function declarations(stylesheet: string, selector: string): Record<string,string> {
  const matches=[...stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(match=>match[1].trim().split(/\s*,\s*/).includes(selector));
  if(!matches.length)throw new TypeError(`Checked layout selector must exist: ${selector}`);
  return Object.assign({},...matches.map(match=>Object.fromEntries(match[2].split(';').filter(value=>value.includes(':'))
    .map(value=>{const colon=value.indexOf(':');return[value.slice(0,colon).trim(),value.slice(colon+1).trim()];}))));
}

/** Complete projective leaf layout from the actual scoped renderer stylesheet. */
export function prepareLayeredLeafLayouts({scene,stylesheet,config}: {scene: {interior: {shells: readonly {className:string}[]}}; stylesheet: string; config: Pick<LayeredPresentationRecipe,'namespace'|'stylesheet'>}) {
  const pixelLength=/^\d+(?:\.\d+)?px$/;
  const common=declarations(stylesheet,config.stylesheet.scope+'.polycss-scene s');
  const width=common.width?.match(/^var\(--polycss-atlas-width,\s*([^)]*)\)$/)?.[1];
  const height=common.height?.match(/^var\(--polycss-atlas-height,\s*([^)]*)\)$/)?.[1];
  if(!width||!height||!pixelLength.test(width)||!pixelLength.test(height))throw new Error('Prepared leaf defaults must be explicit positive pixel lengths.');
  const classes: Record<string,{width:string;height:string;backgroundSize:string}>={};
  for(const shell of scene.interior.shells) {
    const selector=`.${shell.className} > s:not(.${config.namespace}-interior-pole)`;
    const material=declarations(stylesheet,config.stylesheet.scope+selector);
    if(!material['background-size']?.split(/\s+/).every(value=>pixelLength.test(value)))throw new Error('Prepared shell background layout must use pixel lengths.');
    classes[shell.className]={width,height,backgroundSize:material['background-size']};
  }
  return {schema:'cssearth-prepared-leaf-layouts@1',sources:{[config.stylesheet.path]:sha256},classes};
}
