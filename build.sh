#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="${ROOT_DIR}/ios"
BUILD_DIR="${ROOT_DIR}/build"
IPA_PATH="${BUILD_DIR}/NXHorizon-unsigned.ipa"
BUILD_ID="$(date +%Y%m%d-%H%M%S)-$$"
ARCHIVE_PATH="${BUILD_DIR}/ios/NXHorizon-${BUILD_ID}.xcarchive"

export APP_ENV=production

for tool in pnpm xcodebuild pod ditto zip unzip; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "Error: required command '${tool}' was not found." >&2
    exit 1
  fi
done

echo "====================================="
echo " NX Horizon iOS Release (unsigned)"
echo "====================================="

cd "${ROOT_DIR}"

echo ""
echo "[1/5] Installing locked dependencies..."
pnpm install --frozen-lockfile

echo ""
echo "[2/5] Synchronizing app.json version and generating the iOS project..."
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  if (pkg.version && app.expo && app.expo.version !== pkg.version) {
    app.expo.version = pkg.version;
    fs.writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
    console.log('Synchronized app.json version to ' + pkg.version);
  }
"
pnpm exec expo prebuild --platform ios --clean --no-install

echo ""
echo "[3/5] Installing CocoaPods..."
(
  cd "${IOS_DIR}"
  pod install
)

WORKSPACE_PATH="$(find "${IOS_DIR}" -maxdepth 1 -type d -name '*.xcworkspace' -print -quit)"
if [[ -z "${WORKSPACE_PATH}" ]]; then
  echo "Error: Expo did not generate an Xcode workspace in ${IOS_DIR}." >&2
  exit 1
fi

SCHEME_NAME="$(basename "${WORKSPACE_PATH}" .xcworkspace)"
APP_NAME="NXHorizon"
mkdir -p "${BUILD_DIR}/ios"

echo ""
echo "[4/5] Archiving ${SCHEME_NAME} in Release configuration without code signing..."
xcodebuild archive \
  -workspace "${WORKSPACE_PATH}" \
  -scheme "${SCHEME_NAME}" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -archivePath "${ARCHIVE_PATH}" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY=""

APP_PATH="${ARCHIVE_PATH}/Products/Applications/${APP_NAME}.app"
if [[ ! -d "${APP_PATH}" ]]; then
  echo "Error: archived app was not found at ${APP_PATH}." >&2
  exit 1
fi

if [[ -d "${APP_PATH}/_CodeSignature" || -f "${APP_PATH}/embedded.mobileprovision" ]]; then
  echo "Error: the archived app contains signing data; refusing to label it unsigned." >&2
  exit 1
fi

echo ""
echo "[5/5] Packaging the unsigned IPA..."
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/nxhorizon-ipa.XXXXXX")"
trap 'rm -rf "${TEMP_DIR}"' EXIT
mkdir -p "${TEMP_DIR}/Payload"
ditto "${APP_PATH}" "${TEMP_DIR}/Payload/${APP_NAME}.app"
(
  cd "${TEMP_DIR}"
  zip -qry "${TEMP_DIR}/NXHorizon-unsigned.ipa" Payload
)

if unzip -Z1 "${TEMP_DIR}/NXHorizon-unsigned.ipa" | grep -Eq '(^__MACOSX/|(^|/)\._)'; then
  echo "Error: IPA contains macOS metadata files." >&2
  exit 1
fi

if unzip -Z1 "${TEMP_DIR}/NXHorizon-unsigned.ipa" |
  grep -Eq '(^|/)_CodeSignature/|(^|/)embedded\.mobileprovision$'; then
  echo "Error: IPA contains code-signing data; refusing to label it unsigned." >&2
  exit 1
fi

mv -f "${TEMP_DIR}/NXHorizon-unsigned.ipa" "${IPA_PATH}"

echo ""
echo "====================================="
echo " BUILD COMPLETED"
echo "====================================="
echo "Unsigned Release IPA:"
echo "${IPA_PATH}"
echo ""
echo "Sign it with SideStore or another sideloading tool before installation."
