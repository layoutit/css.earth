import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/ophelia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ophelia',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/ophelia/ophelia-model-surface@2x.webp','/scenes/ophelia/ophelia-lighting.webp','/scenes/ophelia/ophelia-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
