import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/cordelia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'cordelia',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/cordelia/cordelia-directional-sun.webp',two:'/scenes/cordelia/cordelia-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/cordelia/cordelia-model-surface@2x.webp','/scenes/cordelia/cordelia-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
