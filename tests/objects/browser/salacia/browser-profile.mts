import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/salacia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'salacia',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/salacia/salacia-model-surface@2x.webp','/scenes/salacia/salacia-lighting.webp','/scenes/salacia/salacia-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
