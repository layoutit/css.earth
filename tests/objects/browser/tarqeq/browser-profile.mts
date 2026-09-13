import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/tarqeq/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'tarqeq',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/tarqeq/tarqeq-model-surface@2x.webp','/scenes/tarqeq/tarqeq-lighting.webp','/scenes/tarqeq/tarqeq-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
