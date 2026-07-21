#!/bin/bash
set -e

echo "=> Verifying builds across all workspace packages..."

echo "-> Building packages/sdk..."
cd packages/sdk
pnpm build
cd ../..

echo "-> Building apps/scheduler..."
cd apps/scheduler
pnpm build
cd ../..

echo "-> Building apps/docs..."
cd apps/docs
pnpm build
cd ../..

echo "=> All builds succeeded!"
