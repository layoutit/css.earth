import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/cordelia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'cordelia',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/cordelia/cordelia-directional-sun.webp',two:'/scenes/cordelia/cordelia-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/cordelia/cordelia-model-surface@2x.webp','/scenes/cordelia/cordelia-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
