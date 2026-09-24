import sys
MUTANTS = {
  'empty ignores features in flight': ("shown.objects > 0 || shown.features !== 0", "shown.objects > 0 || (shown.features !== 0 && shown.features !== 'pending')"),
  'empty ignores not searching': ("!showingSearchResults || shown.objects > 0", "shown.objects > 0"),
  'no pending state for a feature search': ("features: features ? 'pending' : 0 }", "features: 0 }"),
  'feature results never re-present': ("onResults(count) { shown.features = count; presentEmpty(); }", "onResults(count) { shown.features = count; }"),
  'closing keeps the cached query': ("      shown.query = null;\n      markCategory();", "      markCategory();"),
}
name = sys.argv[1]; src = open('output/browser-app/change.mts').read(); a, b = MUTANTS[name]
assert src.count(a) == 1, name
open('site/object-browser.mts', 'w').write(src.replace(a, b))
