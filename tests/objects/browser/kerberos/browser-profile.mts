import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/kerberos/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kerberos',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/kerberos/kerberos-model-surface@2x.webp','/scenes/kerberos/kerberos-lighting.webp','/scenes/kerberos/kerberos-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
