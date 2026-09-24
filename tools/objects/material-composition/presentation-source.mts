import {shape,text,number,optional,array,dictionary} from '@cssearth/core';

/** Fields consumed while binding prepared material rows to retained scene nodes. */
export const parseLayeredLenses = shape({defaultLens:text,controls:array(shape({id:text,materialLens:text,view:optional(text),
  surfaceUrl:optional(text),surface2xUrl:optional(text),polesUrl:optional(text),ringUrl:optional(text),ring2xUrl:optional(text)}))});
export const parseLayeredAtlas = shape({variants:dictionary(shape({runtimeAtlas:shape({assetUrl:text,asset2xUrl:optional(text)}),
  presentations:array(shape({rowIndex:number,frameIndex:number,backgroundPosition:text,backgroundSize:text}))}))});
