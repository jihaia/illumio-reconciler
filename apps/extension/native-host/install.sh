#!/bin/bash
set -euo pipefail

# ─── Aperture Native Host Installer ──────────────────────────
# Sets up the SQLite bridge for the Chrome extension

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_NAME="com.aperture.db"

# ─── Detect Node.js ───────────────────────────────────────────
# Try Volta first, then system PATH
if [ -x "$HOME/.volta/bin/node" ]; then
  NODE_PATH="$HOME/.volta/bin/node"
elif command -v node &>/dev/null; then
  NODE_PATH="$(command -v node)"
else
  echo "ERROR: Node.js not found. Please install Node.js 24+ via Volta or your package manager."
  exit 1
fi

NODE_VERSION=$("$NODE_PATH" --version)
echo "Using Node.js $NODE_VERSION at $NODE_PATH"

# ─── Detect Platform ─────────────────────────────────────────
case "$(uname -s)" in
  Darwin)
    TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    ;;
  Linux)
    TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    ;;
  *)
    echo "ERROR: Unsupported platform: $(uname -s)"
    echo "Only macOS and Linux are supported."
    exit 1
    ;;
esac

echo ""
echo "─── Step 1: Install dependencies ─────────────────────────"
cd "$SCRIPT_DIR"
npm install --production
echo "  Dependencies installed."

echo ""
echo "─── Step 2: Create wrapper script ────────────────────────"
WRAPPER="$SCRIPT_DIR/run-host.sh"
cat > "$WRAPPER" << WRAPPER_EOF
#!/bin/bash
exec "$NODE_PATH" "$SCRIPT_DIR/host.js"
WRAPPER_EOF
chmod +x "$WRAPPER"
chmod +x "$SCRIPT_DIR/host.js"
echo "  Created: $WRAPPER"

echo ""
echo "─── Step 3: Extension ID ─────────────────────────────────"
echo "Open chrome://extensions in Chrome and find the Aperture extension ID."
echo "It looks like: abcdefghijklmnopqrstuvwxyzabcdef"
echo ""
read -rp "Enter your Chrome extension ID: " EXTENSION_ID

if [ -z "$EXTENSION_ID" ]; then
  echo "ERROR: Extension ID is required."
  exit 1
fi

echo ""
echo "─── Step 4: Register native messaging host ───────────────"
mkdir -p "$TARGET_DIR"
MANIFEST_PATH="$TARGET_DIR/$HOST_NAME.json"

cat > "$MANIFEST_PATH" << MANIFEST_EOF
{
  "name": "$HOST_NAME",
  "description": "Aperture SQLite database bridge",
  "path": "$WRAPPER",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
MANIFEST_EOF

echo "  Manifest written to:"
echo "  $MANIFEST_PATH"

echo ""
echo "─── Step 5: Verify ───────────────────────────────────────"

# Verify manifest JSON
"$NODE_PATH" -e "
  const fs = require('fs');
  JSON.parse(fs.readFileSync('$MANIFEST_PATH', 'utf-8'));
  console.log('  Manifest JSON: valid');
"

# Verify host script exists
if [ -f "$SCRIPT_DIR/host.js" ]; then
  echo "  Host script: found"
else
  echo "  Host script: MISSING"
  exit 1
fi

# Verify better-sqlite3 is loadable
"$NODE_PATH" -e "
  try {
    require('$SCRIPT_DIR/node_modules/better-sqlite3');
    console.log('  better-sqlite3: installed');
  } catch(e) {
    console.log('  better-sqlite3: FAILED -', e.message);
    process.exit(1);
  }
"

echo ""
echo "─── Setup complete! ──────────────────────────────────────"
echo ""
echo "  Database path: ~/.aperture/aperture.db"
echo "  Native host:   $WRAPPER"
echo "  Manifest:      $MANIFEST_PATH"
echo ""
echo "  Restart Chrome for changes to take effect."
echo ""
echo "  To test manually:  node $SCRIPT_DIR/test-host.js"
