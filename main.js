const { app, BrowserWindow, Tray, Menu, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) app.quit();
app.on('window-all-closed', () => {}); // tray ilova: oynalar yopilsa ham ishlayveradi

const defaults = { density: 'medium', wind: true, accumulate: true, paused: false };
let settings = { ...defaults };
let overlays = [];
let tray = null;
let lastCursor = { x: -1, y: -1 };

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const save = () => { try { fs.writeFileSync(settingsFile(), JSON.stringify(settings)); } catch {} };

function createOverlays() {
  overlays.forEach(({ win }) => !win.isDestroyed() && win.destroy());
  overlays = screen.getAllDisplays().map((d) => {
    const { bounds, workArea } = d;
    const win = new BrowserWindow({
      ...bounds,
      transparent: true, frame: false, hasShadow: false, resizable: false, movable: false,
      focusable: false, skipTaskbar: true, alwaysOnTop: true, show: false, enableLargerThanScreen: true,
      ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(true);
    win.setBounds(bounds);
    win.loadFile(path.join(__dirname, 'overlay.html'));
    win.webContents.on('did-finish-load', () => {
      // qor Dock/taskbar ustiga qo'nadi: workArea pastki chegarasi
      win.webContents.send('init', { groundY: workArea.y + workArea.height - bounds.y, settings });
      win.showInactive();
    });
    return { win, bounds };
  });
}

const broadcast = (ch, data) => overlays.forEach(({ win }) => !win.isDestroyed() && win.webContents.send(ch, data));
function update(patch) { settings = { ...settings, ...patch }; save(); broadcast('settings', settings); buildMenu(); }

function buildMenu() {
  const dens = (id, label) => ({ label, type: 'radio', checked: settings.density === id, click: () => update({ density: id }) });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Qor kuchi', submenu: [dens('light', 'Yengil'), dens('medium', "O'rtacha"), dens('heavy', 'Kuchli')] },
    { label: 'Shamol', type: 'checkbox', checked: settings.wind, click: (i) => update({ wind: i.checked }) },
    { label: 'Qor uyumi', type: 'checkbox', checked: settings.accumulate, click: (i) => update({ accumulate: i.checked }) },
    { label: "To'xtatib turish", type: 'checkbox', checked: settings.paused, click: (i) => update({ paused: i.checked }) },
    { label: 'Uyumni tozalash', click: () => broadcast('clear') },
    { type: 'separator' },
    { label: 'Kompyuter yoqilganda ishga tushirish', type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin, click: (i) => app.setLoginItemSettings({ openAtLogin: i.checked }) },
    { label: 'Chiqish', click: () => app.quit() },
  ]));
}

app.whenReady().then(() => {
  try { settings = { ...defaults, ...JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) }; } catch {}
  if (process.platform === 'darwin') app.dock?.hide();
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Snow Flake UZ');
  buildMenu();
  createOverlays();

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
