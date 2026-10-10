# Markdown Viewer

Local macOS and Linux app for reading and editing Markdown, with GitHub-style preview, offline LaTeX math, and two-way scroll sync.

## Install or update with one command

Save documents and quit MD Viewer first. Paste this single line into Terminal:

```bash
bash -c 'set -e; command -v curl >/dev/null || { sudo apt-get update; sudo apt-get install -y curl ca-certificates; }; mdviewer_script=$(mktemp); trap "rm -f \"$mdviewer_script\"" EXIT; curl -fsSL https://raw.githubusercontent.com/thientranvan/markdown_viewer/main/install.sh -o "$mdviewer_script"; bash "$mdviewer_script"'
```

This downloads and executes the installer from this repository after the download succeeds. It installs missing Node.js, verifies its SHA-256, installs locked dependencies, runs `npm audit` and tests, then installs the app and Markdown file associations. Do not run the whole command with `sudo`.

Supports macOS 13.5+ and Ubuntu 22.04+/Debian 12+ desktop, on x64/ARM64. Linux requires sudo for system packages and Electron's root-owned setuid sandbox helper; the app does not disable the sandbox to bypass installation errors. Other platforms are not supported by the automatic installer.

**[Installation guide](docs/INSTALL.md)** — one-command installation, updates, locations, backups, usage, troubleshooting, and uninstalling.

- macOS: installs into `~/Applications/MD Viewer.app`, or updates an existing app with the matching bundle ID in `/Applications` if writable. Includes app icon, ad-hoc signing, and Markdown document registration. The app is not Apple-notarized.
- Linux: installs into `~/.local/share/md-viewer/app`, adds the application menu entry, and registers `.md`, `.markdown`, `.mdown`, and `.mkd`. The launcher uses the Electron binary directly, including when Node.js was installed through nvm.
- Existing installations are backed up before replacement; failed replacement/registration restores the previous app. Download, dependency audit, or test failures stop installation before replacement.
- Run the same command again to update. Your Markdown documents are not deleted.

The macOS installer has been tested directly, including without Node.js in PATH. Linux desktop registration, quoting, and rollback have automated checks; the complete Linux installer has not yet been exercised on a Linux host.

## Features

- GitHub-style Markdown preview with syntax highlighting.
- Inline `$...$` and display `$$...$$` math rendered locally with KaTeX.
- YAML frontmatter hidden in preview and preserved in the editor. Marp slide layout, themes, and custom CSS are not applied.
- View, split, and edit modes; two-way scroll sync based on source blocks.
- Open, save, and save-as; opening a folder selects its `README.md` or first Markdown file.
- Relative images, media, and Markdown links resolve from the document's directory.
- Native macOS app and Linux desktop/file association integration.

## Use

Open MD Viewer from Applications or the application menu, or double-click a Markdown document.

- **Open** selects a document or folder.
- **Save / Save As** saves the current file or creates another file.
- **View / Split / Edit** switches the workspace.
- Split mode keeps the editor and preview aligned while scrolling.

KaTeX supports a [subset of LaTeX](https://katex.org/docs/supported.html). Code blocks and code spans are not interpreted as math. Frontmatter must be delimited by `---` at the beginning of the file; hiding Marp metadata does not turn the viewer into a slide renderer.

## Development

Node.js 22.12.0 or newer is required; Node.js 24 LTS is recommended. From a cloned repository:

```bash
npm ci
node -e 'console.log(require("electron"))'
npm test
npm start -- samples/demo.md
```

Recent Electron packages fetch their runtime on first require. To install the current checkout and handle prerequisites with one command:

```bash
bash install.sh --local "$PWD"
```

This installs a separate copy without changing or pulling your working tree. To package/install after dependencies and Electron are already present:

```bash
npm run install-app
```

Linux-only registration for an existing checkout:

```bash
npm run install-desktop
```

Keep that checkout at the same path, or rerun registration after moving it. Automatic installation uses its own stable directory instead.

## Checks

```bash
npm test
npm audit
```

For a real Electron rendering/sanitization check in a desktop session, run `npm run check-browser` (requires the downloaded Electron runtime; not part of headless checks).

Checks cover required assets, source syntax, math/frontmatter rendering, desktop path quoting, backup/rollback, and incomplete installer downloads. An audit result describes known registry advisories at that time; it does not guarantee that all security issues are absent. The installer rejects audit findings at low severity or higher.

Important files:

- `install.sh`: platform detection, prerequisites, verified Node.js download, source/dependency installation, checks.
- `scripts/install-app.js`: native macOS packaging, Linux app installation, backups and rollback.
- `scripts/install-desktop.js`: Linux desktop/MIME registration and configuration rollback.
- `src/main.js`: file loading, saves, dialogs, window lifecycle.
- `src/preload.js`: bridge between Electron and renderer.
- `src/renderer.js`: Markdown/math preview, links, scroll sync.

## Uninstall

See the [installation guide](docs/INSTALL.md#uninstall) for installation-specific paths. Linux desktop registration can be removed from the installed app or original registered checkout:

```bash
npm run uninstall-desktop
```

On macOS, quit the app and move it to Trash. Uninstalling desktop integration does not delete your documents.
