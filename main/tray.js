/* The tray icon: its menu, and a tooltip with overdue / due-today counts. */
const fs = require('fs');

let ctx = null; // { dataFile, showWindow, quit, agentLog, icon }
function init(c) { ctx = c; }

let tray = null;

let update = null; // { version, install } once a new version has downloaded (main/updater.js)

function createTray() {
  const { Tray, nativeImage } = require('electron');
  const icon = nativeImage.createFromPath(ctx.icon).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Romulus');
  buildMenu();
  tray.on('click', ctx.showWindow);
}

function buildMenu() {
  const { app, Menu } = require('electron');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Tasks', click: ctx.showWindow },
    ...(update ? [{ label: 'Restart to update (' + update.version + ')', click: update.install }] : []),
    {
      label: 'Start when I log in',
      type: 'checkbox',
      checked: app.isPackaged ? app.getLoginItemSettings().openAtLogin : false,
      enabled: app.isPackaged && process.platform !== 'linux',
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
    },
    { type: 'separator' },
    { label: 'Quit Tasks', click: () => ctx.quit() }
  ]));
}

function setUpdateReady(version, install) {
  update = { version, install };
  if (tray) buildMenu();
}

// "Romulus — 3 overdue · 1 due today" for these tasks, counted from `today`
function trayTip(tasks, today = new Date()) {
  today = new Date(today); today.setHours(0, 0, 0, 0);
  let overdue = 0, dueToday = 0;
  for (const t of tasks) {
    if (t.done || !t.due || t.ws === 'agent') continue; // agent tasks are Claude's, not yours
    const [y, m, d] = t.due.split('-').map(Number);
    const diff = Math.round((new Date(y, m - 1, d) - today) / 864e5);
    if (diff < 0) overdue++;
    else if (diff === 0) dueToday++;
  }
  const parts = [];
  if (overdue) parts.push(overdue + ' overdue');
  if (dueToday) parts.push(dueToday + ' due today');
  return parts.length ? 'Romulus — ' + parts.join(' · ') : 'Romulus';
}

function refreshTrayStatus(raw) {
  if (!tray) return;
  let data;
  try {
    data = raw != null ? JSON.parse(raw) : JSON.parse(fs.readFileSync(ctx.dataFile(), 'utf8'));
  } catch (e) { return; }
  tray.setToolTip(trayTip(Array.isArray(data.tasks) ? data.tasks : []));
}

module.exports = { init, createTray, refreshTrayStatus, trayTip, setUpdateReady };
