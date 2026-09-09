import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import objectControls from '../../../../src/planets/nix/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nix',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/nix/nix-directional-sun.webp',two:'/scenes/nix/nix-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/nix/nix-model-surface@2x.webp','/scenes/nix/nix-lighting.webp'],
  retained:{lensIds:objectControls.lenses.controls.map(lens=>lens.id),speedClicks:5,allowedMountSelectors:[]},
}});
