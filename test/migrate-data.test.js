const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { migrateUserData } = require('../main/migrate-data');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'romulus-migrate-')); }
function seed(dir) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'tasks.json'), '{"v":1,"tasks":[{"id":"a"}]}'); fs.writeFileSync(path.join(dir, 'config.json'), '{"k":1}'); }

test('copies the old Tasks folder to the new Romulus folder on first run, keeping the old one', () => {
  const root = tmp(); const oldDir = path.join(root, 'Tasks'); const newDir = path.join(root, 'Romulus');
  seed(oldDir);
  const r = migrateUserData(oldDir, newDir);
  assert.strictEqual(r.moved, true);
  assert.strictEqual(fs.readFileSync(path.join(newDir, 'tasks.json'), 'utf8'), '{"v":1,"tasks":[{"id":"a"}]}');
  assert.ok(fs.existsSync(path.join(newDir, 'config.json')));
  assert.ok(fs.existsSync(path.join(oldDir, 'tasks.json')), 'the old folder is left as a backup');
  fs.rmSync(root, { recursive: true, force: true });
});

test('copies into a new folder Electron already created, without overwriting', () => {
  const root = tmp(); const oldDir = path.join(root, 'Tasks'); const newDir = path.join(root, 'Romulus');
  seed(oldDir); fs.mkdirSync(newDir); fs.writeFileSync(path.join(newDir, 'Preferences'), 'chromium');
  const r = migrateUserData(oldDir, newDir);
  assert.strictEqual(r.how, 'copied');
  assert.ok(fs.existsSync(path.join(newDir, 'tasks.json')));
  assert.strictEqual(fs.readFileSync(path.join(newDir, 'Preferences'), 'utf8'), 'chromium');
  assert.ok(fs.existsSync(path.join(oldDir, 'tasks.json')), 'the old folder is left as a backup');
  fs.rmSync(root, { recursive: true, force: true });
});

test('does nothing when there is nothing old, or the new folder already has data', () => {
  const root = tmp(); const oldDir = path.join(root, 'Tasks'); const newDir = path.join(root, 'Romulus');
  assert.strictEqual(migrateUserData(oldDir, newDir).moved, false);
  seed(oldDir); seed(newDir); fs.writeFileSync(path.join(newDir, 'tasks.json'), 'NEW');
  assert.strictEqual(migrateUserData(oldDir, newDir).reason, 'already migrated');
  assert.strictEqual(fs.readFileSync(path.join(newDir, 'tasks.json'), 'utf8'), 'NEW');
  assert.strictEqual(migrateUserData(oldDir, oldDir).reason, 'same folder');
  fs.rmSync(root, { recursive: true, force: true });
});
