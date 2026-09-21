import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/dysnomia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'dysnomia',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/dysnomia/dysnomia-model-surface@2x.webp','/scenes/dysnomia/dysnomia-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
