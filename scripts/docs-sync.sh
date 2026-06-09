#!/bin/bash
# Local docs-sync runner — invoked by the launchd agent every 8h (and runnable
# by hand). Pulls any new memQL release bundle into src/content/docs/<ver>/.
#
# It only touches the working tree: new content lands UNCOMMITTED. Nothing goes
# live until you review it on localhost and push to main yourself — that push is
# the green flag (your existing deploy-cloud-run workflow ships main).
#
# launchd runs with a bare environment (no nvm, minimal PATH), so resolve the
# newest installed nvm node and add it to PATH. Adjust if you stop using nvm.
set -euo pipefail

REPO="/Users/jmendivil/MemQL Website"
NVM_NODE_DIR="$HOME/.nvm/versions/node"

if [ -d "$NVM_NODE_DIR" ]; then
  LATEST_NODE="$(ls "$NVM_NODE_DIR" | sort -V | tail -1)"
  export PATH="$NVM_NODE_DIR/$LATEST_NODE/bin:$PATH"
fi

cd "$REPO"
echo "=== docs-sync $(date '+%Y-%m-%d %H:%M:%S %z') ==="
node scripts/fetch-docs-bundle.mjs
echo "--- working-tree changes under src/content/docs (review on localhost, then push to go live):"
git status --short src/content/docs || true
echo
