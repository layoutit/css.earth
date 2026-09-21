import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/margaret/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'margaret',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/margaret/margaret-model-surface@2x.webp','/scenes/margaret/margaret-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
