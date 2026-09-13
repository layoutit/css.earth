import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/bienor/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bienor',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/bienor/bienor-model-surface@2x.webp','/scenes/bienor/bienor-lighting.webp','/scenes/bienor/bienor-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
