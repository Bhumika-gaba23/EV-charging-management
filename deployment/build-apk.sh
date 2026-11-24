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
# The whole frontend is copied: a hand-kept file list went stale whenever a new script or
# stylesheet was added, which broke the offline preview.
python3 - "$repo_root/frontend" "$deploy_root/android/app/src/main/assets" <<'PY'
import shutil,sys
from pathlib import Path
source,target=map(Path,sys.argv[1:])
shutil.rmtree(target,ignore_errors=True)
# The paper-* vehicle art belongs to the operator dashboard only (about 20 MB).
shutil.copytree(source,target,ignore=shutil.ignore_patterns('README.md','*.map','paper-*'))
PY
cd "$deploy_root/android"
./gradlew --no-daemon assembleRelease
cp app/build/outputs/apk/release/app-release.apk "$deploy_root/apk/pluggo-phone-test.apk"
cd "$deploy_root/apk"
shasum -a 256 pluggo-phone-test.apk > pluggo-phone-test.apk.sha256
printf 'APK: %s/apk/pluggo-phone-test.apk\n' "$deploy_root"
