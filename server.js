/**
 * 零依赖静态服务器：托管 dist/ 构建产物，支持局域网 IP 访问。
 *
 * 为什么不直接双击 dist/index.html？ES Module 脚本、模块 Worker、WASM 加载
 * 以及 OPFS 存储都要求 HTTP 源（file:// 下会被浏览器拦截），因此构建产物
 * 必须通过 HTTP 访问——任何静态服务器都可以，本文件只是零配置的默认选项。
 *
 * 用法：node server.js [--no-open]   （PORT 环境变量可覆盖默认端口 4173）
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const PORT = Number(process.env.PORT) || 4173;
const NO_OPEN = process.argv.includes('--no-open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let filePath = normalize(join(ROOT, urlPath));
    // 防目录穿越：解析后必须仍在 dist 内
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let data;
    try {
      data = await readFile(filePath);
    } catch {
      filePath = join(ROOT, 'index.html'); // 目录或未知路径回退到入口页
      data = await readFile(filePath);
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(500).end('Internal Server Error');
  }
});

function printAddresses() {
  // 控制台输出保持 ASCII：双击 bat 启动时 cmd 窗口是 GBK 代码页，UTF-8 中文会乱码
  console.log('\nKanban server started (serving dist/):');
  console.log(`  Local:   http://localhost:${PORT}`);
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list ?? []) {
      if (ni.family === 'IPv4' && !ni.internal) {
        console.log(`  Network: http://${ni.address}:${PORT}`);
      }
    }
  }
  console.log('\nPress Ctrl+C to stop.');
}

function openBrowser() {
  const url = `http://localhost:${PORT}`;
  try {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
  } catch {
    // 打开浏览器失败不影响服务，地址已打印在控制台
  }
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Close the program using it, or run on another port: PORT=4174 node server.js`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '0.0.0.0', () => {
  printAddresses();
  if (!NO_OPEN) openBrowser();
});
