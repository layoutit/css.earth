import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/adrastea/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'adrastea',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/adrastea/adrastea-model-surface@2x.webp','/scenes/adrastea/adrastea-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
