#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${SCRIPT_DIR:h:h}"
ARTIFACT_ROOT="$REPO_ROOT/.artifacts/macos"
APP_PATH="$ARTIFACT_ROOT/DeepSeek Harness.app"
CONTENTS_PATH="$APP_PATH/Contents"
MACOS_PATH="$CONTENTS_PATH/MacOS"
RESOURCES_PATH="$CONTENTS_PATH/Resources"
RUNTIME_PATH="$RESOURCES_PATH/runtime"
DMG_PATH="$ARTIFACT_ROOT/DeepSeek-Harness-macOS-arm64.dmg"
BUILD_MODE="${1:-app}"

if [[ "$BUILD_MODE" != "app" && "$BUILD_MODE" != "dmg" ]]; then
  print -u2 "usage: apps/macos/build.sh [app|dmg]"
  exit 2
fi
if [[ "$REPO_ROOT" == "/" || ! -f "$REPO_ROOT/pnpm-workspace.yaml" ]]; then
  print -u2 "refusing to build outside the DeepSeek Harness repository"
  exit 2
fi

NODE_SOURCE="${DSH_NODE_BINARY:-}"
if [[ -z "$NODE_SOURCE" ]]; then
  NODE_SOURCE="$(node -p 'process.execPath')"
fi
if [[ ! -x "$NODE_SOURCE" ]]; then
  print -u2 "DSH_NODE_BINARY does not name an executable Node.js binary: $NODE_SOURCE"
  exit 2
fi
if [[ "$(uname -m)" != "arm64" || "$(file -b "$NODE_SOURCE")" != *"arm64"* ]]; then
  print -u2 "the first desktop release requires an Apple Silicon host and arm64 Node.js"
  exit 2
fi

HARNESS_VERSION="$(node -p "require('$REPO_ROOT/apps/cli/package.json').version")"
DESKTOP_CLIENT_BRAND_NAME="DeepSeek Harness"
DESKTOP_CLIENT_TITLE="$DESKTOP_CLIENT_BRAND_NAME $HARNESS_VERSION"
DEFAULT_APP_VERSION="${HARNESS_VERSION%%-*}"
APP_VERSION="${DSH_APP_VERSION:-$DEFAULT_APP_VERSION}"
APP_BUILD_NUMBER="${DSH_APP_BUILD_NUMBER:-1}"
SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:--}"

rm -rf "$ARTIFACT_ROOT"
mkdir -p "$MACOS_PATH" "$RUNTIME_PATH/node/bin" "$RUNTIME_PATH/app"

if [[ "${DSH_SKIP_WEB_BUILD:-0}" != "1" ]]; then
  DSH_CLIENT_BRAND_NAME="$DESKTOP_CLIENT_BRAND_NAME" \
    DSH_CLIENT_TITLE="$DESKTOP_CLIENT_TITLE" \
    DSH_CLIENT_VERSION="$HARNESS_VERSION" \
    pnpm run build
fi
if ! grep -Fq "<title>$DESKTOP_CLIENT_TITLE</title>" "$REPO_ROOT/apps/web/dist/index.html"; then
  print -u2 "the packaged Web client title does not match the Harness version: $DESKTOP_CLIENT_TITLE"
  exit 2
fi
pnpm --ignore-scripts --config.inject-workspace-packages=true \
  --filter @deepseek-ai/dsh-macos-app deploy --prod "$RUNTIME_PATH/app"
while IFS= read -r helper; do
  chmod 755 "$helper"
done < <(find "$RUNTIME_PATH/app" -type f -path '*/node-pty/prebuilds/darwin-arm64/spawn-helper' -print)
cp "$NODE_SOURCE" "$RUNTIME_PATH/node/bin/node"
chmod 755 "$RUNTIME_PATH/node/bin/node"
"$RUNTIME_PATH/node/bin/node" "$SCRIPT_DIR/verify-runtime.mjs" "$RUNTIME_PATH/app"

cp "$SCRIPT_DIR/Info.plist" "$CONTENTS_PATH/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $APP_VERSION" "$CONTENTS_PATH/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $APP_BUILD_NUMBER" "$CONTENTS_PATH/Info.plist"
cp "$REPO_ROOT/LICENSE" "$RESOURCES_PATH/LICENSE"
cp "$REPO_ROOT/THIRD_PARTY_NOTICES.md" "$RESOURCES_PATH/THIRD_PARTY_NOTICES.md"
cp "$SCRIPT_DIR/licenses/NODE_LICENSE" "$RESOURCES_PATH/NODE_LICENSE"

MODULE_CACHE="$ARTIFACT_ROOT/ModuleCache"
mkdir -p "$MODULE_CACHE"
export CLANG_MODULE_CACHE_PATH="$MODULE_CACHE"
export SWIFT_MODULE_CACHE_PATH="$MODULE_CACHE"
xcrun swiftc -swift-version 5 -O -framework AppKit -framework Security -framework WebKit \
  "$SCRIPT_DIR/Sources/main.swift" -o "$MACOS_PATH/DeepSeekHarness"

xcrun swiftc -swift-version 5 -O -framework AppKit \
  "$SCRIPT_DIR/Sources/IconRasterizer.swift" -o "$ARTIFACT_ROOT/IconRasterizer"
"$ARTIFACT_ROOT/IconRasterizer" "$REPO_ROOT/apps/web/public/favicon.svg" "$ARTIFACT_ROOT/AppIcon-1024.png"
ICONSET="$ARTIFACT_ROOT/AppIcon.iconset"
mkdir -p "$ICONSET"
for size in 16 32 128 256 512; do
  /usr/bin/sips -z "$size" "$size" "$ARTIFACT_ROOT/AppIcon-1024.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  /usr/bin/sips -z "$double" "$double" "$ARTIFACT_ROOT/AppIcon-1024.png" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
/usr/bin/iconutil -c icns "$ICONSET" -o "$RESOURCES_PATH/AppIcon.icns"

sign_one() {
  local target="$1"
  shift
  if [[ "$SIGNING_IDENTITY" == "-" ]]; then
    /usr/bin/codesign --force --sign - "$@" "$target"
  else
    /usr/bin/codesign --force --timestamp --options runtime --sign "$SIGNING_IDENTITY" "$@" "$target"
  fi
}

while IFS= read -r candidate; do
  if file -b "$candidate" | grep -q "Mach-O"; then
    sign_one "$candidate"
  fi
done < <(find "$RUNTIME_PATH/app" -type f -print | sort)
sign_one "$RUNTIME_PATH/node/bin/node" --entitlements "$SCRIPT_DIR/Runtime.entitlements"
sign_one "$APP_PATH"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$APP_PATH"

rm -rf "$MODULE_CACHE" "$ICONSET"
rm -f "$ARTIFACT_ROOT/IconRasterizer" "$ARTIFACT_ROOT/AppIcon-1024.png"

if [[ "$BUILD_MODE" == "dmg" ]]; then
  STAGING_PATH="$ARTIFACT_ROOT/dmg-root"
  mkdir -p "$STAGING_PATH"
  /usr/bin/ditto "$APP_PATH" "$STAGING_PATH/DeepSeek Harness.app"
  ln -s /Applications "$STAGING_PATH/Applications"
  /usr/bin/hdiutil create -volname "DeepSeek Harness" -srcfolder "$STAGING_PATH" -ov -format UDZO "$DMG_PATH"
  rm -rf "$STAGING_PATH"
  if [[ "$SIGNING_IDENTITY" != "-" ]]; then
    sign_one "$DMG_PATH"
    /usr/sbin/spctl --assess --type open --context context:primary-signature --verbose=2 "$DMG_PATH"
  fi
  if [[ -n "${APPLE_NOTARY_PROFILE:-}" ]]; then
    xcrun notarytool submit "$DMG_PATH" --keychain-profile "$APPLE_NOTARY_PROFILE" --wait
    xcrun stapler staple "$DMG_PATH"
    xcrun stapler validate "$DMG_PATH"
  fi
  /usr/bin/hdiutil verify "$DMG_PATH"
  /usr/bin/shasum -a 256 "$DMG_PATH" > "$DMG_PATH.sha256"
  print "$DMG_PATH"
else
  print "$APP_PATH"
fi
