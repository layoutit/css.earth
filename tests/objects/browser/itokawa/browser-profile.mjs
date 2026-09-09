import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/itokawa/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'itokawa',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/itokawa/itokawa-directional-sun.webp",
      "two": "/scenes/itokawa/itokawa-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/itokawa/itokawa-amica-surface@2x.webp"
  ],
  "retained": {
    "lensIds": [
      "amica",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  }
}});
