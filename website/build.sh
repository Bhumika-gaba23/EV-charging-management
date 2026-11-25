#!/bin/sh
# Vercel build: copy the latest release APK into /download/ and record which release it is,
# so /api/refresh can tell when a newer release needs a rebuild.
set -eu
REPO=https://github.com/Bhumika-gaba23/EV-charging-management
mkdir -p download
curl -fL --retry 3 -o download/Pluggo.apk "$REPO/releases/latest/download/pluggo-phone-test.apk"
test "$(wc -c < download/Pluggo.apk)" -gt 1000000
curl -fsSL --retry 3 -o /dev/null -w '%{url_effective}' "$REPO/releases/latest" | sed 's#.*/tag/##' > download/version.txt
echo "Serving release $(cat download/version.txt)"
