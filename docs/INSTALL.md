# Installation

## Install or update

1. Save your documents and quit MD Viewer.
2. Open Terminal. On macOS, press Command + Space and search for Terminal. On Ubuntu, press Ctrl + Alt + T.
3. Paste the complete command below and press Enter. Wait for `MD Viewer installed successfully`.

```bash
bash -c 'set -e; command -v curl >/dev/null || { sudo apt-get update; sudo apt-get install -y curl ca-certificates; }; mdviewer_script=$(mktemp); trap "rm -f \"$mdviewer_script\"" EXIT; curl -fsSL https://raw.githubusercontent.com/thientranvan/markdown_viewer/main/install.sh -o "$mdviewer_script"; bash "$mdviewer_script"'
```

This command downloads and executes the installer from `thientranvan/markdown_viewer`. Execution starts only after the download succeeds. Internet access is required during installation. Do not run the whole command with `sudo`.

On Linux, the installer may request your login password to install system libraries and configure Electron's sandbox helper. Password characters do not appear while typing. The helper is owned by `root` with permissions `4755`, allowing Electron to use its sandbox. The installer does not use `--no-sandbox` or delete your documents.

Run the same command to update. Git, Node.js, npm, and packaging tools do not need to be installed manually.

## Supported systems

- macOS 13.5 or later, on Apple Silicon or 64-bit Intel.
- Ubuntu 22.04 or later / Debian 12 or later, with a desktop session, x64 or ARM64 processor, and a user account with sudo access.
- Windows and other Linux distributions are not supported by the automatic installer.

The macOS installer has been tested directly, including without Node.js in PATH. Linux launcher, desktop registration, and rollback have automated checks; the complete Linux installer has not yet been run on a Linux host.

## Installation steps

The installer:

- Detects the operating system and processor.
- Uses an existing Node.js installation if version 22.12.0 or later is available. Otherwise, downloads official Node.js 24 LTS and verifies its SHA-256 checksum. Existing Node.js installations are preserved.
- Downloads the source, installs locked dependencies, runs a dependency audit, and runs tests. Failed checks stop installation before app replacement.
- On macOS, creates `MD Viewer.app` with its icon, ad-hoc signature, and Markdown file associations. Xcode and external packaging tools are not required.
- On Linux, installs system libraries, the app, its icon and menu entry, and associations for `.md`, `.markdown`, `.mdown`, and `.mkd`. The launcher runs Electron directly without depending on the Terminal or nvm PATH.
- Backs up the previous app and restores it if replacement or registration fails.

`npm audit` reports vulnerabilities known to the registry at the time of the check. It does not guarantee the absence of all security issues. Installation stops when audit reports a finding at low severity or higher.

## App locations and backups

**macOS:** open MD Viewer from Applications or double-click a Markdown document. New installations go to `~/Applications/MD Viewer.app`. If a matching app already exists in `/Applications` and that directory is writable, it is updated there. Otherwise, the system app is preserved and the new app is installed in `~/Applications`; open that copy.

**Linux:** open MD Viewer from the application menu or double-click a Markdown document. The app is installed in `~/.local/share/md-viewer/app`. Keep this directory for the app to continue working.

Node.js downloaded by the installer is stored in `~/.local/share/md-viewer/node`. The installer does not change shell configuration or install the app as root.

Backups are stored in `.md-viewer-backups` beside the app directory:

- macOS: `~/Applications/.md-viewer-backups` or `/Applications/.md-viewer-backups`.
- Linux: `~/.local/share/md-viewer/.md-viewer-backups`.

In Finder, press Command + Shift + . to show hidden directories. Backups contain the app, not your Markdown documents.

## Usage

- **Open:** select a file or directory. For a directory, the app selects `README.md` or the first Markdown file.
- **Save / Save As:** save the current document or create another file.
- **View / Split / Edit:** switch between preview, side-by-side editing, and source editing.
- In Split mode, scrolling either pane keeps the other pane aligned.

Inline and display math:

```markdown
The electron density is $n_{2D}$.

$$ N_D L = n_{2D} $$

$$
\boxed{n_{2D}\approx\frac{\varepsilon_0\varepsilon_b}{e^2}\frac{\Delta E_c-E_{DD}}{s+h+\tfrac14 a_B}}
$$
```

KaTeX supports a subset of LaTeX: <https://katex.org/docs/supported.html>. Dollar signs in code blocks or code spans are not interpreted as math. Invalid formulas do not stop the whole preview.

Marp/YAML metadata must appear at the beginning of the file between two `---` lines:

```markdown
---
marp: true
theme: default
paginate: true
math: katex
style: |
  section { background: #0B1A2B; color: #F1F6FC; }
---

# TWO-DIMENSIONAL ELECTRON GAS (2DEG)
```

The preview hides metadata while the editor preserves it for editing and saving. Marp themes, custom CSS, and Marp slide rendering are not supported. Without the delimiters, configuration appears as document text.

## PDF export

1. Open a Markdown document and select **PDF** in the toolbar, **File → Export PDF**, or **Ctrl/Cmd+P**.
2. Choose paper size, orientation, scale, and margins.
3. Select **Export PDF**, then choose the destination in the save dialog.

Export uses the current preview, including unsaved edits, formulas, syntax highlighting, and resolved images. The editor, toolbar, and YAML metadata are excluded. Exporting does not save or change the Markdown document.

| Paper size | Dimensions | Default orientation |
| --- | --- | --- |
| A4 | 210 × 297 mm | Portrait |
| A3 | 297 × 420 mm | Portrait |
| Letter | 215.9 × 279.4 mm | Portrait |
| Widescreen 16:9 | Approximately 338.7 × 190.5 mm | Landscape |
| Standard 4:3 | 254 × 190.5 mm | Landscape |
| Custom | Width and height from 50 to 1000 mm | Current selection |

Orientation determines whether the longer edge is horizontal or vertical, including for custom dimensions. Paper dimensions remain unchanged when changing scale.

- **Scale:** 25–200%. At 100%, text uses its normal print size. Smaller values fit more content; larger values enlarge text and can increase page count.
- **Margins:** 0–50 mm on every side. Margins must leave at least 10 mm of content space on each axis.
- **Include background colors:** controls backgrounds in highlighted code and other rendered elements.
- **Start a new page at horizontal rules (---):** starts each separated section on a new page. The 16:9 and 4:3 presets enable this automatically; it can be changed independently.

Widescreen paper and page breaks provide slide-shaped PDF pages without applying Marp themes or custom CSS. Long sections can span more than one page; reduce scale or edit the section if needed. Images preserve their aspect ratio and are capped to fit the page with room for surrounding text.

The exporter waits for fonts and images. Missing or slow resources produce an error instead of a partial export. Existing PDFs are replaced only after generation and writing succeed; failed exports preserve the existing file. Use the save dialog to confirm replacement when choosing an existing PDF.

## Troubleshooting

- **App still running:** save your documents, quit MD Viewer, and rerun installation. The macOS installer does not force the app to close, protecting unsaved changes.
- **Two app copies on macOS:** if the system app is not writable, the new copy is in `~/Applications`. Open that copy. Do not run the entire installer with sudo.
- **Network, checksum, or npm download failure:** check your connection or proxy, then rerun the same command. Do not bypass checksum or audit checks.
- **Audit findings:** report the audit output in Issues and wait for updated dependencies. Do not use `npm audit fix --force` to bypass the installer check.
- **No Linux desktop session or sudo:** run from a Terminal in your desktop session with an account that has sudo access. Headless servers and SSH-only sessions are not supported.
- **macOS blocks the app:** the locally built app is not Apple-notarized. After verifying that this installer created it, use **System Settings → Privacy & Security → Open Anyway** if available. Do not disable Gatekeeper system-wide.
- **Formulas or configuration appear as text:** check the `$`/`$$` pairs, the YAML delimiters at the beginning of the file, and that you opened the updated app.
- **PDF image loading fails:** check relative image paths from the Markdown file's directory and network access for remote images, then retry.
- **A PDF section spans multiple pages:** reduce export scale, margins, or section length, or choose a larger paper size. Selecting 16:9 sets the paper ratio rather than automatically fitting every section onto one page.

For unresolved problems, open <https://github.com/thientranvan/markdown_viewer/issues> and include your operating system and complete error output. Do not include passwords, tokens, or private documents.

## Install from a local checkout

Run from the repository directory:

```bash
bash install.sh --local "$PWD"
```

This installs the current source without pulling or changing your checkout. The installed app is a separate copy. Rerun after source changes to update it.

## Uninstall

On Linux, remove desktop registration using the installer-managed Node.js installation, if present:

```bash
"$HOME/.local/share/md-viewer/node/bin/node" "$HOME/.local/share/md-viewer/app/scripts/uninstall-desktop.js"
```

If the installer used an existing Node.js installation, replace the first path with `node`. You can then remove the app directory using your file manager. Desktop removal does not delete Markdown documents.

On macOS, quit MD Viewer and move the app to Trash in Finder. Backups and documents are preserved.
