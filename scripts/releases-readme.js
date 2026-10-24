/* Keeps the README on the public installers repo (scripts/releases-readme.md) up to date through the
   GitHub API. Run on its own (`node scripts/releases-readme.js`) or from scripts/release.js. Needs gh signed in. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const pkg = require('../package.json');
const { owner, repo } = pkg.build.publish;
const file = path.join(__dirname, 'releases-readme.md');
const api = (args, input) => execFileSync('gh', ['api', ...args], { encoding: 'utf8', input, windowsHide: true });

function syncReadme() {
  const want = fs.readFileSync(file, 'utf8');
  let sha = null;
  try {
    const cur = JSON.parse(api([`repos/${owner}/${repo}/contents/README.md`]));
    if (Buffer.from(cur.content, 'base64').toString('utf8') === want) { console.log('releases README is current'); return false; }
    sha = cur.sha;
  } catch (e) {} // none yet: made below
  const body = { message: 'README: how to install, what this repository is', content: Buffer.from(want).toString('base64') };
  if (sha) body.sha = sha;
  api([`repos/${owner}/${repo}/contents/README.md`, '-X', 'PUT', '--input', '-'], JSON.stringify(body));
  console.log(`releases README updated on ${owner}/${repo}`);
  return true;
}

// the notes on a release page: which of the files is the installer. `node scripts/releases-readme.js notes 1.0.2`
function releaseNotes(version) {
  return [
    `## Download **Romulus-Setup-${version}.exe** and run it`,
    '',
    'That one file is the installer for Windows. It updates an existing copy in place; your tasks and settings stay.',
    'Windows shows an "unrecognized app" warning because the installer isn\'t code-signed yet: click **More info → Run anyway**.',
    '',
    'The other files are not for you: `latest.yml` and the `.blockmap` are how installed copies update themselves, and the',
    '"Source code" archives are added by GitHub and hold only this repository\'s README.',
    '',
    'Setup, what the app does and where your keys live: see the [README](../../#readme).',
  ].join('\n');
}
function writeNotes(version) {
  const v = String(version).replace(/^v/, '');
  execFileSync('gh', ['release', 'edit', 'v' + v, '--repo', `${owner}/${repo}`, '--title', v, '--notes', releaseNotes(v)], { encoding: 'utf8', windowsHide: true });
  console.log(`release notes written on v${v}`);
}

if (require.main === module) {
  if (process.argv[2] === 'notes') writeNotes(process.argv[3] || pkg.version); else syncReadme();
}
module.exports = { syncReadme, writeNotes, releaseNotes };
