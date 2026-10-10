export * from '@cssearth/nebula-reconstruction/methods/kinematics/molecular-data';
import {readMolecularRecipe as readRecipe} from '@cssearth/nebula-reconstruction/methods/kinematics/molecular-data';
/** A molecular source is cached in its object's scratch: `src/objects/<object>/.local/kinematics/`. */
export function kinematicsCacheOf(cachePath: string): string {
  const match = /^src\/objects\/([a-z0-9][a-z0-9-]*)\/\.local\/kinematics\//.exec(cachePath);
  if (!match || cachePath.split('/').includes('..')) throw new TypeError(`A kinematics cache path lies in an object's .local/kinematics: ${cachePath}`);
  return `src/objects/${match[1]}/.local/kinematics`;
}
export function readMolecularRecipe(value: unknown) {return readRecipe(value,path=>/^src\/objects\/[a-z0-9-]+\/\.local\/kinematics\//.test(path));}
