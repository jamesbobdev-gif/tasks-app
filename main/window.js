/* The app's one window: what it may show, the IPC guard that only answers the app's own page, and
   hiding to the tray instead of closing. This module is Electron by nature; the rest of main/ talks
   to the window through sendToRenderer / showWindow handed out in main.js. */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow = null;
let isQuitting = false;

const ROOT = path.join(__dirname, '..');
const ICON = path.join(ROOT, 'assets', 'icon.png');
const APP_PAGE = path.join(ROOT, 'renderer', 'index.html');

// True only for the app's own bundled page — never a website the window was
// somehow pointed at.
function isAppPage(u) {
  try {
    const parsed = new URL(String(u || ''));
    if (parsed.protocol !== 'file:') return false;
    return path.normalize(require('url').fileURLToPath(parsed)).toLowerCase() === path.normalize(APP_PAGE).toLowerCase();
  } catch (e) { return false; }
}

// Every desktop function (tasks, mail, calendars…) is an IPC
// handler. Only answer calls coming from the app's own page in its top frame,
// so a stray page or iframe can never reach them.
function trustedSender(event) {
  const f = event && event.senderFrame;
  return !!(f && !f.parent && isAppPage(f.url));
}
function guardIpc(ipcMain) {
  const rawHandle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, fn) => rawHandle(channel, (event, ...args) => {
    if (!trustedSender(event)) throw new Error('Blocked: untrusted sender');
    return fn(event, ...args);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 860,
    minWidth: 420,
    minHeight: 480,
    title: 'Romulus',
    icon: ICON,
    backgroundColor: '#FBFBFA',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  // The window only ever shows the app itself: no navigating away, no pop-ups.
  // Web links go to the real browser instead.
  const toBrowser = (url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url).catch(() => {}); };
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { toBrowser(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (isAppPage(url)) return;
    e.preventDefault();
    toBrowser(url);
  });
  mainWindow.webContents.on('will-redirect', (e, url) => { if (!isAppPage(url)) e.preventDefault(); });
  mainWindow.webContents.on('will-attach-webview', (e) => e.preventDefault());

  const loadApp = () => mainWindow.loadFile(APP_PAGE);
  // A failed load (e.g. antivirus briefly locking the asar at login) otherwise
  // leaves a blank window forever — retry until it sticks.
  loadApp().catch(() => setTimeout(loadApp, 1500));
  mainWindow.webContents.on('did-fail-load', () => setTimeout(loadApp, 1500));
  // a fresh page starts off Finance: drop the capture block it may have left (it sets it again if it opens there)
  mainWindow.webContents.on('did-start-loading', () => protect(false));

  // Closing the window hides it to the tray; the app keeps running
  // so it can reappear when the screen wakes. Quit from the tray menu.
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function showWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function sendToRenderer(ch, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(ch, payload);
}

// a hidden, sandboxed window for reading pages behind a bot check (link preview pictures)
function newHiddenWindow(opts) { return new BrowserWindow(opts); }

// the page loads again (after the laptop handed its settings to the hub mini PC)
function reloadWindow() { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload(); }

function quit() { isQuitting = true; app.quit(); }
function setQuitting() { isQuitting = true; }

// while Finance is on screen: Windows leaves the window out of every capture (screenshots, screen sharing,
// Recall / Copilot, an AI assistant's screenshot tools); it shows as black there
function protect(on) {
  if (mainWindow && !mainWindow.isDestroyed()) { try { mainWindow.setContentProtection(!!on); } catch (e) {} }
}
// the main window's handle as a number (Windows Hello attaches its prompt to it), or null
function windowHandle() {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const b = mainWindow.getNativeWindowHandle();
  return b.length >= 8 ? Number(b.readBigUInt64LE(0)) : b.readUInt32LE(0);
}

module.exports = { ICON, guardIpc, createWindow, showWindow, sendToRenderer, newHiddenWindow, reloadWindow, quit, setQuitting, windowHandle, protect };
