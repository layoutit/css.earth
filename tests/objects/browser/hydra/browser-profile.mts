import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/hydra/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'hydra',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/hydra/hydra-model-surface@2x.webp','/scenes/hydra/hydra-lighting.webp','/scenes/hydra/hydra-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
