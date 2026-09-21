import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/sinope/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sinope',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/sinope/sinope-model-surface@2x.webp','/scenes/sinope/sinope-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
