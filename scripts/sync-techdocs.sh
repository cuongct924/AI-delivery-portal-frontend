#!/bin/bash

# Sync the platform docs from the sibling backend repo into
# catalog-entities/techdocs/ so TechDocs can build them.
#
# Why a copy: TechDocs' `dir:` ref resolves relative to the entity's own
# Location folder (catalog-entities/) and rejects paths that escape it
# (resolveSafeChildPath -> "Relative path is not allowed to refer to a
# directory outside its parent"). The docs live in ../AI-delivery-portal-backend,
# so they are staged here instead of referenced across the repo boundary.
#
# The staged copy is committed, so production (where the sibling isn't checked
# out) still builds. Re-run this after editing docs in the backend repo; it also
# runs automatically before `yarn start`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${TECHDOCS_SOURCE:-$REPO_ROOT/../AI-delivery-portal-backend}"
DEST="$REPO_ROOT/catalog-entities/techdocs"

if [ ! -f "$SRC/mkdocs.yml" ]; then
  echo "sync-techdocs: no mkdocs.yml at $SRC — keeping existing staged copy"
  exit 0
fi

mkdir -p "$DEST"
cp "$SRC/mkdocs.yml" "$DEST/mkdocs.yml"
rm -rf "$DEST/docs"
cp -R "$SRC/docs" "$DEST/docs"

echo "sync-techdocs: staged $SRC -> $DEST"
