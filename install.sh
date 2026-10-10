#!/usr/bin/env bash
# Keep execution at EOF: an incomplete download must not start installation.
mdviewer_install() (
  set -euo pipefail
  umask 022
  fail() { printf 'MD Viewer: %s\n' "$*" >&2; exit 1; }
  [ "$(id -u)" -ne 0 ] || fail 'Run as your normal user, not with sudo.'
  case "$(uname -s)" in
    Darwin) platform=darwin ;;
    Linux) platform=linux ;;
    *) fail 'Supported systems: macOS and Ubuntu/Debian desktop.' ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) arch=arm64 ;;
    x86_64) arch=x64 ;;
    *) fail 'Supported processors: Intel/AMD 64-bit and ARM64.' ;;
  esac
  [ "$#" -eq 0 ] || { [ "$#" -eq 2 ] && [ "$1" = '--local' ] && [ -f "$2/package-lock.json" ]; } || fail 'Usage: bash install.sh [--local /path/to/repo]'
  local_source=''
  if [ "$#" -eq 2 ]; then local_source="$(cd "$2" && pwd)"; fi
  install_root="$HOME/.local/share/md-viewer"
  mkdir -p "$install_root"
  work="$(mktemp -d "$install_root/.install.XXXXXX")"
  trap 'rm -rf "$work"' EXIT
  printf 'Save documents and close MD Viewer before updating.\n'
  if [ "$platform" = linux ]; then
    command -v apt-get >/dev/null || fail 'Automatic Linux installation requires Ubuntu/Debian.'
    [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] || fail 'Run from a Terminal in your desktop session.'
    command -v sudo >/dev/null || fail 'sudo is required to install system libraries.'
    sudo apt-get update
    packages=(curl ca-certificates xdg-utils libglib2.0-bin desktop-file-utils shared-mime-info libnss3 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1)
    for package in libasound2 libgtk-3-0 libatk1.0-0 libatk-bridge2.0-0; do
      if apt-cache show "${package}t64" >/dev/null 2>&1; then
        packages+=("${package}t64")
      else
        packages+=("$package")
      fi
    done
    sudo apt-get install -y "${packages[@]}"
  fi
  command -v curl >/dev/null || fail 'curl is required.'
  node_bin=''
  if command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)' 2>/dev/null && command -v npm >/dev/null; then
    node_bin="$(command -v node)"
  elif [ -x "$install_root/node/bin/node" ] && [ -x "$install_root/node/bin/npm" ]; then
    node_bin="$install_root/node/bin/node"
  else
    printf 'Downloading official Node.js 24 LTS and verifying SHA-256...\n'
    curl --fail --location --silent --show-error --retry 3 https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$work/SHASUMS256.txt"
    archive="$(awk -v suffix="-$platform-$arch.tar.gz" 'substr($2,length($2)-length(suffix)+1)==suffix {print $2}' "$work/SHASUMS256.txt")"
    [[ "$archive" =~ ^node-v24\.[0-9]+\.[0-9]+-(darwin|linux)-(x64|arm64)\.tar\.gz$ ]] || fail 'Invalid Node.js download manifest.'
    curl --fail --location --silent --show-error --retry 3 "https://nodejs.org/dist/latest-v24.x/$archive" -o "$work/$archive"
    expected="$(awk -v file="$archive" '$2==file {print $1}' "$work/SHASUMS256.txt")"
    if [ "$platform" = darwin ]; then
      actual="$(shasum -a 256 "$work/$archive" | awk '{print $1}')"
    else
      actual="$(sha256sum "$work/$archive" | awk '{print $1}')"
    fi
    [ "$actual" = "$expected" ] || fail 'Node.js checksum mismatch; installation stopped.'
    mkdir "$work/node"
    tar -xzf "$work/$archive" --strip-components=1 -C "$work/node"
    [ ! -e "$install_root/node" ] || fail 'Existing managed Node.js is incomplete; move it aside and retry.'
    mv "$work/node" "$install_root/node"
    node_bin="$install_root/node/bin/node"
  fi
  export PATH="$(dirname "$node_bin"):$PATH"
  mkdir "$work/source"
  if [ -n "$local_source" ]; then
    tar -C "$local_source" --exclude=.git --exclude=node_modules --exclude=dist --exclude=.DS_Store -cf "$work/source.tar" .
    tar -xf "$work/source.tar" -C "$work/source"
  else
    printf 'Downloading Markdown Viewer...\n'
    curl --fail --location --silent --show-error --retry 3 https://codeload.github.com/thientranvan/markdown_viewer/tar.gz/refs/heads/main -o "$work/source.tar.gz"
    tar -xzf "$work/source.tar.gz" --strip-components=1 -C "$work/source"
  fi
  cd "$work/source"
  npm ci
  npm audit --audit-level=low
  # Recent Electron versions download their runtime on first require.
  "$node_bin" -e 'console.log("Electron runtime:", require("electron"))'
  npm test
  "$node_bin" scripts/install-app.js
  printf '\nMD Viewer installed successfully. Open it from Applications / your application menu.\n'
)
mdviewer_install "$@"
