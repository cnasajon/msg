#!/usr/bin/env bash
# Sobe o serviço `web` apontado para o banco de teste e roda os testes de
# isolamento nas rotas HTTP. Não deixa servidor pendurado: mata o que subiu.
#
#   TEST_DATABASE_URL=postgresql://… ./scripts/testes-http.sh
set -euo pipefail

cd "$(dirname "$0")/.."

: "${TEST_DATABASE_URL:?defina TEST_DATABASE_URL apontando para um banco de testes}"

PORTA=$(node -e 'const s=require("node:net").createServer();s.listen(0,()=>{console.log(s.address().port);s.close()})')

export DATABASE_URL="$TEST_DATABASE_URL"
export APP_URL="http://localhost:$PORTA"
export SESSION_SECRET="${SESSION_SECRET:-segredo-de-teste-apenas}"
export ENCRYPTION_KEY="${ENCRYPTION_KEY:-AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=}"
export TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-000000:token-de-teste}"
export NODE_ENV=production TZ=UTC
export MSG_BASE_URL="http://localhost:$PORTA"

npx prisma migrate deploy > /dev/null
npm run build > /dev/null

npx next start -p "$PORTA" > /tmp/msg-web-teste.log 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null || true' EXIT

for _ in $(seq 1 40); do
  curl -sf "$MSG_BASE_URL/health" > /dev/null && break
  sleep 1
done

npx vitest run tests/rotas-http.test.ts
