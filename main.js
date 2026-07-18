const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const ROOT_DIR = __dirname;
const WEB_DIR = path.join(ROOT_DIR, 'app');
const CONFIG_PATH = path.join(ROOT_DIR, 'desktop-config.json');

function readConfig() {
  const fallback = {
    dataUrl: '',
    windowTitle: 'موجودی کالا',
    windowWidth: 1180,
    windowHeight: 820
  };
  try {
    if (!fs.existsSync(CONFIG_PATH)) return fallback;
    return { ...fallback, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
  } catch (err) {
    return fallback;
  }
}

const config = readConfig();

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8'
  }[ext] || 'application/octet-stream';
}

function safeLocalPath(requestPath) {
  let decoded;
  try { decoded = decodeURIComponent(requestPath.split('?')[0]); } catch (_) { decoded = '/'; }
  if (decoded === '/') decoded = '/index.html';
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, '');
  const target = path.join(WEB_DIR, normalized);
  if (!target.startsWith(WEB_DIR)) return null;
  return target;
}

function proxyJsonFromServer(res) {
  if (!config.dataUrl) return false;
  let parsed;
  try { parsed = new URL(config.dataUrl); } catch (_) { return false; }
  const client = parsed.protocol === 'http:' ? http : https;
  const req = client.get(parsed, { headers: { 'Cache-Control': 'no-store' } }, upstream => {
    if (upstream.statusCode && upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
      res.writeHead(302, { Location: upstream.headers.location });
      res.end();
      return;
    }
    if (upstream.statusCode !== 200) {
      res.writeHead(upstream.statusCode || 502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('خطا در دریافت فایل latest.json از سرور');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' });
    upstream.pipe(res);
  });
  req.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('اتصال به سرور بروزرسانی برقرار نشد');
  });
  req.setTimeout(15000, () => req.destroy());
  return true;
}

function startLocalServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, 'http://127.0.0.1');

      if (reqUrl.pathname === '/data/latest.json' && proxyJsonFromServer(res)) {
        return;
      }

      const localPath = safeLocalPath(reqUrl.pathname);
      if (!localPath || !fs.existsSync(localPath) || fs.statSync(localPath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const headers = { 'Content-Type': contentType(localPath) };
      if (localPath.endsWith(path.join('data', 'latest.json'))) {
        headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      }
      res.writeHead(200, headers);
      fs.createReadStream(localPath).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function createWindow() {
  const server = await startLocalServer();
  const port = server.address().port;

  const win = new BrowserWindow({
    width: Number(config.windowWidth) || 1180,
    height: Number(config.windowHeight) || 820,
    minWidth: 900,
    minHeight: 650,
    title: config.windowTitle || 'موجودی کالا',
    icon: path.join(WEB_DIR, 'assets', 'favicon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#1a120f',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  await win.loadURL(`http://127.0.0.1:${port}/index.html`);
  win.on('closed', () => server.close());
}

app.whenReady().then(createWindow).catch(err => {
  dialog.showErrorBox('خطا در اجرای برنامه', String(err && err.message ? err.message : err));
  app.quit();
});

app.on('window-all-closed', () => app.quit());

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
