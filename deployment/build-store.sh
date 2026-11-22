#!/bin/sh
# Builds the Play Store release of Pluggo (Trusted Web Activity) and the matching
# frontend/.well-known/assetlinks.json, which must be deployed to the website so Android
# trusts the app to open it full-screen.
#
#   PLUGGO_HOST=pluggo-customer-demo.onrender.com VERSION_CODE=1 VERSION_NAME=1.0.0 sh deployment/build-store.sh
#
# Signing uses deployment/android/keystore.properties (or PLUGGO_KEYSTORE_* variables).
# Create the upload key once and keep it safe; losing it means a key reset through Play support:
#   keytool -genkeypair -v -keystore deployment/pluggo-upload.jks -alias upload -keyalg RSA -keysize 4096 -validity 10000
# then write deployment/android/keystore.properties:
#   storeFile=../pluggo-upload.jks
#   storePassword=...
#   keyAlias=upload
#   keyPassword=...
# After the first upload, add Play's app-signing certificate SHA-256 (Play Console → Test and
# release → App integrity) as PLAY_SIGNING_SHA256 and rerun, so both keys are trusted.
set -eu
deploy_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(dirname "$deploy_root")
host=${PLUGGO_HOST:-pluggo-customer-demo.onrender.com}
app_id=${PLUGGO_APPLICATION_ID:-com.pluggo.app}
version_code=${VERSION_CODE:-1}
version_name=${VERSION_NAME:-1.0.0}
props="$deploy_root/android/keystore.properties"

prop() { sed -n "s/^$1=//p" "$props" 2>/dev/null | head -1; }
store_file=${PLUGGO_KEYSTORE_FILE:-$(prop storeFile)}
if [ -z "$store_file" ]; then
  echo "No upload key configured. See the instructions at the top of $0." >&2
  exit 1
fi
case "$store_file" in /*|?:*) ;; *) store_file="$deploy_root/android/$store_file" ;; esac
store_pass=${PLUGGO_KEYSTORE_PASSWORD:-$(prop storePassword)}
alias=${PLUGGO_KEY_ALIAS:-$(prop keyAlias)}; alias=${alias:-upload}

cd "$deploy_root/android"
./gradlew --no-daemon -q :store:bundleRelease :store:assembleRelease \
  -PpluggoHost="$host" -PpluggoApplicationId="$app_id" -PpluggoVersionCode="$version_code" -PpluggoVersionName="$version_name"
mkdir -p "$deploy_root/store"
cp store/build/outputs/bundle/release/store-release.aab "$deploy_root/store/pluggo-$version_name.aab"
cp store/build/outputs/apk/release/store-release.apk "$deploy_root/store/pluggo-$version_name.apk"

upload_sha=$(keytool -list -v -keystore "$store_file" -storepass "$store_pass" -alias "$alias" | sed -n 's/^[[:space:]]*SHA256: //p' | head -1)
[ -n "$upload_sha" ] || { echo "Could not read the upload key fingerprint" >&2; exit 1; }
fingerprints="\"$upload_sha\""
[ -n "${PLAY_SIGNING_SHA256:-}" ] && fingerprints="$fingerprints, \"$PLAY_SIGNING_SHA256\""
mkdir -p "$repo_root/frontend/.well-known"
cat > "$repo_root/frontend/.well-known/assetlinks.json" <<EOF
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {"namespace": "android_app", "package_name": "$app_id", "sha256_cert_fingerprints": [$fingerprints]}
}]
EOF
echo "Play bundle:  $deploy_root/store/pluggo-$version_name.aab  (upload this)"
echo "Test APK:     $deploy_root/store/pluggo-$version_name.apk  (adb install for a quick check)"
echo "Asset links:  frontend/.well-known/assetlinks.json  (commit and deploy before release)"
