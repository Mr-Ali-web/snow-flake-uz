const { app, BrowserWindow, Tray, Menu, screen, nativeImage, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const scanner = require('./scanner');
const { ledgesFor } = require('./ledges');

if (!app.requestSingleInstanceLock()) app.quit();
app.on('window-all-closed', () => {}); // tray ilova: oynalar yopilsa ham ishlayveradi

const defaults = { density: 'medium', wind: true, accumulate: true, windows: true, paused: false, playMode: false };
let settings = { ...defaults };
let overlays = [];
let tray = null;
let lastCursor = { x: -1, y: -1 };
let rects = [];
let stopScan = null;

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const save = () => { try { fs.writeFileSync(settingsFile(), JSON.stringify(settings)); } catch {} };

function createOverlays() {
  overlays.forEach(({ win }) => !win.isDestroyed() && win.destroy());
  overlays = screen.getAllDisplays().map((d) => {
    const { bounds, workArea } = d;
    const win = new BrowserWindow({
      ...bounds,
      transparent: true, frame: false, hasShadow: false, resizable: false, movable: false,
      focusable: settings.playMode, skipTaskbar: true, alwaysOnTop: true, show: false, enableLargerThanScreen: true,
      ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(!settings.playMode);
    win.setBounds(bounds);
    win.loadFile(path.join(__dirname, 'overlay.html'));
    const entry = { win, bounds, ready: false, key: '' };
    win.webContents.on('did-finish-load', () => {
      // qor Dock/taskbar ustiga qo'nadi: workArea pastki chegarasi
      win.webContents.send('init', { groundY: workArea.y + workArea.height - bounds.y, settings });
      win.showInactive();
      entry.ready = true; sendWindows(entry);
    });
    return entry;
  });
}

const broadcast = (ch, data) => overlays.forEach(({ win }) => !win.isDestroyed() && win.webContents.send(ch, data));

function sendWindows(o) {
  if (o.win.isDestroyed() || !o.ready) return;
  const list = settings.windows && !settings.paused ? ledgesFor(rects, o.bounds) : [];
  const key = JSON.stringify(list);
  if (key === o.key) return;
  o.key = key; o.win.webContents.send('windows', list);
}
const pushWindows = () => overlays.forEach(sendWindows);
function onRects(raw) {
  rects = raw.map(([id, l, t, r, b]) => {
    if (process.platform !== 'win32') return [id, l, t, r, b]; // Windows: piksel -> DIP
    const a = screen.screenToDipPoint({ x: l, y: t }), c = screen.screenToDipPoint({ x: r, y: b });
    return [id, a.x, a.y, c.x, c.y];
  });
  pushWindows();
}
function update(patch) { settings = { ...settings, ...patch }; save(); broadcast('settings', settings); pushWindows(); buildMenu(); }
function setPlayMode(enabled) {
  settings.playMode = enabled;
  if (enabled) globalShortcut.register('Escape', () => settings.playMode && setPlayMode(false));
  else globalShortcut.unregister('Escape');
  overlays.forEach(({ win }) => {
    if (win.isDestroyed()) return;
    win.setFocusable(enabled); win.setIgnoreMouseEvents(!enabled);
  });
  save(); broadcast('settings', settings); broadcast('play', enabled); buildMenu();
}
function togglePlayMode() { setPlayMode(!settings.playMode); }

function buildMenu() {
  const dens = (id, label) => ({ label, type: 'radio', checked: settings.density === id, click: () => update({ density: id }) });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Qor kuchi', submenu: [dens('light', 'Yengil'), dens('medium', "O'rtacha"), dens('heavy', 'Kuchli')] },
    { label: 'Shamol', type: 'checkbox', checked: settings.wind, click: (i) => update({ wind: i.checked }) },
    { label: 'Qor uyumi', type: 'checkbox', checked: settings.accumulate, click: (i) => update({ accumulate: i.checked }) },
    { label: 'Oynalar ustida qor', type: 'checkbox', checked: settings.windows, click: (i) => update({ windows: i.checked }) },
    { label: "To'xtatib turish", type: 'checkbox', checked: settings.paused, click: (i) => update({ paused: i.checked }) },
    { label: 'Uyumni tozalash', click: () => broadcast('clear') },
    { label: 'O‘yin rejimi (Ctrl/Cmd+Shift+S)', type: 'checkbox', checked: settings.playMode, click: togglePlayMode },
    { type: 'separator' },
    { label: 'Kompyuter yoqilganda ishga tushirish', type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { label: 'Chiqish', click: () => app.quit() },
  ]));
}

app.whenReady().then(() => {
  try { settings = { ...defaults, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')), playMode: false }; } catch {}
  if (process.platform === 'darwin') app.dock?.hide();
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Snow Flake UZ');
  buildMenu();
  createOverlays();
  stopScan = scanner.start(onRects);
  app.on('will-quit', () => stopScan && stopScan());
  globalShortcut.register(process.platform === 'darwin' ? 'Command+Shift+S' : 'Control+Shift+S', togglePlayMode);
  ipcMain.on('play-exit', () => settings.playMode && setPlayMode(false));
  app.on('will-quit', () => globalShortcut.unregisterAll());

  let t; const rebuild = () => { clearTimeout(t); t = setTimeout(createOverlays, 500); };
  ['display-added', 'display-removed', 'display-metrics-changed'].forEach((e) => screen.on(e, rebuild));

  // Oyna click-through bo'lgani uchun kursorni o'zimiz kuzatamiz
  setInterval(() => {
    if (settings.paused) return;
    const p = screen.getCursorScreenPoint();
    if (p.x === lastCursor.x && p.y === lastCursor.y) return;
    lastCursor = p;
    overlays.forEach(({ win, bounds }) => !win.isDestroyed() && win.webContents.send('cursor', { x: p.x - bounds.x, y: p.y - bounds.y }));
  }, 16);
});
