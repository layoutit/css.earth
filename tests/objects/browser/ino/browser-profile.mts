import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/ino/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ino',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/ino/ino-directional-sun.webp",
      "two": "/scenes/ino/ino-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/ino/ino-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/ino/ino-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
