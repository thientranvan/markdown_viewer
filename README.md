# Markdown Viewer

Markdown Viewer is a local Linux desktop app for opening, reading, and editing Markdown files. It is built with Electron and is intended to be installed as the default handler for `.md` files, so double-clicking a Markdown document opens it in a formatted preview.

## Features

- GitHub-style Markdown preview.
- Split view with editable source and selectable preview.
- Two-way scroll sync between source and preview based on Markdown blocks.
- Open, save, and save-as support.
- Open a folder directly; the app opens `README.md` or the first Markdown file it finds.
- Relative images, media, and Markdown links resolve from the opened file's directory.
- Syntax highlighting for fenced code blocks.
- Linux desktop integration through `.desktop`, `xdg-mime`, and `gio`.

## Requirements

- Linux desktop environment that supports freedesktop `.desktop` entries.
- Node.js 20 or newer.
- npm.
- `xdg-mime`, `gio`, `update-desktop-database`, and `update-mime-database` for double-click integration.

Ubuntu/Debian packages usually provide the desktop tools:

```bash
sudo apt install xdg-utils libglib2.0-bin desktop-file-utils shared-mime-info
```

## Install

Clone the repository and install dependencies:

```bash
git clone https://github.com/thientranvan/markdown_viewer.git
cd markdown_viewer
npm install
npm run check
```

If you prefer SSH:

```bash
git clone git@github.com:thientranvan/markdown_viewer.git
```

Register Markdown Viewer as the desktop handler for Markdown files:

```bash
npm run install-desktop
```

After this, double-clicking `.md`, `.markdown`, `.mdown`, or `.mkd` files should open them in Markdown Viewer.

## Usage

Open a file from the terminal:

```bash
./bin/mdviewer README.md
```

Open a folder and automatically load its `README.md`:

```bash
./bin/mdviewer /path/to/project
```

Run without a file:

```bash
npm start
```

Inside the app:

- `Open` selects a Markdown file or folder.
- `Save` writes changes to the current file.
- `Save As` writes the document to a new file.
- `View`, `Split`, and `Edit` switch the workspace mode.
- In split mode, scrolling either the source or preview keeps the other pane aligned.

## File Association

The install script creates:

- `~/.local/share/applications/mdviewer.desktop`
- `~/.local/share/mime/packages/mdviewer-markdown.xml`

It then sets:

- `text/markdown -> mdviewer.desktop`
- `text/x-markdown -> mdviewer.desktop`

Check the current association:

```bash
xdg-mime query default text/markdown
xdg-mime query default text/x-markdown
xdg-mime query filetype README.md
```

Re-run desktop registration after moving the repository to a new path:

```bash
npm run install-desktop
```

## Uninstall Desktop Integration

Remove the desktop entry and MIME registration owned by this app:

```bash
npm run uninstall-desktop
```

This does not delete the repository or your Markdown files.

## Troubleshooting

If double-click opens an empty document, close any already running Markdown Viewer windows and open the file again. Older app windows may still be running code from before the latest install.

If double-click does not open Markdown Viewer, re-run:

```bash
npm run install-desktop
```

If a Markdown file is on an external or NTFS/FUSE mount, verify that Node can read it:

```bash
node -e "const fs=require('fs'); console.log(fs.readFileSync(process.argv[1], 'utf8').slice(0, 120))" /path/to/file.md
```

If Electron fails with GPU or Mesa/NVIDIA messages, the app already disables hardware acceleration in `src/main.js`; update dependencies and try again:

```bash
npm install
npm run check
```

## Development

Start the app:

```bash
npm start -- samples/demo.md
```

Run checks:

```bash
npm run check
```

Important files:

- `src/main.js`: Electron main process, file loading, save dialogs, desktop window lifecycle.
- `src/preload.js`: safe bridge between Electron and renderer.
- `src/renderer.js`: editor, Markdown rendering, link handling, scroll sync.
- `scripts/install-desktop.js`: Linux file association installer.
- `scripts/uninstall-desktop.js`: desktop integration cleanup.

## Repository Description

Suggested GitHub description:

```text
Local Electron Markdown viewer/editor for Linux with GitHub-style preview, double-click .md file association, save support, and two-way source/preview scroll sync.
```
