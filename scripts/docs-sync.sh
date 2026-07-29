#!/bin/bash
# Local docs-sync runner — invoked by the launchd agent daily (and runnable by
# hand). Pulls any NEW engine release's docs into src/content/docs/<ver>/ by
# building the engine's own docs bundle from the release tag (falling back from
# the release asset when the pipeline hasn't attached one).
#
# It only touches the working tree: new content lands UNCOMMITTED, and a macOS
# notification tells you it's ready. Nothing goes live until you review it on
# localhost and push to main yourself — that push is the green flag.
#
# launchd runs with a bare environment, so we assemble an explicit PATH covering
# the toolchain the build needs (git, gh, go, python3, node, tar).
set -uo pipefail

REPO="/Users/jmendivil/MemQL Website"

# Toolchain PATH (resolved locations on this machine): go, gh, system tools…
export PATH="/usr/local/go/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
# …plus the newest nvm node.
NVM_NODE_DIR="$HOME/.nvm/versions/node"
if [ -d "$NVM_NODE_DIR" ]; then
  LATEST_NODE="$(ls "$NVM_NODE_DIR" | sort -V | tail -1)"
  export PATH="$NVM_NODE_DIR/$LATEST_NODE/bin:$PATH"
fi

notify() { # title, message
  /usr/bin/osascript -e "display notification \"$2\" with title \"$1\"" >/dev/null 2>&1 || true
}

cd "$REPO" || exit 0
echo "=== docs-sync $(date '+%Y-%m-%d %H:%M:%S %z') ==="

OUT="$(node scripts/docs-autosync.mjs 2>&1)"
echo "$OUT"

ADDED="$(printf '%s\n' "$OUT" | sed -n 's/^AUTOSYNC_RESULT added=\([^ ]*\).*/\1/p')"
FAILED="$(printf '%s\n' "$OUT" | sed -n 's/^AUTOSYNC_RESULT .*failed=\([^ ]*\).*/\1/p')"

if [ -n "${ADDED:-}" ]; then
  notify "memQL docs — new version(s) staged" "$ADDED — review on localhost:3000, then push to publish."
fi
if [ -n "${FAILED:-}" ]; then
  notify "memQL docs — build failed" "$FAILED — see ~/Library/Logs/memql-docs-autosync.log"
fi

echo "--- working-tree changes under src/content/docs (review on localhost, then push to go live):"
git status --short src/content/docs || true
echo
