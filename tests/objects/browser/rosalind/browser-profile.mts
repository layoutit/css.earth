import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/rosalind/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'rosalind',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/rosalind/rosalind-model-surface@2x.webp','/scenes/rosalind/rosalind-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
