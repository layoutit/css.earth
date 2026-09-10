import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/nemesis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'nemesis',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/nemesis/nemesis-directional-sun.webp",
      "two": "/scenes/nemesis/nemesis-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/nemesis/nemesis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/nemesis/nemesis-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
