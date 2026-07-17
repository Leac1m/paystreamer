#!/usr/bin/env bash
set -e

echo "======================================================"
echo " 🐳 Ensuring Local Docker Environment is Running..."
echo "======================================================"
docker compose up -d

echo "Waiting for Sui node and GraphQL to be ready..."
sleep 15

echo "======================================================"
echo " 🚀 Deploying Fresh Localnet Instance..."
echo "======================================================"

ACTIVE_ADDRESS=$(docker compose exec -T sui-node sui client active-address | tr -d '\r')
echo "Active address inside container: $ACTIVE_ADDRESS"

echo "Funding active address..."
curl -s --location --request POST 'http://127.0.0.1:9123/gas' \
  --header 'Content-Type: application/json' \
  --data-raw '{"FixedAmountRequest":{"recipient":"'"$ACTIVE_ADDRESS"'"}}' > /dev/null
sleep 3

rm -f move/*/Pub.*.toml

docker compose exec -T -w /workspace/move/stablecoin sui-node sui client test-publish --skip-dependency-verification --with-unpublished-dependencies --build-env testnet --gas-budget 1000000000 --json > move/stablecoin/pusd_output.json
docker compose exec -T -w /workspace/move/subscriptions sui-node sui client test-publish --skip-dependency-verification --with-unpublished-dependencies --build-env testnet --gas-budget 1000000000 --json > move/subscriptions/sub_output.json

export VITE_NETWORK="local"
pnpm dlx tsx scripts/v2/deploy-fresh-local.ts

E2E_PRIVATE_KEY=$(docker compose exec -T sui-node sui keytool export --key-identity "$ACTIVE_ADDRESS" | grep -o "suiprivkey[a-zA-Z0-9]*")
export E2E_PRIVATE_KEY

echo "======================================================"
echo " 🌱 Seeding Demo Platform..."
echo "======================================================"
pnpm seed:demo

echo "======================================================"
echo " 🧪 Running Backend E2E Payment Cycle..."
echo "======================================================"
pnpm dlx tsx scripts/v2/e2e-payment-cycle.ts

echo "======================================================"
echo " ⚛️  Running React SDK E2E Tests..."
echo "======================================================"
cd packages/sdk && pnpm exec vitest run test/react-e2e.test.tsx
