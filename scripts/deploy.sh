#!/usr/bin/env bash
# Deploys the committed code to Cloudflare Workers: npm run deploy
#
# It builds from a clean checkout of HEAD in a temporary folder. The build
# copies any .env files it finds into the Worker, and .env.local holds the
# database URL and the Gemini key, so building here would put those secrets in
# the uploaded code. On Cloudflare they are encrypted secrets instead
# (npx wrangler secret put DATABASE_URL / GEMINI_API_KEY).
# Commit first: uncommitted changes are not deployed.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
build_dir="$(mktemp -d)"
cleanup() { git -C "$root" worktree remove --force "$build_dir" 2>/dev/null || rm -rf "$build_dir"; }
trap cleanup EXIT

if [[ -n "$(git -C "$root" status --porcelain)" ]]; then
  echo "Note: you have uncommitted changes. Only what is committed gets deployed."
fi

git -C "$root" worktree add --detach "$build_dir" HEAD
cd "$build_dir"
npm ci --no-audit --no-fund
npx opennextjs-cloudflare build
npx opennextjs-cloudflare deploy
