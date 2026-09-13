import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/ophelia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ophelia',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/ophelia/ophelia-directional-sun.webp',two:'/scenes/ophelia/ophelia-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/ophelia/ophelia-model-surface@2x.webp','/scenes/ophelia/ophelia-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
