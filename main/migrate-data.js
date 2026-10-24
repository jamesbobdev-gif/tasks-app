/* The app was called Tasks before it was Romulus. Electron names the user-data folder after the
   product, so a renamed app would start empty for everyone who had been using it. On the first run
   as Romulus, move the old folder's contents across. Pure: main.js passes the two folders and fs. */
const path = require('path');

function migrateUserData(oldDir, newDir, fsx = require('fs')) {
  if (!oldDir || !newDir || path.resolve(oldDir) === path.resolve(newDir)) return { moved: false, reason: 'same folder' };
  if (!fsx.existsSync(path.join(oldDir, 'tasks.json'))) return { moved: false, reason: 'nothing to migrate' };
  if (fsx.existsSync(path.join(newDir, 'tasks.json'))) return { moved: false, reason: 'already migrated' };
  // Copy rather than move: the old folder stays as a backup, and the old Tasks install still works if it is ever run.
  fsx.cpSync(oldDir, newDir, { recursive: true, force: false, errorOnExist: false });
  return { moved: true, how: 'copied' };
}

module.exports = { migrateUserData };
