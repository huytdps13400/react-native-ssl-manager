#!/usr/bin/env bash
#
# Deprecate all v1.x releases of react-native-ssl-manager on the npm registry.
#
# v1.x has a fail-open weakness (Android pins defaulted to expiring one year
# after build, after which pinning silently stopped being enforced). v2 fixes
# this. This marks every v1 release as deprecated so anyone installing an old
# version sees a warning and is pointed at the migration guide.
#
# Deprecation is a "soft block": it does NOT prevent installs, it shows a
# warning on every `npm install`. It is fully reversible (see UNDO below).
#
# Requirements:
#   - You must be logged in to npm as an owner of the package: `npm whoami`
#     should print your username. If not, run `npm login` first.
#
# Usage:
#   ./scripts/deprecate-v1.sh
#
# Undo (un-deprecate) if ever needed:
#   npm deprecate react-native-ssl-manager@"<2.0.0" ""
#
set -euo pipefail

PKG="react-native-ssl-manager"
RANGE="<2.0.0"
MESSAGE="v1.x is no longer supported and has a fail-open weakness (pins could silently stop being enforced). Please upgrade to v2+. See https://github.com/huytdps13400/react-native-ssl-manager/blob/main/MIGRATION.md"

if ! npm whoami >/dev/null 2>&1; then
  echo "Error: not logged in to npm. Run 'npm login' first." >&2
  exit 1
fi

echo "Logged in to npm as: $(npm whoami)"
echo "About to deprecate ${PKG}@\"${RANGE}\""
echo "Message: ${MESSAGE}"
echo
read -r -p "Proceed? [y/N] " reply
case "$reply" in
  [yY][eE][sS] | [yY]) ;;
  *)
    echo "Aborted."
    exit 0
    ;;
esac

npm deprecate "${PKG}@${RANGE}" "${MESSAGE}"
echo "Done. Verify with: npm view ${PKG} versions --json  (deprecated versions show a message)"
