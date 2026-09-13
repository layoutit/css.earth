import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/nuwa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nuwa',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/nuwa/nuwa-directional-sun.webp",
      "two": "/scenes/nuwa/nuwa-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/nuwa/nuwa-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/nuwa/nuwa-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
