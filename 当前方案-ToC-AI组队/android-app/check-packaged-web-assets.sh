#!/bin/sh
set -eu

cd "$(dirname "$0")"

apk_path="app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$apk_path" ]; then
  echo "Missing APK: $apk_path" >&2
  exit 1
fi

archive_listing="$(mktemp)"
trap 'rm -f "$archive_listing"' EXIT
unzip -Z1 "$apk_path" > "$archive_listing"

for required_asset in \
  assets/www/index.html \
  assets/www/app.js \
  assets/www/api-client.js \
  assets/www/assets/ui-icons.mjs \
  assets/www/shells/index.js \
  assets/www/shells/mobile-shell.js \
  assets/www/shells/desktop-shell.js
do
  if ! grep -Fqx "$required_asset" "$archive_listing"; then
    echo "Missing packaged web asset: $required_asset" >&2
    exit 1
  fi
done

echo "Packaged web assets verified."
