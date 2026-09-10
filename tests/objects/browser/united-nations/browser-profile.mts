import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/united-nations/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'united-nations',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/united-nations/united-nations-directional-sun.webp",
      "two": "/scenes/united-nations/united-nations-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/united-nations/united-nations-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/united-nations/united-nations-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
