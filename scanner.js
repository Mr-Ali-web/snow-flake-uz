// Ochiq oynalar joylashuvini doimiy fon jarayoni orqali oladi (native modulsiz)
const { spawn } = require('child_process');
const path = require('path');
const unpacked = (p) => p.replace('app.asar', 'app.asar.unpacked');

function start(onRects) {
  let cmd, args;
  if (process.platform === 'win32') {
    cmd = 'powershell.exe';
    args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', unpacked(path.join(__dirname, 'scripts', 'windows.ps1')), String(process.pid)];
  } else if (process.platform === 'darwin') {
    cmd = 'osascript';
    args = ['-l', 'JavaScript', unpacked(path.join(__dirname, 'scripts', 'mac.js')), String(process.pid)];
  } else return () => {};
  const child = spawn(cmd, args, { windowsHide: true });
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d; const lines = buf.split('\n'); buf = lines.pop();
    const line = lines.pop();
    if (line) { try { onRects(JSON.parse(line)); } catch {} }
  });
  child.on('error', () => {});
  return () => child.kill();
}
module.exports = { start };
