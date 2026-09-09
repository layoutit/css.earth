import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/kriemhild/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'kriemhild',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/kriemhild/kriemhild-directional-sun.webp",
      "two": "/scenes/kriemhild/kriemhild-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/kriemhild/kriemhild-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/kriemhild/kriemhild-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
