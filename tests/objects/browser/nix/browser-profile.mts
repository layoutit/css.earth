import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/nix/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nix',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/nix/nix-model-surface@2x.webp','/scenes/nix/nix-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
