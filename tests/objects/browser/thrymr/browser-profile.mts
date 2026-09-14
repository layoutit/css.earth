import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/thrymr/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'thrymr',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/thrymr/thrymr-model-surface@2x.webp','/scenes/thrymr/thrymr-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
