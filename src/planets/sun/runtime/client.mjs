import { bindContextualObject } from "../../../../site/packaged-object-runtime.mjs";
import context from "../prepared/world-context.json" with { type: "json" };
import { runtimeDefinition } from "./definition.mjs";

export const mountSunClient = bindContextualObject(runtimeDefinition, context);
