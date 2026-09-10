import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/selinur/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'selinur',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/selinur/selinur-directional-sun.webp",
      "two": "/scenes/selinur/selinur-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/selinur/selinur-shape-surface@2x.webp"
  ],
  "retained": {
    "lensIds": [
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  },
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/selinur/selinur-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
