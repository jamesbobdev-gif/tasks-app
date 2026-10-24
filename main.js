/* Tasks: the Electron main process. This file only wires the pieces together:
   main/   the window, tray, persistence, calendars, mail and other desktop plumbing
   agent/  the Agent tab: routing, the Claude runner, the mini PC (local) lane, and their helpers
   Each module gets what it shares with the others (config, the log, the window…) through init(ctx)
   and lists its IPC calls in `handlers`, which are registered here behind the trusted-page guard. */
const { app, ipcMain, powerMonitor, powerSaveBlocker, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const calendars = require('./agent/calendars');
const store = require('./main/store');
const win = require('./main/window');
const trayMod = require('./main/tray');
const speak = require('./main/speak');
const feeds = require('./main/feeds');
const persistence = require('./main/persistence');
const gcalSync = require('./main/gcal-sync');
const buyEmails = require('./main/buy-emails');
const deviceSync = require('./main/device-sync');
const calendarAccounts = require('./main/calendar-accounts');
const gmailDates = require('./main/gmail-dates');
const lookAheadMod = require('./main/look-ahead');
const usage = require('./agent/usage-limit');
const routingMod = require('./agent/routing');
const ai = require('./agent/ai-connections');
const usageMeter = require('./agent/usage-meter');
const agentBrowser = require('./agent/agent-browser');
const taskContext = require('./agent/task-context');
const qwenBrowser = require('./agent/qwen-browser');
const previews = require('./agent/previews');
const runner = require('./agent/runner');
const memoryTidy = require('./agent/memory-tidy');
const localTools = require('./agent/local-tools');
const localLane = require('./agent/local-lane');
const liveView = require('./agent/live-view');
const hub = require('./main/hub');
const finance = require('./main/finance');
const downloads = require('./main/downloads');
const updater = require('./main/updater');

// Match the installer's shortcut ID so Windows shows our icon on the taskbar
if (process.platform === 'win32') app.setAppUserModelId('com.jartro.tasks');

// The app used to be called Tasks: bring an existing user-data folder over to Romulus's (main/migrate-data.js)
try { require('./main/migrate-data').migrateUserData(path.join(app.getPath('appData'), 'Tasks'), app.getPath('userData')); } catch (e) { console.error('user-data migration failed', e); }

win.guardIpc(ipcMain);
store.init({ userData: () => app.getPath('userData'), safeStorage });
const { readConfig, writeConfig, agentLog } = store;
const { showWindow } = win;
const { refreshTrayStatus } = trayMod;

// what the main-process modules share: handed to each one's init()
const ctx = {
  userData: () => app.getPath('userData'),
  documents: () => app.getPath('documents'),
  isPackaged: app.isPackaged,
  dataFile: store.dataFile, readConfig, writeConfig, agentLog: store.agentLog,
  // the hub mini PC's window events reach the laptop's window too (main/hub.js)
  sendToRenderer: (ch, p) => { win.sendToRenderer(ch, p); hub.broadcast(ch, p); }, showWindow, newHiddenWindow: win.newHiddenWindow,
  reloadWindow: win.reloadWindow, version: app.getVersion(),
  relaunch: () => { app.relaunch(); win.quit(); },
  // false on a hub client (the laptop, when the mini PC does the agent, mail and calendar work): none of that runs here
  serverWork: () => !hub.isClient(),
  quit: win.quit, icon: win.ICON, refreshTrayStatus,
  openExternal: (u) => shell.openExternal(u),
  powerSaveBlocker, powerMonitor,
  scheduleAgentRun: (raw) => { if (!hub.isClient()) runner.scheduleAgentRun(raw); },
  scheduleLocalRun: (raw) => { if (!hub.isClient()) localLane.scheduleLocalRun(raw); },
  memoryTidying: () => memoryTidy.isTidying(),
  compactHowtos: (asked) => localLane.compactHowtos(asked),
  // Windows' own encryption for a whole file's text (main/finance.js wraps its vault in it)
  seal: store.sealValue, unseal: store.openValue,
  windowHandle: win.windowHandle, // Windows Hello's prompt opens on the Tasks window
  protectWindow: win.protect, // no screen capture while Finance is showing
  // The local model’s money questions (agent/local-lane.js): read-only, only while Finance is unlocked here
  finance: { forAgent: (a) => finance.forAgent(a), unlocked: () => finance.isUnlocked() },
  // the updater waits for these before restarting into a new version
  busy: () => runner.isBusy() || localLane.isBusy() || memoryTidy.isTidying(),
  onUpdateReady: (version) => trayMod.setUpdateReady(version, updater.installNow),
};
const modules = [trayMod, speak, feeds, persistence, gcalSync, buyEmails, deviceSync, calendarAccounts, gmailDates, lookAheadMod,
  usage, routingMod, ai, agentBrowser, taskContext, qwenBrowser, previews, runner, memoryTidy, localTools, localLane, liveView, finance, downloads, updater];
hub.init(ctx);
const allHandlers = Object.assign({}, hub.localHandlers);
for (const m of modules) {
  m.init(ctx);
  Object.assign(allHandlers, m.handlers || {});
}
// a hub client: the mini PC answers the agent's, mail's and calendars' calls (main/hub.js REMOTE)
const ipcHandlers = Object.assign({}, allHandlers);
if (hub.isClient()) {
  for (const ch of hub.REMOTE) ipcHandlers[ch] = (_e, ...args) => hub.forward(ch, args);
  // his rules changed: the mini PC routes, and this computer asks him about unmatched tasks too
  ipcHandlers['routing:changed'] = async (e, ...args) => { await allHandlers['routing:changed'](e, ...args); return hub.forward('routing:changed', args); };
  // signing in to a calendar needs his browser, so it happens here; the account then goes to the mini PC
  ipcHandlers['cal:connect'] = async (e, ...args) => {
    const r = await allHandlers['cal:connect'](e, ...args);
    if (r && r.ok) await hub.sendCalAccounts().catch((err) => { r.warning = 'connected here, but the mini PC didn’t get it: ' + err.message; });
    return r;
  };
  // Finance reads mail here, so the switch is saved here; the mini PC gets the accounts too
  ipcHandlers['cal:set-receipts'] = async (e, ...args) => {
    const r = await allHandlers['cal:set-receipts'](e, ...args);
    await hub.sendCalAccounts().catch(() => {});
    return r;
  };
}
for (const [channel, fn] of Object.entries(ipcHandlers)) ipcMain.handle(channel, fn);
const { holdForUsage } = usage;
const { loadRouting, askForRoutes } = routingMod;
const { scheduleAgentRun, queuedAgentTasks } = runner;
const { scheduleLocalRun } = localLane;
let situationNow = null;
async function refreshSituation() {
  const was = JSON.stringify(situationNow);
  const local = await localLane.localStatus().catch(() => ({ online: false }));
  const claude = usageMeter.snapshot().claude || {};
  situationNow = { localUp: !!(local.configured && local.online), cloudUp: ai.cloudOrder().length > 0,
    claudeTight: !!claude.out || claude.pct >= 0.9 || claude.week >= 0.95 };
  routingMod.noteSituation(situationNow);
  if (was !== JSON.stringify(situationNow)) { scheduleAgentRun(); scheduleLocalRun(); } // a waiting task may have a new home
}
const { maybeTidyMemory } = memoryTidy;

global.__agentTest = { parseUsageLimit: usage.parseUsageLimit, holdForUsage, recentReplies: memoryTidy.recentReplies, maybeTidyMemory };

/* ---------- lifecycle ---------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Another copy is already running (e.g. launched at login) — hand over and exit.
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    store.sealPlainSecrets(); // secrets still in config.json as plain text get encrypted
    // Setting up another computer: drop seed-config.json (sync links, runner off) into its user-data
    // folder (%APPDATA%/tasks) before first launch. It fills in a fresh install that has no sync yet, so
    // every list shows up without setup; it never overrides. It is never bundled into the installer —
    // the sync keys in it are the password to the lists.
    try {
      const seed = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'seed-config.json'), 'utf8'));
      const cfg = readConfig();
      if (!cfg.sync && seed.sync) writeConfig(Object.assign({}, seed, cfg));
    } catch (e) {}
    // calendar accounts; the app's own sign-in clients (oauth-clients.json, not in git) are copied into each
    // computer's user-data folder (%APPDATA%/tasks), like seed-config.json: the installer is public, so it
    // doesn't carry them. A dev run reads the project's copy.
    let oauthClients = {};
    for (const dir of [app.getPath('userData'), __dirname]) {
      try { oauthClients = JSON.parse(fs.readFileSync(path.join(dir, 'oauth-clients.json'), 'utf8')); break; } catch (e) {}
    }
    calendars.init({ readConfig, writeConfig, openExternal: (u) => shell.openExternal(u), clients: () => oauthClients });
    // Register "open at login" once on first run of the installed app.
    // After that, the tray checkbox is the source of truth.
    if (app.isPackaged && (process.platform === 'win32' || process.platform === 'darwin')) {
      const cfg = readConfig();
      if (!cfg.loginInit) {
        app.setLoginItemSettings({ openAtLogin: true });
        cfg.loginInit = true;
        writeConfig(cfg);
      }
    }

    win.createWindow();
    trayMod.createTray();
    updater.start();
    refreshTrayStatus();
    setInterval(() => refreshTrayStatus(), 60 * 60 * 1000);
    if (hub.role() === 'server') hub.startServer(allHandlers);
    if (hub.isClient()) {
      // the mini PC does the agent, mail and calendar work; this computer shows it and syncs
      hub.followEvents();
      agentLog('hub client: agent work runs on the mini PC');
      powerMonitor.on('resume', () => { refreshTrayStatus(); showWindow(); });
      if (process.platform === 'win32') powerMonitor.on('unlock-screen', showWindow);
      app.on('activate', showWindow);
      return;
    }
    // tasks left waiting while the app was closed get picked up shortly after start
    const savedHold = (readConfig().agentRunner || {}).blockedUntil;
    if (savedHold && savedHold > Date.now()) { holdForUsage(queuedAgentTasks().map((t) => t.id), savedHold - 60 * 1000); }
    setTimeout(() => scheduleAgentRun(), 15 * 1000);
    // his routing rules (edited in Settings, synced): load now, refresh now and then
    loadRouting().then(() => { scheduleAgentRun(); scheduleLocalRun(); askForRoutes(); });
    setInterval(() => loadRouting(), 5 * 60 * 1000);
    // what auto routing knows: is the mini PC answering, is a cloud AI connected, is Claude near its limit
    refreshSituation();
    setInterval(() => refreshSituation(), 2 * 60 * 1000);
    setTimeout(() => scheduleLocalRun(), 20 * 1000);
    // weekly memory tidy: looked at a few minutes after start and every 6 hours; it runs only when due and idle
    setTimeout(() => maybeTidyMemory().catch(() => {}), 5 * 60 * 1000);
    setInterval(() => maybeTidyMemory().catch(() => {}), 6 * 60 * 60 * 1000);
    // still signed in to his school sites on the mini PC? Looked at every 30 min; it runs once a day, when the local model is idle
    setInterval(() => localLane.checkSignins().catch((e) => agentLog('sign-in check crashed: ' + (e && e.message || e))), 30 * 60 * 1000);

    // Bring the window back whenever the screen turns on.
    powerMonitor.on('resume', () => { refreshTrayStatus(); showWindow(); });
    if (process.platform === 'win32') {
      powerMonitor.on('unlock-screen', showWindow);
    }

    app.on('activate', showWindow); // macOS dock click
  });

  app.on('before-quit', () => win.setQuitting());

  // Window closed -> keep running in the tray (don't quit).
  app.on('window-all-closed', () => {});
}
