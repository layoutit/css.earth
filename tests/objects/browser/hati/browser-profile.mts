import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/hati/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hati',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/hati/hati-model-surface@2x.webp','/scenes/hati/hati-lighting.webp','/scenes/hati/hati-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
