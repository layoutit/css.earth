import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/freia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'freia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/freia/freia-directional-sun.webp",
      "two": "/scenes/freia/freia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/freia/freia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/freia/freia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
