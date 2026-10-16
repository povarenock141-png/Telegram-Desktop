// Подготовка моста: хранилище KV и ключи Google из скачанного файла client_secret*.json
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const run = (cmd, input) => cp.execSync(cmd, { encoding: 'utf8', input, stdio: [input ? 'pipe' : 'inherit', 'pipe', 'pipe'], shell: true });
let toml = fs.readFileSync('wrangler.toml', 'utf8');
if (!/kv_namespaces/.test(toml)) {
  console.log('Создаю хранилище...');
  let out = '';
  try { out = run('npx --yes wrangler kv namespace create BRIDGE'); } catch (e) { out = String(e.stdout || '') + String(e.stderr || ''); }
  let id = (out.match(/[0-9a-f]{32}/) || [])[0];
  if (!id) {
    try { const ls = run('npx --yes wrangler kv namespace list'); const arr = JSON.parse(ls.slice(ls.indexOf('['))); const f = arr.find((x) => /BRIDGE/.test(x.title)); if (f) id = f.id; } catch (e) { /* */ }
  }
  if (!id) { console.log(out); console.log('[!] Не получилось создать хранилище'); process.exit(1); }
  toml += '\n[[kv_namespaces]]\nbinding = "BRIDGE"\nid = "' + id + '"\n';
  fs.writeFileSync('wrangler.toml', toml);
  console.log('Хранилище готово.');
}
const dl = path.join(os.homedir(), 'Downloads');
let files = [];
try { files = fs.readdirSync(dl).filter((f) => /^client_secret.*\.json$/i.test(f)).map((f) => path.join(dl, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs); } catch (e) { /* */ }
if (files.length && !fs.existsSync('google.done')) {
  const j = JSON.parse(fs.readFileSync(files[0], 'utf8')); const w = j.web || j.installed || {};
  if (w.client_id && w.client_secret) {
    console.log('Записываю ключи Google в мост...');
    run('npx --yes wrangler secret put GOOGLE_CLIENT_ID', w.client_id);
    run('npx --yes wrangler secret put GOOGLE_CLIENT_SECRET', w.client_secret);
    fs.writeFileSync('google.done', new Date().toISOString());
    console.log('Ключи Google записаны.');
  }
} else if (!fs.existsSync('google.done')) console.log('Файл client_secret*.json в Загрузках не найден — ключи Google пока не записаны.');
