import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/ixion/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ixion',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/ixion/ixion-model-surface@2x.webp','/scenes/ixion/ixion-lighting.webp','/scenes/ixion/ixion-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
