#!/bin/zsh
set -e
export PATH=/Users/ekrof/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
for id in moon phobos deimos dimorphos io europa ganymede enceladus tethys dione rhea titan charon; do
  node tools/objects/dist/operations.js acquire "$id" --verify-only
  node --test --test-concurrency=1 tests/objects/unit/"$id"/*.test.mjs
done
