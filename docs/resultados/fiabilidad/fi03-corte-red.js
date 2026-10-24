const net = require('net');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const API = 'M:/Documentos/prog/Pro Web/BRASAS/apps/api';
const REAL = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT) };
let cut = false; const socks = new Set();
net.createServer((c) => {
  if (cut) return c.destroy();
  const u = net.connect(REAL); socks.add(c); socks.add(u);
  c.pipe(u); u.pipe(c);
  const done = () => { c.destroy(); u.destroy(); socks.delete(c); socks.delete(u); };
  c.on('error', done); u.on('error', done); c.on('close', done); u.on('close', done);
}).listen(65432, '127.0.0.1');
const get = (path, tok) => new Promise((res) => {
  const r = http.get({ host: 'localhost', port: 3001, path, headers: tok ? { Authorization: 'Bearer ' + tok } : {}, timeout: 25000 }, (x) => { x.resume(); res(x.statusCode); });
  r.on('error', (e) => res('ERR ' + e.code)); r.on('timeout', () => { r.destroy(); res('TIMEOUT'); });
});
const login = () => new Promise((res) => {
  const b = JSON.stringify({ email: 'jefe.e2e@brasas.test', password: 'Clave123*' });
  const r = http.request({ host: 'localhost', port: 3001, path: '/api/v1/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (x) => { let d = ''; x.on('data', (c) => d += c); x.on('end', () => res(JSON.parse(d).token)); });
  r.write(b); r.end();
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = fs.openSync('C:/sq/fi03-api.log', 'w');
const child = spawn(process.execPath, ['src/server.js'], { cwd: API, env: { ...process.env, DB_HOST: '127.0.0.1', DB_PORT: '65432', PORT: '3001' }, stdio: ['ignore', out, out] });
let alive = true; child.on('exit', (c) => { alive = false; console.log('PROCESO DE LA API TERMINÓ, código', c); });
const stamp = () => new Date().toISOString().slice(11, 23);
(async () => {
  await sleep(8000);
  const tok = await login();
  for (let i = 0; i < 6; i++) await get('/api/v1/productos', tok);
  console.log(stamp(), 'línea base:', await get('/api/v1/productos', tok));
  cut = true; for (const s of socks) s.destroy();
  const tCut = Date.now();
  console.log(stamp(), 'CORTE DE RED (se destruyen las conexiones a la BD)');
  for (let i = 0; i < 12; i++) { console.log(stamp(), 'durante el corte:', await get('/api/v1/productos', tok)); await sleep(1000); }
  cut = false; const tBack = Date.now();
  console.log(stamp(), 'RED RESTABLECIDA');
  let mttr = null;
  for (let i = 0; i < 60; i++) { const s = await get('/api/v1/productos', tok); console.log(stamp(), 'tras restablecer:', s); if (s === 200) { mttr = (Date.now() - tBack) / 1000; break; } await sleep(1000); }
  console.log(stamp(), JSON.stringify({ api_viva: alive, mttr_s: mttr, corte_s: ((tBack - tCut) / 1000).toFixed(1) }));
  child.kill(); process.exit(0);
})();
