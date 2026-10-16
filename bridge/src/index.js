// Мост «Блатного блокнота»: почта Gmail (только чтение). Один хозяин, доступ по токену блокнота.
const ORIGIN = 'https://povarenock141-png.github.io';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const enc = new TextEncoder();

function cors(extra) {
  return Object.assign({
    'access-control-allow-origin': ORIGIN,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  }, extra || {});
}
const json = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: cors() });
const page = (title, text, ok) => new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + title + '</title>' +
  '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F6F3EA;color:#1C1A3A;font:18px/1.45 system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box">' +
  '<div><div style="font-size:44px">' + (ok ? '✓' : '!') + '</div><h1 style="font-size:22px;margin:8px 0">' + title + '</h1><p>' + text + '</p></div></body>', { status: ok ? 200 : 400, headers: { 'content-type': 'text/html; charset=utf-8' } });

async function sha(t) { const h = await crypto.subtle.digest('SHA-256', enc.encode(t)); return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function rnd(n) { const a = crypto.getRandomValues(new Uint8Array(n)); return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function authed(req, env) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer\s+([A-Za-z0-9_-]{32,})$/);
  if (!m) return false;
  return (await env.BRIDGE.get('tok:' + await sha(m[1]))) === '1';
}
async function accessToken(env) {
  const cached = await env.BRIDGE.get('google:access', 'json');
  if (cached && cached.exp > Date.now() + 60e3) return cached.token;
  const g = await env.BRIDGE.get('google', 'json');
  if (!g || !g.refresh) throw new Error('почта не подключена');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: g.refresh, grant_type: 'refresh_token' })
  });
  const j = await r.json();
  if (!r.ok) {
    if (j.error === 'invalid_grant') { await env.BRIDGE.delete('google'); throw new Error('доступ к почте отозван — подключи заново'); }
    throw new Error('Google: ' + (j.error_description || j.error || r.status));
  }
  await env.BRIDGE.put('google:access', JSON.stringify({ token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }), { expirationTtl: 3600 });
  return j.access_token;
}
async function gmail(env, path) {
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + path, { headers: { authorization: 'Bearer ' + await accessToken(env) } });
  const j = await r.json();
  if (!r.ok) throw new Error('Gmail: ' + ((j.error && j.error.message) || r.status));
  return j;
}
function header(msg, name) { const h = (msg.payload && msg.payload.headers || []).find((x) => x.name.toLowerCase() === name); return h ? h.value : ''; }

export default {
  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
    try {
      if (p === '/health') return json({ ok: true, bridge: 'bloknot', v: 2, google: !!env.GOOGLE_CLIENT_ID, kv: !!env.BRIDGE, at: Date.now() });

      /* подключение: блокнот открывает /google/start?t=<свой токен> */
      if (p === '/google/start') {
        const t = url.searchParams.get('t') || '';
        if (!/^[A-Za-z0-9_-]{32,}$/.test(t)) return page('Ссылка неверная', 'Открой подключение почты из блокнота ещё раз.', false);
        if (!env.GOOGLE_CLIENT_ID) return page('Мост ещё не настроен', 'Нет настроек Google. Напиши Claude.', false);
        const nonce = rnd(18);
        await env.BRIDGE.put('nonce:' + nonce, await sha(t), { expirationTtl: 900 });
        const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: url.origin + '/google/callback', response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: nonce });
        return Response.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + q, 302);
      }
      if (p === '/google/callback') {
        const err = url.searchParams.get('error');
        if (err) return page('Почта не подключена', 'Google ответил: ' + esc(err) + '. Можно попробовать ещё раз из блокнота.', false);
        const nonce = url.searchParams.get('state') || '', code = url.searchParams.get('code') || '';
        const h = await env.BRIDGE.get('nonce:' + nonce);
        if (!h || !code) return page('Ссылка устарела', 'Открой подключение почты из блокнота ещё раз.', false);
        await env.BRIDGE.delete('nonce:' + nonce);
        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: url.origin + '/google/callback', grant_type: 'authorization_code' })
        });
        const j = await r.json();
        if (!r.ok || !j.refresh_token) return page('Почта не подключена', 'Google не выдал доступ: ' + esc(j.error_description || j.error || 'нет refresh_token') + '.', false);
        await env.BRIDGE.put('google:access', JSON.stringify({ token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }), { expirationTtl: 3600 });
        let email = '';
        try { const pr = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { authorization: 'Bearer ' + j.access_token } }); email = (await pr.json()).emailAddress || ''; } catch { /* без адреса */ }
        await env.BRIDGE.put('google', JSON.stringify({ refresh: j.refresh_token, email, at: Date.now() }));
        await env.BRIDGE.put('tok:' + h, '1');
        return page('Почта подключена', esc(email) + '<br>Вернись в Блатной блокнот — письма появятся там.', true);
      }

      /* дальше — только для блокнота с токеном */
      if (p.startsWith('/mail')) {
        if (!(await authed(req, env))) return json({ ok: false, error: 'нет доступа' }, 401);
        if (p === '/mail/status') { const g = await env.BRIDGE.get('google', 'json'); return json({ ok: true, connected: !!(g && g.refresh), email: g ? g.email : '' }); }
        if (p === '/mail/disconnect' && req.method === 'POST') { await env.BRIDGE.delete('google'); await env.BRIDGE.delete('google:access'); return json({ ok: true }); }
        if (p === '/mail') {
          const hours = Math.min(168, Math.max(1, parseInt(url.searchParams.get('h') || '24', 10) || 24));
          const list = await gmail(env, 'messages?maxResults=20&q=' + encodeURIComponent('in:inbox newer_than:' + Math.ceil(hours / 24) + 'd -category:promotions -category:social'));
          const ids = (list.messages || []).slice(0, 15).map((m) => m.id);
          const msgs = await Promise.all(ids.map((id) => gmail(env, 'messages/' + id + '?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date').catch(() => null)));
          const g = await env.BRIDGE.get('google', 'json');
          const items = msgs.filter(Boolean).map((m) => ({
            id: m.id, from: header(m, 'from').replace(/\s*<[^>]+>/, '').replace(/"/g, '').slice(0, 80), subject: header(m, 'subject').slice(0, 160),
            date: Number(m.internalDate) || 0, snippet: String(m.snippet || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').slice(0, 240),
            unread: (m.labelIds || []).includes('UNREAD')
          }));
          return json({ ok: true, email: g ? g.email : '', items });
        }
      }
      return json({ ok: false, error: 'not found' }, 404);
    } catch (e) {
      return json({ ok: false, error: String(e && e.message || e).slice(0, 200) }, 502);
    }
  }
};
