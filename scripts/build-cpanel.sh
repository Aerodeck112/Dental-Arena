#!/usr/bin/env bash
# Builds the package to upload on cPanel (Setup Node.js App). See docs/cpanel.md.
# Output: deploy/dental-arena/ and deploy/dental-arena-cpanel.zip
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=deploy/dental-arena
BUILD_DB="$PWD/deploy/build.db"
rm -rf deploy && mkdir -p "$OUT/initial"

# Throw-away secrets for the build only; the server uses its own .env.
export NODE_ENV=production
export DATABASE_URL="file:$BUILD_DB"
export AUTH_SECRET="build-$(openssl rand -hex 32)"
export PII_ENCRYPTION_KEY="$(openssl rand -base64 32)"
export CRON_SECRET="build-$(openssl rand -hex 16)"
export APP_URL="${APP_URL:-https://dentalarena.ro}"
export SEED_DEMO=0

echo "1/4 Baza de date inițială (clinici, medici, servicii și prețuri, fără pacienți demonstrativi)"
npx prisma migrate deploy >/dev/null
npx prisma db seed >/dev/null
cp "$BUILD_DB" "$OUT/initial/dental-arena.db"

echo "2/4 Construcția aplicației (next build)"
npx next build

echo "3/4 Pachetul pentru cPanel"
cp -R .next/standalone/. "$OUT/"
mkdir -p "$OUT/.next"
cp -R .next/static "$OUT/.next/static"
cp -R public "$OUT/public"
cp -R prisma/migrations "$OUT/migrations"
cp scripts/cpanel/app.js scripts/cpanel/migrate.js "$OUT/"
cp .env.example "$OUT/.env.example"
cp docs/cpanel.md "$OUT/CITESTE-MA.md"
# Never ship local data or secrets.
rm -rf "$OUT/.env" "$OUT/prisma" "$OUT/storage" "$OUT/deploy" "$OUT/research" "$OUT/docs"
find "$OUT" -name "*.db" -not -path "$OUT/initial/*" -delete

echo "4/4 Arhiva"
(cd deploy && zip -qr dental-arena-cpanel.zip dental-arena)
rm -f "$BUILD_DB"
du -sh "$OUT" deploy/dental-arena-cpanel.zip
echo "Gata: deploy/dental-arena-cpanel.zip"
