import { nativeInputStylesheet } from "../native-input.mts";

/** The stylesheet a page without script links for drag and wheel (`site/native-input.mts`). */
export function GET() {
  return new Response(nativeInputStylesheet, { headers: { "Content-Type": "text/css; charset=utf-8" } });
}
