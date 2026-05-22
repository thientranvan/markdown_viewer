const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const home = os.homedir();
const applicationsDir = path.join(home, '.local', 'share', 'applications');
const desktopFile = path.join(applicationsDir, 'mdviewer.desktop');
const mimeBaseDir = path.join(home, '.local', 'share', 'mime');
const mimeXmlFile = path.join(mimeBaseDir, 'packages', 'mdviewer-markdown.xml');

function commandExists(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], {
    stdio: 'ignore'
  });
  return result.status === 0;
}

function run(command, args) {
  if (!commandExists(command)) {
    return false;
  }

  const result = spawnSync(command, args, { stdio: 'inherit' });
  return result.status === 0;
}

function stripMimeDefaults(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const nextLines = lines.filter((line) => {
    return !/^text\/markdown=mdviewer\.desktop;?$/i.test(line.trim())
      && !/^text\/x-markdown=mdviewer\.desktop;?$/i.test(line.trim());
  });

  if (nextLines.length !== lines.length) {
    fs.writeFileSync(filePath, nextLines.join('\n'), 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function removeFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath);
    console.log(`Removed ${filePath}`);
  }
}

stripMimeDefaults(path.join(home, '.config', 'mimeapps.list'));
stripMimeDefaults(path.join(home, '.local', 'share', 'applications', 'mimeapps.list'));

removeFile(desktopFile);
removeFile(mimeXmlFile);

run('update-desktop-database', [applicationsDir]);
run('update-mime-database', [mimeBaseDir]);

console.log('Desktop integration removed. Your desktop may choose another Markdown handler automatically.');
