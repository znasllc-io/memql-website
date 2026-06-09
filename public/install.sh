#!/bin/sh
# memQL Cockpit installer.
#
#   curl -fsSL https://memql.io/install.sh | sh
#
# Detects your OS/arch, downloads the matching memql-cockpit binary from the
# latest GitHub release, and installs it to a directory on your PATH. macOS and
# Linux only. No Windows build yet — use WSL2 in the meantime.
#
# Override behavior with environment variables:
#   MEMQL_INSTALL_DIR   target dir (default: /usr/local/bin, else ~/.local/bin)
#   MEMQL_VERSION       a specific tag (default: latest release)
set -eu

REPO="znasllc-io/memql-cockpit"
BIN="memql-cockpit"

err() { printf '%s\n' "memql-install: $*" >&2; exit 1; }
info() { printf '%s\n' "$*" >&2; }

# --- detect platform -------------------------------------------------------
os=$(uname -s)
case "$os" in
  Darwin) os="darwin" ;;
  Linux)  os="linux"  ;;
  *) err "unsupported OS '$os'. macOS and Linux only for now (try WSL2 on Windows)." ;;
esac

arch=$(uname -m)
case "$arch" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64)  arch="amd64" ;;
  *) err "unsupported architecture '$arch'." ;;
esac

asset="${BIN}-${os}-${arch}"

# --- need curl or wget -----------------------------------------------------
if command -v curl >/dev/null 2>&1; then
  dl() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  dl() { wget -qO "$2" "$1"; }
else
  err "need curl or wget installed."
fi

# --- resolve the download URL ---------------------------------------------
if [ "${MEMQL_VERSION:-}" = "" ]; then
  url="https://github.com/${REPO}/releases/latest/download/${asset}"
else
  url="https://github.com/${REPO}/releases/download/${MEMQL_VERSION}/${asset}"
fi

# --- choose an install dir -------------------------------------------------
if [ "${MEMQL_INSTALL_DIR:-}" != "" ]; then
  dir="$MEMQL_INSTALL_DIR"
elif [ -w /usr/local/bin ] 2>/dev/null; then
  dir="/usr/local/bin"
else
  dir="$HOME/.local/bin"
fi
mkdir -p "$dir" || err "cannot create install dir '$dir'."

# --- download + install ----------------------------------------------------
tmp=$(mktemp) || err "cannot create temp file."
trap 'rm -f "$tmp"' EXIT

info "Downloading ${asset}…"
dl "$url" "$tmp" || err "download failed: $url
The release may not be published yet — see https://github.com/${REPO}/releases"

chmod +x "$tmp"
mv "$tmp" "$dir/$BIN" || err "cannot install to '$dir' (try: MEMQL_INSTALL_DIR=\$HOME/.local/bin)."
trap - EXIT

info "Installed ${BIN} to ${dir}/${BIN}"

# --- PATH hint -------------------------------------------------------------
case ":$PATH:" in
  *":$dir:"*) : ;;
  *) info "Note: ${dir} is not on your PATH. Add it, e.g.:
    echo 'export PATH=\"${dir}:\$PATH\"' >> ~/.profile && . ~/.profile" ;;
esac

info "Run 'memql-cockpit' to start, or 'memql-cockpit --version' to verify."
