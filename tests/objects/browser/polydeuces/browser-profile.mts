import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/polydeuces/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'polydeuces',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/polydeuces/polydeuces-model-surface@2x.webp','/scenes/polydeuces/polydeuces-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
