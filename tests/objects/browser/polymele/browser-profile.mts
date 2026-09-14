import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/polymele/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'polymele',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/polymele/polymele-model-surface@2x.webp','/scenes/polymele/polymele-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
