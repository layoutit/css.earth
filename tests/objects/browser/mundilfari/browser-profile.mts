import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/mundilfari/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'mundilfari',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/mundilfari/mundilfari-model-surface@2x.webp','/scenes/mundilfari/mundilfari-lighting.webp','/scenes/mundilfari/mundilfari-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
