import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/portia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'portia',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/portia/portia-model-surface@2x.webp','/scenes/portia/portia-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
