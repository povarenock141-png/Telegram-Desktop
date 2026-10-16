// Блатной блокнот — помощник на компьютере.
// Что делает:
//  1) сохраняет дела, заметки и лист из блокнота в папку «Рабочий стол\Блатной блокнот»;
//  2) по просьбе из блокнота ищет файлы на ноутбуке (Рабочий стол, Документы, Загрузки) и открывает найденное.
// Связь — через ту же зашифрованную синхронизацию, что у блокнота (ключ из ссылки синхронизации).
// Команды извне ограничены: только «найти по названию» и «открыть файл из последнего поиска». Ничего не удаляет и не запускает сам.
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const VERSION = '1';
const subtle = webcrypto.subtle;
const DIR = path.dirname(fileURLToPath(import.meta.url));
const CFG_FILE = path.join(DIR, 'config.json');
const LOG_FILE = path.join(DIR, 'agent.log');
const LOCK_FILE = path.join(DIR, 'agent.lock');
const BASE = process.env.PC_BASE || 'https://textdb.dev/api/data/';
const HOME = process.env.PC_HOME || os.homedir();

function log(...a) {
  const line = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' ' + a.join(' ') + '\n';
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 512 * 1024) fs.renameSync(LOG_FILE, LOG_FILE + '.old');
    fs.appendFileSync(LOG_FILE, line);
  } catch { /* лог не критичен */ }
  if (process.stdout.isTTY) process.stdout.write(line);
}

/* ---------- один экземпляр ---------- */
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
try {
  const old = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
  if (old && old !== process.pid && alive(old)) { log('уже запущен, pid', old); process.exit(3); }
} catch { /* нет замка */ }
fs.writeFileSync(LOCK_FILE, String(process.pid));
const unlock = () => { try { if (fs.readFileSync(LOCK_FILE, 'utf8') === String(process.pid)) fs.unlinkSync(LOCK_FILE); } catch { /* */ } };
process.on('exit', unlock);
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

/* ---------- настройки ---------- */
function readCfg() { try { return JSON.parse(fs.readFileSync(CFG_FILE, 'utf8')); } catch { return {}; } }
const LINK_RE = /#sync=(dela-[A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{40,})/;
let cfg = readCfg();
const m = String(cfg.link || process.env.PC_LINK || '').match(LINK_RE);
if (!m) { log('нет ссылки синхронизации в config.json — нечего делать'); process.exit(2); }
const SYNC_ID = m[1], KEY_B64 = m[2];

function pickDesktop() {
  const cands = [process.env.PC_DESKTOP, path.join(HOME, 'Desktop'), path.join(HOME, 'OneDrive', 'Desktop'), path.join(HOME, 'OneDrive', 'Рабочий стол')].filter(Boolean);
  return cands.find((p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } }) || HOME;
}
const DESKTOP = pickDesktop();
const OUT = path.join(DESKTOP, 'Блатной блокнот');
const NOTES = path.join(OUT, 'Заметки');
const ROOTS = [DESKTOP, path.join(HOME, 'Documents'), path.join(HOME, 'Downloads'), path.join(HOME, 'OneDrive', 'Documents')]
  .filter((p, i, a) => a.indexOf(p) === i && fs.existsSync(p));

/* ---------- шифрование, как в блокноте ---------- */
const b64 = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (t) => new Uint8Array(Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
let keyP = null;
const key = () => keyP || (keyP = subtle.importKey('raw', unb64(KEY_B64), 'AES-GCM', false, ['encrypt', 'decrypt']));
async function enc(obj) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(JSON.stringify(obj)));
  return 'dela1.' + b64(iv) + '.' + b64(ct);
}
async function dec(text) {
  const p = (text || '').trim().split('.');
  if (p.length !== 3 || p[0] !== 'dela1') return null;
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(p[1]) }, await key(), unb64(p[2]));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function getDoc(id) {
  const r = await fetch(BASE + id, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('хранилище ответило ' + r.status);
  const t = await r.text();
  return t ? dec(t) : null;
}
async function putDoc(id, obj) {
  const r = await fetch(BASE + id, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: await enc(obj) });
  if (!r.ok) throw new Error('запись не прошла: ' + r.status);
}

/* ---------- 1. выгрузка блокнота в папку ---------- */
const safe = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Заметка';
function writeIfChanged(file, content) {
  try { if (fs.readFileSync(file, 'utf8') === content) return false; } catch { /* нет файла */ }
  fs.writeFileSync(file, content, 'utf8'); return true;
}
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (ms) => { const d = new Date(ms); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const KIND = { task: 'задача', deal: 'дело', duty: 'обязанность' };
function isDone(t) { return t.daily ? t.doneOn === today() : !!t.done; }
function exportAll(S) {
  fs.mkdirSync(NOTES, { recursive: true });
  let changed = 0;
  const notes = (S.notes || []).filter((n) => n && typeof n.id === 'string' && !n.demo);
  const keep = new Set();
  for (const n of notes) {
    const name = safe(n.title) + ' (' + n.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 10) + ').txt';
    keep.add(name);
    const body = (n.title ? n.title + '\r\n' : '') + (n.created ? fmtDate(n.created) + '\r\n' : '') + '\r\n' + String(n.body || '').replace(/\r?\n/g, '\r\n') + '\r\n';
    if (writeIfChanged(path.join(NOTES, name), body)) changed++;
  }
  for (const f of fs.readdirSync(NOTES)) {
    if (/\([A-Za-z0-9]{1,10}\)\.txt$/.test(f) && !keep.has(f)) {
      fs.mkdirSync(path.join(NOTES, 'Удалённые'), { recursive: true });
      try { fs.renameSync(path.join(NOTES, f), path.join(NOTES, 'Удалённые', f)); changed++; } catch { /* занят */ }
    }
  }
  const tasks = (S.tasks || []).filter((t) => t && typeof t.title === 'string' && !t.demo);
  const line = (t) => '  ' + (isDone(t) ? '[x] ' : '[ ] ') + t.title + ' — ' + (KIND[t.kind] || 'дело') + (t.daily ? ', каждый день' : t.date ? ', ' + t.date.split('-').reverse().join('.') : '') + (t.time ? ', в ' + t.time : '') + (t.due ? ', до ' + t.due : '');
  const d = today();
  const now = tasks.filter((t) => !isDone(t) && (t.daily || t.date <= d));
  const later = tasks.filter((t) => !isDone(t) && !t.daily && t.date > d);
  const done = tasks.filter(isDone).slice(0, 30);
  const txt = ['Блатной блокнот — дела', 'Обновлено: ' + fmtDate(Date.now()), '', 'Сегодня и просрочено (' + now.length + '):', ...now.map(line), '', 'Позже (' + later.length + '):', ...later.map(line), '', 'Выполнено (последние):', ...done.map(line), ''].join('\r\n');
  const prev = (() => { try { return fs.readFileSync(path.join(OUT, 'Дела.txt'), 'utf8').replace(/^Обновлено: .*$/m, ''); } catch { return ''; } })();
  if (prev !== txt.replace(/^Обновлено: .*$/m, '')) { fs.writeFileSync(path.join(OUT, 'Дела.txt'), txt, 'utf8'); changed++; }
  const sk = S.sketch && Array.isArray(S.sketch.strokes) ? S.sketch.strokes : [];
  if (sk.length) {
    const paths = sk.map((s) => {
      const p = s.p || []; if (p.length < 2) return '';
      let dd = 'M' + p[0] + ' ' + p[1]; for (let i = 2; i < p.length; i += 2) dd += ' L' + p[i] + ' ' + p[i + 1];
      if (s.t === 'eraser') return '<path d="' + dd + '" stroke="#FFFDF6" stroke-width="' + s.w + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      if (s.t === 'marker') return '<path d="' + dd + '" stroke="#8A8A3A" stroke-opacity=".35" stroke-width="' + s.w + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      return '<path d="' + dd + '" stroke="#1C1A3A" stroke-width="' + s.w + '" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    }).join('\n');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1400" width="1000" height="1400"><rect width="1000" height="1400" fill="#FFFDF6"/>\n' + paths + '\n</svg>\n';
    if (writeIfChanged(path.join(OUT, 'Лист.svg'), svg)) changed++;
  }
  return changed;
}

/* ---------- 2. поиск и открытие файлов ---------- */
const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');
const SKIP = new Set(['node_modules', '.venv', 'venv', '__pycache__', '.git', 'AppData', '$RECYCLE.BIN', 'System Volume Information']);
function search(q) {
  const words = norm(q).split(/[\s,.;]+/).filter((w) => w.length > 1);
  if (!words.length) return [];
  const hits = []; let seen = 0;
  const walk = (dir, depth) => {
    if (depth > 6 || seen > 60000) return;
    let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      if (seen++ > 60000) return;
      if (e.name.startsWith('.') || e.name.startsWith('~$') || SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { walk(full, depth + 1); continue; }
      if (!e.isFile()) continue;
      const n = norm(e.name);
      if (words.every((w) => n.includes(w))) {
        let st; try { st = fs.statSync(full); } catch { continue; }
        hits.push({ full, name: e.name, mtime: st.mtimeMs, size: st.size });
      }
    }
  };
  for (const r of ROOTS) walk(r, 0);
  hits.sort((a, b) => b.mtime - a.mtime);
  return hits.slice(0, 15);
}
const tokens = new Map();
function tokenFor(full) { const t = webcrypto.getRandomValues(new Uint8Array(6)); const id = b64(t); tokens.set(id, full); if (tokens.size > 300) tokens.delete(tokens.keys().next().value); return id; }
function where(full) { const rel = path.relative(HOME, path.dirname(full)); return rel.startsWith('..') ? path.dirname(full) : rel.replace(/^Desktop/, 'Рабочий стол').replace(/^Documents/, 'Документы').replace(/^Downloads/, 'Загрузки'); }
function openFile(full) {
  if (process.env.PC_OPEN_LOG) { fs.appendFileSync(process.env.PC_OPEN_LOG, full + '\n'); return; }
  if (process.platform === 'win32') spawn('explorer.exe', [full], { detached: true, stdio: 'ignore' }).unref();
  else spawn('xdg-open', [full], { detached: true, stdio: 'ignore' }).unref();
}

/* ---------- цикл ---------- */
const Q_ID = SYNC_ID + '-pcq', R_ID = SYNC_ID + '-pcr';
let results = [], doneIds = new Set(), lastBeat = 0, lastExport = 0, startedAt = Date.now();
async function writeStatus() {
  results = results.slice(-12);
  await putDoc(R_ID, { v: 1, agent: VERSION, host: os.hostname(), seen: Date.now(), folder: OUT, res: results });
  lastBeat = Date.now();
}
async function tickRequests() {
  const Q = await getDoc(Q_ID);
  const reqs = (Q && Array.isArray(Q.reqs) ? Q.reqs : []).filter((r) => r && typeof r.id === 'string' && !doneIds.has(r.id) && r.at > startedAt - 10 * 60e3);
  let any = false;
  for (const r of reqs.slice(-5)) {
    doneIds.add(r.id); any = true;
    try {
      if (r.kind === 'find' && typeof r.q === 'string') {
        const hits = search(r.q.slice(0, 80));
        results.push({ id: r.id, kind: 'find', ok: true, q: r.q.slice(0, 80), items: hits.map((h) => ({ t: tokenFor(h.full), name: h.name, dir: where(h.full), size: h.size, mtime: h.mtime })) });
        log('поиск «' + r.q + '»: ' + hits.length);
      } else if (r.kind === 'open' && typeof r.t === 'string') {
        const full = tokens.get(r.t);
        if (!full || !fs.existsSync(full)) results.push({ id: r.id, kind: 'open', ok: false, err: 'файл не найден — повтори поиск' });
        else { openFile(full); results.push({ id: r.id, kind: 'open', ok: true, name: path.basename(full) }); log('открыл', full); }
      } else results.push({ id: r.id, kind: r.kind, ok: false, err: 'неизвестная команда' });
    } catch (e) { results.push({ id: r.id, kind: r.kind, ok: false, err: String(e.message || e).slice(0, 120) }); }
  }
  if (any || Date.now() - lastBeat > 30e3) await writeStatus();
}
async function tickExport() {
  const S = await getDoc(SYNC_ID);
  if (S) { const n = exportAll(S); if (n) log('обновлено файлов:', n); }
  lastExport = Date.now();
}
log('старт, версия', VERSION, '· папка', OUT, '· ищу в', ROOTS.join(' | '));
let busy = false;
async function loop() {
  if (busy) return; busy = true;
  try { await tickRequests(); } catch (e) { log('ошибка запросов:', e.message || e); }
  try { if (Date.now() - lastExport > 20e3) await tickExport(); } catch (e) { log('ошибка выгрузки:', e.message || e); }
  busy = false;
}
loop();
setInterval(loop, Number(process.env.PC_TICK || 4000));
