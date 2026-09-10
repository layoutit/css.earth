import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/bavaria/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bavaria',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/bavaria/bavaria-directional-sun.webp",
      "two": "/scenes/bavaria/bavaria-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/bavaria/bavaria-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/bavaria/bavaria-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
