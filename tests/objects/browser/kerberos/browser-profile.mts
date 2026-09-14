import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/kerberos/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kerberos',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/kerberos/kerberos-model-surface@2x.webp','/scenes/kerberos/kerberos-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
