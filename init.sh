#!/bin/bash
set -e

echo "=== Harness Initialization ==="

echo "=== bun install ==="
bun install

echo "=== bun run typecheck ==="
bun run typecheck

echo "=== bun run lint ==="
bun run lint

echo "=== bun run test ==="
bun run test

# Slice 1+: the build needs Clerk + Neon env vars, provisioned on Vercel.
if [ ! -f .env.local ]; then
  echo "No .env.local: run 'vercel link' then 'vercel env pull .env.local' (needs access to the Vercel project)." >&2
  exit 1
fi

echo "=== bun run build ==="
bun run build

echo "=== Verification Complete ==="
echo ""
echo "Next steps:"
echo "1. Read feature_list.json to see current feature state"
echo "2. Pick ONE unfinished feature to work on"
echo "3. Implement only that feature"
echo "4. Re-run verification before claiming done"
