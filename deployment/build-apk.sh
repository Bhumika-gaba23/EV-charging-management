#!/bin/sh
set -eu
deploy_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
repo_root=$(dirname "$deploy_root")
: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
export ANDROID_HOME
if [ -z "${JAVA_HOME:-}" ] && [ -d '/Applications/Android Studio.app/Contents/jbr/Contents/Home' ]; then
    JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home'; export JAVA_HOME
fi
mkdir -p "$deploy_root/android/app/src/main/assets" "$deploy_root/apk"
# Always copy the current UI, rather than maintaining a divergent mobile fork.
python3 - "$repo_root/frontend" "$deploy_root/android/app/src/main/assets" <<'PY'
import shutil,sys
shutil.rmtree(sys.argv[2])
from pathlib import Path
source,target=map(Path,sys.argv[1:])
target.mkdir(parents=True)
for name in ['index.html','chargeflow.css','wallet.css','reference-layout.css','chargeflow.js','customer-api.js','demo-data.js','google-stations.js','vehicle-scene.js','performance-profile.js','cargo-model.js','session-summary.js']:
    shutil.copy2(source/name,target/name)
for name in ['vendor','assets/models','assets/fonts']:
    shutil.copytree(source/name,target/name)
shutil.copy2(source/'assets/pluggo.svg',target/'assets/pluggo.svg')
PY
cd "$deploy_root/android"
./gradlew --no-daemon assembleRelease
cp app/build/outputs/apk/release/app-release.apk "$deploy_root/apk/pluggo-phone-test.apk"
cd "$deploy_root/apk"
shasum -a 256 pluggo-phone-test.apk > pluggo-phone-test.apk.sha256
printf 'APK: %s/apk/pluggo-phone-test.apk\n' "$deploy_root"
