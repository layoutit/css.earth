export * from '@cssearth/nebula-reconstruction/methods/kinematics/molecular-data';
import {readMolecularRecipe as readRecipe} from '@cssearth/nebula-reconstruction/methods/kinematics/molecular-data';
export function readMolecularRecipe(value: unknown) {return readRecipe(value,path=>path.startsWith('.local/nebula-lab/kinematics/'));}
