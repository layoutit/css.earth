import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/varda/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'varda',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/varda/varda-model-surface@2x.webp','/scenes/varda/varda-lighting.webp','/scenes/varda/varda-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
