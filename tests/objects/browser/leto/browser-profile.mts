import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/leto/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'leto',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/leto/leto-directional-sun.webp",
      "two": "/scenes/leto/leto-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/leto/leto-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/leto/leto-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
