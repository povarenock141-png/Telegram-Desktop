(function () {
  'use strict';

  /* ---------- утилиты ---------- */
  var KEY = 'dela.v1';
  var ORB = null;
  /* постоянный адрес приложения: ссылки синхронизации всегда ведут сюда */
  var CANON = 'https://povarenock141-png.github.io/Telegram-Desktop/dela/';
  var OLD_HOST = location.hostname === 'raw.githack.com';
  var APP_VERSION = '21';
  var KINDS = { task: 'задача', deal: 'дело', duty: 'обязанность' };
  var KINDS_ACC = { task: 'задачу', deal: 'дело', duty: 'обязанность' };
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var WD = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  var WD_ACC = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
  var STICKER_COLORS = ['#F2E9A8', '#DCE5C4', '#E6DDF0'];
  var ROTS = [-3, 2, -1.5, 1.5];

  function pad(n) { return String(n).padStart(2, '0'); }
  function dstr(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return dstr(new Date()); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return dstr(d); }
  function toMin(t) { var p = t.split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }
  function fromMin(m) { m = (m + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function nowMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function dur(m) { var h = Math.floor(m / 60), mm = m % 60; return (h ? h + ' ч ' : '') + mm + ' мин'; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function cap(s) { s = s.trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function nextWeekday(wd) { var d = new Date(); var diff = (wd - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + diff); return dstr(d); }
  function dateLabel(s) {
    var t = today();
    if (s === t) return 'сегодня';
    if (s === addDays(t, 1)) return 'завтра';
    if (s === addDays(t, -1)) return 'вчера';
    var d = new Date(s + 'T12:00:00');
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }
  function pluralDel(n) { var a = n % 10, b = n % 100; if (a === 1 && b !== 11) return 'дело'; if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'дела'; return 'дел'; }

  /* ---------- данные ---------- */
  function seed() {
    var t = today();
    return {
      tasks: [
        { id: uid(), title: 'Проверка заготовок на смене', kind: 'duty', daily: true, date: t, time: '08:30', due: '', remind: true, demo: true },
        { id: uid(), title: 'Заказ поставщику рыбы', kind: 'deal', date: t, time: '', due: '11:00', remind: true, demo: true },
        { id: uid(), title: 'Техкарта нового блюда', kind: 'task', date: t, time: '', due: '14:00', remind: true, demo: true },
        { id: uid(), title: 'Ответить на письма', kind: 'deal', date: t, time: '', due: '', remind: false, demo: true },
        { id: uid(), title: 'Планёрка с су-шефами', kind: 'duty', date: t, time: '16:00', due: '', remind: true, demo: true },
        { id: uid(), title: 'Инвентаризация', kind: 'duty', date: nextWeekday(5), time: '', due: '', remind: false, demo: true }
      ],
      notes: [
        { id: uid(), title: 'Идея для сезонного меню', body: 'Тартар из осетра с ферментированной сливой. Найти поставщика сливы. Посчитать себестоимость.', created: Date.now(), pinned: true, converted: [], demo: true },
        { id: uid(), title: 'Ножи на заточку', body: 'Ножи на заточку — утром отдать', created: Date.now() - 3600e3, pinned: true, converted: [], demo: true }
      ],
      place: 'Novikov',
      fired: {},
      seeded: true
    };
  }
  var S;
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !S.tasks) S = seed();
  S.fired = S.fired || {};
  S.del = S.del || {};
  function store() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* хранилище недоступно */ } }
  function save() { stamp(); store(); if (window.DelaSync) window.DelaSync.schedule(); }

  /* ---------- метки изменений для синхронизации ---------- */
  var snap = {};
  function bare(x) { var c = {}; for (var k in x) if (k !== 'u') c[k] = x[k]; return JSON.stringify(c); }
  function metaStr() { return JSON.stringify({ place: S.place || '', aiKey: S.aiKey || '' }); }
  function takeSnap() {
    snap = {};
    S.tasks.concat(S.notes).forEach(function (x) { snap[x.id] = bare(x); });
    snap.__meta = metaStr();
  }
  function stamp() {
    var now = Date.now(), seen = {};
    S.del = S.del || {};
    S.tasks.concat(S.notes).forEach(function (x) {
      seen[x.id] = 1;
      var j = bare(x);
      if (snap[x.id] !== j) { x.u = now; snap[x.id] = j; if (S.del[x.id]) delete S.del[x.id]; }
    });
    Object.keys(snap).forEach(function (id) {
      if (id !== '__meta' && !seen[id]) { S.del[id] = now; delete snap[id]; }
    });
    var m = metaStr();
    if (snap.__meta !== m) { S.metaU = now; snap.__meta = m; }
  }
  /* чужие данные проверяем на входе: только объекты с id и текстом */
  function validList(a, field) {
    return (Array.isArray(a) ? a : []).filter(function (x) { return x && typeof x === 'object' && typeof x.id === 'string' && x.id.length < 40 && typeof x[field] === 'string'; });
  }
  function validSketch(x) {
    if (!x || typeof x !== 'object' || !Array.isArray(x.strokes) || typeof x.u !== 'number') return null;
    var strokes = x.strokes.filter(function (s) {
      return s && (s.t === 'pen' || s.t === 'marker' || s.t === 'eraser') && typeof s.w === 'number' && Array.isArray(s.p) && s.p.length >= 2 && s.p.length % 2 === 0 && s.p.every(function (v) { return typeof v === 'number' && isFinite(v); });
    }).slice(0, 4000);
    return { strokes: strokes, u: x.u };
  }
  function mergeRemote(R) {
    var del = Object.assign({}, R.del || {});
    Object.keys(S.del || {}).forEach(function (id) { del[id] = Math.max(del[id] || 0, S.del[id]); });
    var cutoff = Date.now() - 60 * 864e5;
    Object.keys(del).forEach(function (id) { if (del[id] < cutoff) delete del[id]; });
    function un(a, b) {
      var map = {};
      (b || []).concat(a || []).forEach(function (x) {
        var cur = map[x.id];
        if (!cur || (x.u || 0) > (cur.u || 0)) {
          if (cur) { for (var k in cur) delete cur[k]; Object.assign(cur, x); } else map[x.id] = x;
        }
      });
      var order = (b || []).concat(a || []).map(function (x) { return x.id; });
      var out = [], used = {};
      order.forEach(function (id) {
        var x = map[id];
        if (!x || used[id]) return;
        used[id] = 1;
        if (del[id] && del[id] >= (x.u || 0)) return;
        out.push(x);
      });
      return out;
    }
    S.tasks = un(validList(R.tasks, 'title'), S.tasks);
    S.notes = un(validList(R.notes, 'body'), S.notes);
    S.del = del;
    if ((R.metaU || 0) > (S.metaU || 0)) { S.place = R.place; S.aiKey = R.aiKey; S.metaU = R.metaU; }
    var rs = validSketch(R.sketch);
    if (rs && rs.u > ((S.sketch && S.sketch.u) || 0)) S.sketch = rs;
    takeSnap(); store();
  }
  function payload() {
    return { v: 1, tasks: S.tasks, notes: S.notes, del: S.del || {}, place: S.place, aiKey: S.aiKey || '', metaU: S.metaU || 0, sketch: S.sketch || { strokes: [], u: 0 }, at: Date.now() };
  }
  takeSnap();

  var UI = { filter: 'today', plan: false, reply: '', heard: '', mode: 'idle', toastFor: null, editing: null, sheetKind: 'task', sheetWhen: 'today' };

  /* ---------- логика дел ---------- */
  function isDone(t) { return t.daily ? t.doneOn === today() : !!t.done; }
  function isToday(t) { var d = today(); return t.daily || t.date === d || (t.date < d && !isDone(t)); }
  function refTime(t) { return t.due || t.time || ''; }
  function todayTasks() { return S.tasks.filter(isToday); }
  function meta(t) {
    var p = [KINDS[t.kind]];
    if (t.daily) p.push('ежедневно');
    else if (t.date !== today()) p.push(dateLabel(t.date));
    if (t.time) p.push('в ' + t.time);
    if (t.due) p.push('до ' + t.due);
    if (t.voice) p.push('голосом');
    return p.join(' · ');
  }
  function alertOf(t) {
    if (isDone(t)) return null;
    var d = today();
    if (!t.daily && t.date < d) return { text: 'Перенесено с ' + dateLabel(t.date), late: true };
    if (!t.daily && t.date !== d) return null;
    var r = refTime(t); if (!r) return null;
    var diff = toMin(r) - nowMin();
    if (diff < 0) return { text: 'Срок прошёл ' + dur(-diff) + ' назад', late: true };
    if (diff <= 180) return { text: 'Осталось ' + dur(diff) + (t.remind ? ' · напомню за 15 мин' : ''), late: false };
    if (t.remind) return { text: 'Напомню в ' + fromMin(toMin(r) - 15), late: false };
    return null;
  }
  function planList() {
    return todayTasks().filter(function (t) { return !isDone(t); }).map(function (t) {
      var k = t.time ? toMin(t.time) : t.due ? toMin(t.due) - 60 : 2000;
      var why = t.time ? 'Фиксированное время' : t.due ? 'Срок до ' + t.due + (toMin(t.due) - nowMin() < 120 ? ' — горит' : '') : 'В свободное окно';
      if (!t.daily && t.date < today()) { k -= 3000; why = 'Хвост с ' + dateLabel(t.date) + ' — закрыть первым'; }
      return { t: t, k: k, when: t.time || (t.due ? 'до ' + t.due : '—'), why: why };
    }).sort(function (a, b) { return a.k - b.k; });
  }
  function mainTask() {
    var p = planList().filter(function (x) { return x.t.kind !== 'duty'; });
    return p.length ? p[0].t : null;
  }
  function nextTimed() {
    var n = nowMin();
    var list = todayTasks().filter(function (t) { return !isDone(t) && refTime(t) && toMin(refTime(t)) >= n; })
      .sort(function (a, b) { return toMin(refTime(a)) - toMin(refTime(b)); });
    return list[0] || null;
  }
  function hello() {
    var h = new Date().getHours();
    var g = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
    var left = todayTasks().filter(function (t) { return !isDone(t); });
    if (!left.length) return g + ', Макс. На сегодня всё закрыто.';
    var p = planList()[0];
    return g + ', Макс. Сегодня ' + left.length + ' ' + pluralDel(left.length) + (p ? ', первое — «' + p.t.title + '»' + (p.when !== '—' ? ' ' + (p.t.time ? 'в ' + p.t.time : p.when) : '') + '.' : '.');
  }

  /* ---------- разбор фразы ---------- */
  function parse(text) {
    var raw = text.trim();
    var low = raw.toLowerCase();
    var r = { date: today(), time: '', due: '', daily: false, kind: 'task' };
    var m;
    if (/послезавтра/.test(low)) r.date = addDays(today(), 2);
    else if (/завтра/.test(low)) r.date = addDays(today(), 1);
    else if ((m = low.match(/(?:^|\s)в (понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)(?=\s|$|[,.])/))) r.date = nextWeekday(WD_ACC.indexOf(m[1]));
    if (/(ежедневно|каждый день)/.test(low)) { r.daily = true; r.kind = 'duty'; }
    if ((m = low.match(/до (\d{1,2})(?:[:.](\d{2}))?(?!\d)/))) r.due = pad(+m[1]) + ':' + (m[2] || '00');
    if ((m = low.match(/(?:^|\s)в (\d{1,2})[:.](\d{2})/)) || (m = low.match(/(?:^|\s)в (\d{1,2})(?:\s*(?:часов|часа|час|ч)(?=\s|$|[,.]))/))) r.time = pad(+m[1]) + ':' + (m[2] || '00');
    if (r.kind !== 'duty' && /(позвонить|заказ|оплат|ответить|написать|купить|отправить|забрать|отдать|встреч)/.test(low)) r.kind = 'deal';
    if (/обязанност/.test(low)) r.kind = 'duty';
    var title = raw
      .replace(/^(напомни(те)?|добавь|добавить|задача|дело|нужно|надо)[:,]?\s*/i, '')
      .replace(/\s*(послезавтра|завтра|сегодня)\s*/ig, ' ')
      .replace(/\s*в (понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)\s*/ig, ' ')
      .replace(/\s*(ежедневно|каждый день)\s*/ig, ' ')
      .replace(/\s*до \d{1,2}([:.]\d{2})?(?!\d)\s*/ig, ' ')
      .replace(/(^|\s)в \d{1,2}([:.]\d{2})?(\s*(часов|часа|час|ч)(?=\s|$|[,.]))?/ig, ' ')
      .replace(/\s{2,}/g, ' ').replace(/[,.\s]+$/, '').trim();
    r.title = cap(title || raw);
    return r;
  }
  function addTaskFrom(text, extra) {
    var p = parse(text);
    var t = { id: uid(), title: p.title, kind: p.kind, daily: p.daily, date: p.date, time: p.time, due: p.due, remind: !!(p.time || p.due) };
    if (extra) Object.assign(t, extra);
    S.tasks.unshift(t); save();
    return t;
  }
  function addNote(body, pinned, voice) {
    body = body.trim();
    var words = body.split(/\s+/);
    var title = cap(words.slice(0, 5).join(' ')) + (words.length > 5 ? '…' : '');
    if (voice) title = 'Голосовая заметка';
    else if (words.length <= 5) title = pinned ? 'Стикер' : 'Заметка';
    var n = { id: uid(), title: title, body: cap(body), created: Date.now(), pinned: !!pinned, converted: [] };
    S.notes.unshift(n); save();
    return n;
  }
  function taskReply(t) {
    return 'Добавил ' + KINDS_ACC[t.kind] + ': «' + t.title + '»' + (t.daily ? ', ежедневно' : t.date !== today() ? ', ' + dateLabel(t.date) : '') + (t.time ? ', в ' + t.time : '') + (t.due ? ', до ' + t.due : '') + '.';
  }
  /* ---------- ответ голосом (голос iPhone, бесплатно, без интернета) ---------- */
  var VOICE_MODES = { voice: 'если спросил голосом', always: 'всегда', off: 'выкл' };
  S.voice = S.voice && VOICE_MODES[S.voice.mode] ? S.voice : { mode: 'voice', rate: 1.1 };
  var TTS = window.speechSynthesis || null, ttsUnlocked = false, ttsBump = 0, ttsSpeaking = false, ruVoice = null;
  function pickVoice() {
    if (!TTS) return;
    var vs = TTS.getVoices().filter(function (v) { return /^ru/i.test(v.lang); });
    ruVoice = vs.filter(function (v) { return /enhanced|premium|улучш/i.test(v.name + ' ' + v.voiceURI); })[0] || vs.filter(function (v) { return /milena|yuri/i.test(v.name); })[0] || vs[0] || null;
  }
  if (TTS) { pickVoice(); try { TTS.addEventListener('voiceschanged', pickVoice); } catch (e) { TTS.onvoiceschanged = pickVoice; } }
  /* iPhone разрешает сайту говорить только после касания: «разогреваем» речь при первом нажатии */
  function ttsUnlock() {
    audioUnlock();
    if (ttsUnlocked || !TTS) return;
    try { var u = new SpeechSynthesisUtterance(' '); u.volume = 0; TTS.speak(u); ttsUnlocked = true; } catch (e) { /* без речи */ }
  }

  /* ---------- живой голос Gemini: тем же ключом AI, звук играет через Web Audio ---------- */
  var TIMBRES = [['Charon', 'спокойный'], ['Kore', 'твёрдый'], ['Puck', 'бодрый'], ['Sulafat', 'тёплый'], ['iphone', 'голос iPhone']];
  if (!S.voice.timbre) S.voice.timbre = 'Charon';
  var actx = null, analyser = null, liveSrc = null, liveOn = false, liveErrShown = false, ampBuf = null;
  function audioUnlock() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
      if (!actx) {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        actx = new AC(); analyser = actx.createAnalyser(); analyser.fftSize = 512; analyser.connect(actx.destination);
        ampBuf = new Uint8Array(analyser.fftSize);
      }
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
  }
  function liveAllowed() { return !!(S.aiKey && !/^sk-ant/.test(S.aiKey) && S.voice.timbre !== 'iphone'); }
  function b64buf(b) { var s = atob(b), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a.buffer; }
  function pcmWav(buf, rate) {
    var n = buf.byteLength, out = new ArrayBuffer(44 + n), v = new DataView(out), w = function (o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n, true);
    new Uint8Array(out, 44).set(new Uint8Array(buf)); return out;
  }
  function toWav(b64, mime) {
    var buf = b64buf(b64), m = String(mime || '');
    if (/wav/i.test(m)) return buf;
    var rate = parseInt((m.match(/rate=(\d+)/) || [])[1], 10) || 24000;
    return pcmWav(buf, rate);
  }
  var GEM = 'https://generativelanguage.googleapis.com/v1beta/';
  function ttsNew(text) {
    return fetch(GEM + 'interactions', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': S.aiKey },
      body: JSON.stringify({ model: 'gemini-3.8-flash-tts', input: [{ type: 'user_input', content: [{ type: 'text', text: text, annotations: [{ type: 'speech_metadata', style: 'calm, warm and friendly, natural pace' }] }] }],
        response_format: { type: 'audio' }, generation_config: { speech_config: [{ voice: S.voice.timbre }] } })
    }).then(function (r) { return r.json().then(function (j) {
      if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
      var hit = null;
      if (j.output_audio && j.output_audio.data) hit = j.output_audio;
      (j.steps || []).forEach(function (st) { (st.content || []).forEach(function (c) { if (!hit && c && c.data && (c.type === 'audio' || /audio/.test(c.mime_type || c.mimeType || ''))) hit = c; }); });
      if (!hit) throw new Error('в ответе нет звука');
      return toWav(hit.data, hit.mime_type || hit.mimeType || 'audio/wav');
    }); });
  }
  function ttsOld(text) {
    return fetch(GEM + 'models/gemini-3.1-flash-tts-preview:generateContent', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': S.aiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: S.voice.timbre } } } } })
    }).then(function (r) { return r.json().then(function (j) {
      if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
      var parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [], hit = null;
      parts.forEach(function (p) { var d = p.inlineData || p.inline_data; if (!hit && d && d.data) hit = d; });
      if (!hit) throw new Error('в ответе нет звука');
      return toWav(hit.data, hit.mimeType || hit.mime_type);
    }); });
  }
  function decode(buf) { return new Promise(function (res, rej) { var p = actx.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); }); }
  function liveStop() { if (liveSrc) { try { liveSrc.onended = null; liveSrc.stop(); } catch (e) { /* уже остановлен */ } liveSrc = null; } liveOn = false; }
  function liveSpeak(say) {
    audioUnlock();
    if (!actx) return Promise.reject(new Error('звук недоступен'));
    if (ORB) ORB.set('think');
    return ttsNew(say).catch(function () { return ttsOld(say); }).then(decode).then(function (ab) {
      liveStop();
      var src = actx.createBufferSource(); src.buffer = ab; src.connect(analyser);
      src.onended = function () { if (liveSrc === src) { liveSrc = null; liveOn = false; ttsSpeaking = false; if (ORB && UI.mode === 'idle') ORB.set('idle'); } };
      liveSrc = src; liveOn = true; ttsSpeaking = true; if (ORB) ORB.set('speak');
      src.start(0);
    });
  }
  function liveLevel() {
    if (!liveOn || !analyser) return 0;
    analyser.getByteTimeDomainData(ampBuf);
    var sum = 0; for (var i = 0; i < ampBuf.length; i++) { var x = (ampBuf[i] - 128) / 128; sum += x * x; }
    return Math.min(1, Math.sqrt(sum / ampBuf.length) * 4);
  }
  function renderTimbreBtn() {
    var b = $('timbre-btn'); if (!b) return;
    b.hidden = !(S.aiKey && !/^sk-ant/.test(S.aiKey));
    var t = TIMBRES.filter(function (x) { return x[0] === S.voice.timbre; })[0] || TIMBRES[0];
    b.textContent = 'Тембр: ' + (t[0] === 'iphone' ? t[1] : t[0] + ' · ' + t[1]);
  }
  function quietNow() { var h = new Date().getHours(); return h >= 23 || h < 8; }
  function speakOut(text, byVoice) {
    var m = S.voice.mode;
    if ((!TTS && !liveAllowed()) || m === 'off' || (m === 'voice' && !byVoice) || (m === 'always' && !byVoice && quietNow())) return false;
    var say = String(text || '').replace(/[«»"*_#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 600);
    if (!say) return false;
    if (liveAllowed()) {
      liveSpeak(say.slice(0, 400)).catch(function (err) {
        if (ORB && UI.mode === 'idle') ORB.set('idle');
        if (!liveErrShown) { liveErrShown = true; toast('Живой голос не ответил', String(err && err.message || err).slice(0, 90) + ' — говорю голосом iPhone', true); }
        iphoneSpeak(say);
      });
      return true;
    }
    return TTS ? iphoneSpeak(say) : false;
  }
  function iphoneSpeak(say) {
    try {
      TTS.cancel();
      var u = new SpeechSynthesisUtterance(say);
      u.lang = 'ru-RU'; if (ruVoice) u.voice = ruVoice; u.rate = S.voice.rate || 1.1;
      u.onstart = function () { ttsSpeaking = true; ttsBump = 1; if (ORB) ORB.set('speak'); };
      u.onboundary = function () { ttsBump = 1; };
      u.onend = u.onerror = function () { ttsSpeaking = false; if (ORB && UI.mode === 'idle') ORB.set('idle'); };
      TTS.speak(u);
      return true;
    } catch (e) { return false; }
  }
  function ttsStop() { var was = liveOn || ttsSpeaking || (TTS && TTS.speaking); liveStop(); if (TTS) TTS.cancel(); ttsSpeaking = false; if (was && ORB && UI.mode === 'idle') ORB.set('idle'); return !!was; }
  function renderVoiceBtn() { var b = $('voice-btn'); if (b) b.textContent = 'Голос: ' + VOICE_MODES[S.voice.mode]; renderTimbreBtn(); }

  /* шар «говорит», пока появляется ответ */
  var speakTimer = null;
  function orbSpeak(text) {
    if (!ORB || UI.mode !== 'idle') return;
    ORB.set('speak'); clearTimeout(speakTimer);
    speakTimer = setTimeout(function () { if (UI.mode === 'idle') ORB.set('idle'); }, Math.min(4000, 900 + String(text || '').length * 35));
  }
  function showReply(text, heard) {
    UI.heard = heard || ''; UI.reply = text;
    var spoke = speakOut(text, !!heard);
    if (!spoke) setTimeout(function () { orbSpeak(text); }, 0);
    if (current() === 'notes') { renderNotes(); toast('AI', text); } else renderMain();
  }
  function command(text, source) {
    text = (text || '').trim().slice(0, 2000);
    if (!text) return;
    if (UI.mode === 'think') return;
    if (S.aiKey) { aiCommand(text, source); return; }
    var reply = localCommand(text, source);
    if (!UI.aiHintShown) { UI.aiHintShown = true; reply += ' AI не подключён — поэтому я только записываю. Подключи ключ Google внизу экрана, и AI будет понимать любые поручения.'; }
    think(function () { showReply(reply, source === 'voice' ? text : ''); });
  }

  /* локальный разбор — когда AI не подключён */
  function localCommand(text, source) {
    var low = text.toLowerCase().replace(/[?!.]+$/, '').trim();
    var isQ = /\?\s*$/.test(text) || /^(что|как|когда|сколько|какие|какой|какое|где|почему|зачем|кто|есть ли|можно ли|покажи|расскажи)(?=\s|$)/.test(low);
    var nm = text.match(/^((?:(?:запиши|записать|заметка|заметку|идея|идею|запомни|стикер)[:,]?\s*)+)(.+)$/i);
    if (nm) {
      var n = addNote(nm[2], /стикер/i.test(nm[1]) || nm[2].length <= 40, source === 'voice');
      if (current() === 'notes') flashNote(n.id);
      return 'Записал в заметки' + (n.pinned ? ' и приклеил стикер' : '') + ': «' + n.body.slice(0, 50) + (n.body.length > 50 ? '…' : '') + '».';
    }
    var dm = low.match(/^(выполнил|сделал|готово|закрой|отметь|закрыл)[:,]?\s*(.+)$/);
    if (dm) {
      var hit = findByWords(dm[2]);
      if (hit) { complete(hit, true); return 'Отметил выполненным: «' + hit.title + '». Убрал в архив.'; }
      return 'Не нашёл дело «' + dm[2] + '».';
    }
    if (isQ) {
      UI.plan = /план|сегодня|по порядку/.test(low) || UI.plan;
      if (/дальше|следующ|ближайш/.test(low)) { var nx = nextTimed(); return nx ? 'Следующее: «' + nx.title + '» — ' + (nx.time ? 'в ' + nx.time : 'до ' + nx.due) + '.' : 'Дел со временем на сегодня больше нет.'; }
      if (/сколько/.test(low)) { var left = todayTasks().filter(function (t) { return !isDone(t); }).length; return 'Осталось ' + left + ' ' + pluralDel(left) + ' на сегодня, выполнено ' + todayTasks().filter(isDone).length + '.'; }
      if (/завтра/.test(low)) { var tm = S.tasks.filter(function (t) { return !isDone(t) && (t.daily || t.date === addDays(today(), 1)); }); return tm.length ? 'Завтра: ' + tm.map(function (t) { return t.title; }).join(', ') + '.' : 'На завтра пока ничего.'; }
      if (/главн|важн/.test(low)) { var mt = mainTask(); return mt ? 'Главное сейчас: «' + mt.title + '».' : 'Главное на сегодня закрыто.'; }
      if (/план|сегодня|дела|задач/.test(low)) return hello();
      return 'На такие вопросы ответит AI — подключи его кнопкой «Подключить AI» внизу экрана. Сейчас я умею: дела, заметки, план, «что дальше», «сколько осталось».';
    }
    if (current() === 'notes') { var nn = addNote(text, false, source === 'voice'); flashNote(nn.id); return 'Записал в заметки.'; }
    return taskReply(addTaskFrom(text, source === 'voice' ? { voice: true } : null));
  }
  function findByWords(q) {
    var words = q.toLowerCase().split(/\s+/).filter(function (w) { return w.length > 2; }).map(function (w) { return w.slice(0, Math.max(3, w.length - 2)); });
    var best = null, score = 0;
    S.tasks.forEach(function (t) {
      if (isDone(t)) return;
      var tl = t.title.toLowerCase(), s = 0;
      words.forEach(function (w) { if (tl.indexOf(w) >= 0) s++; });
      if (s > score) { score = s; best = t; }
    });
    return score ? best : null;
  }

  /* настоящий AI — Claude через API, ключ хранится только на телефоне */
  var AI_MODEL = 'claude-haiku-5-5';
  function aiContext() {
    var d = new Date();
    var tasks = S.tasks.filter(function (t) { return !isDone(t); }).map(function (t) {
      return { id: t.id, title: t.title, kind: t.kind, date: t.daily ? 'каждый день' : t.date, time: t.time || null, due: t.due || null };
    });
    var done = S.tasks.filter(isDone).slice(0, 15).map(function (t) { return t.title; });
    var notes = S.notes.slice(0, 20).map(function (n) { return { id: n.id, text: n.body.slice(0, 200), sticker: n.pinned }; });
    return 'Сегодня: ' + WD[d.getDay()] + ', ' + today() + ', время ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' (Баку).\n' +
      'Экран: ' + (current() === 'notes' ? 'Заметки' : 'Дела') + '.\n' +
      'Открытые дела: ' + JSON.stringify(tasks) + '\nВыполнено недавно: ' + JSON.stringify(done) + '\nЗаметки: ' + JSON.stringify(notes);
  }
  var AI_SYSTEM = [
    'Ты — личный AI-помощник Макса, бренд-шефа ресторанов Novikov Group в Баку. Приложение «Блатной блокнот»: дела, обязанности, заметки, стикеры.',
    'Пойми, чего хочет Макс, и ответь ТОЛЬКО JSON без пояснений вокруг: {"reply": "...", "actions": [...]}.',
    'reply — коротко по-русски, 1–3 предложения, по делу, без воды. Если это вопрос — ответь на него по существу (используй список дел, если вопрос про них, или свои знания).',
    'actions — что сделать в приложении (может быть пустым):',
    '{"type":"add_task","title":"…","kind":"task|deal|duty","date":"ГГГГ-ММ-ДД","daily":false,"time":"ЧЧ:ММ или пусто","due":"ЧЧ:ММ или пусто"} — title чистый и короткий, без слов «напомни», дат и времени.',
    '{"type":"add_note","text":"…","sticker":false} — идея, мысль, информация для памяти. sticker=true для коротких напоминалок.',
    '{"type":"complete","id":"…"} — Макс говорит, что что-то сделал.',
    '{"type":"delete","id":"…"}, {"type":"update","id":"…", поля как у add_task} — перенести, переименовать, удалить.',
    '{"type":"show_plan"} — показать план дня.',
    'kind: task — задача (своя работа), deal — дело (звонок, заказ, письмо, встреча), duty — обязанность (регулярное, по должности).',
    'delete — только если Макс прямо сказал удалить. Сомневаешься — переспроси в reply, ничего не меняя.',
    'Одна фраза может дать несколько действий. Вопрос — это не задача и не заметка: просто ответь. Не создавай дубли уже существующих дел.',
    'Если на экране «Заметки» и фраза похожа на мысль — это заметка. Если в фразе есть поручение со сроком — это дело.',
    'Ноутбук Макса подключён только для поиска файлов: {"type":"pc_find","q":"слова из названия файла"} — когда Макс просит найти или открыть файл на компьютере (техкарту, прайс, таблицу). Найденное он откроет сам.',
    'У тебя НЕТ доступа к почте, WhatsApp, Instagram, Telegram и календарю Макса — они ещё не подключены. Если просят проверить их, честно скажи, что это подключим на следующем этапе, и предложи добавить напоминание. Никогда не выдумывай содержимое писем и сообщений.'
  ].join('\n');
  /* бесплатный AI — Google Gemini (любой ключ Google AI Studio), платный — Claude (sk-ant-…) */
  var GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
  /* спросить у Google, какие модели доступны этому ключу, и выбрать быструю */
  function geminiPick(key) {
    return fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status)); return j; }); })
      .then(function (j) {
        var ok = (j.models || []).filter(function (m) {
          return (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0 && /gemini/.test(m.name) && !/embedding|image|tts|audio|live|vision|thinking/i.test(m.name);
        }).map(function (m) { return m.name.replace(/^models\//, ''); });
        function score(n) {
          var s = 0;
          if (/flash/.test(n)) s += 100;
          if (/lite/.test(n)) s -= 5;
          if (/preview|exp/.test(n)) s -= 40;
          if (/latest/.test(n)) s -= 1;
          var v = n.match(/gemini-(\d+(?:\.\d+)?)/); if (v) s += parseFloat(v[1]) * 10;
          return s;
        }
        ok.sort(function (a, b) { return score(b) - score(a); });
        if (!ok.length) throw new Error('Нет доступных моделей для этого ключа');
        return ok;
      });
  }
  function askGemini(prompt, i) {
    i = i || 0;
    var list = (S.geminiModels && S.geminiModels.length) ? S.geminiModels.slice(0, 3) : GEMINI_MODELS;
    if (i >= list.length) return Promise.reject(new Error('Модели Gemini недоступны'));
    return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + list[i] + ':generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': S.aiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AI_SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 800, temperature: 0.3 }
      })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) {
          var emsg = (j.error && j.error.message) || ('HTTP ' + r.status);
          if (r.status === 404 || /not found|not supported/i.test(emsg)) {
            if (!S.geminiModels) return geminiPick(S.aiKey).then(function (ls) { S.geminiModels = ls; save(); return askGemini(prompt, 0); });
            return askGemini(prompt, i + 1);
          }
          if ((r.status === 429 || r.status === 503 || r.status === 500) && i + 1 < list.length) return askGemini(prompt, i + 1);
          throw new Error(emsg);
        }
        var c = j.candidates && j.candidates[0];
        return ((c && c.content && c.content.parts) || []).map(function (p) { return p.text || ''; }).join('');
      });
    });
  }
  function askClaude(prompt) {
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': S.aiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 700, system: AI_SYSTEM, messages: [{ role: 'user', content: prompt }] })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
        return (j.content || []).map(function (c) { return c.text || ''; }).join('');
      });
    });
  }
  function aiCommand(text, source) {
    setMode('think');
    var prompt = aiContext() + '\n\nМакс говорит: ' + text;
    (/^sk-ant/.test(S.aiKey) ? askClaude(prompt) : askGemini(prompt)).then(function (raw) {
      var m = raw.match(/\{[\s\S]*\}/), out;
      try { out = JSON.parse(m ? m[0] : ''); } catch (e) { throw new Error('AI ответил не по формату'); }
      checkpoint();
      var c = applyActions(out.actions, source);
      S.ai = { ok: Date.now(), err: '' }; store();
      setMode('idle');
      showReply(clean(out.reply, 600) || 'Готово.', source === 'voice' ? text : '');
      var ch = changesText(c);
      if (ch) toast('AI: ' + ch, 'Не то — нажми «Вернуть»', false, null, true); else undoSnap = null;
    }).catch(function (err) {
      setMode('idle');
      var msg = String(err && err.message || err);
      S.ai = { ok: (S.ai && S.ai.ok) || 0, err: msg.slice(0, 200), errAt: Date.now() }; store(); renderAiBtn();
      /* без AI ничего не выдумываем и не записываем: текст возвращается в строку */
      if (source === 'auto') return;
      var inp = current() === 'notes' ? $('note-input') : $('ask');
      inp.value = text;
      toast(aiErrorTitle(msg), msg.slice(0, 110), true);
      showReply(aiErrorTitle(msg).replace(/^AI: /, 'AI не ответил: ') + '. Ничего не записал — текст вернул в строку, отправь ещё раз.', source === 'voice' ? text : '');
    });
  }
  function renderAiBtn() {
    renderTimbreBtn();
    var b = $('ai-setup'); if (!b) return;
    var a = S.ai || {};
    if (!S.aiKey) b.textContent = 'Подключить AI';
    else if (a.err && (a.errAt || 0) > (a.ok || 0)) b.textContent = aiErrorTitle(a.err).replace(/^AI: /, 'AI не работает: ') + ' · ключ';
    else if (a.ok) b.textContent = 'AI работает · ответил ' + pad(new Date(a.ok).getHours()) + ':' + pad(new Date(a.ok).getMinutes()) + ' · ключ';
    else b.textContent = 'AI: ключ есть, ещё не проверен · ключ';
  }
  function aiErrorTitle(msg) {
    if (/API key not valid|API_KEY_INVALID|invalid x-api-key|authentication/i.test(msg)) return 'AI: ключ не принят — скопируй заново';
    if (/has not been used|is disabled|SERVICE_DISABLED|enable it/i.test(msg)) return 'AI: Google ещё включает сервис — попробуй через 5 минут';
    if (/location|region|country/i.test(msg)) return 'AI: Google не работает из этой страны/сети';
    if (/quota|RESOURCE_EXHAUSTED|429|rate/i.test(msg)) return 'AI: лимит исчерпан — обновится завтра';
    if (/credit|balance|billing/i.test(msg)) return 'AI: нужен баланс или биллинг';
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'AI: нет связи с сервером';
    return 'AI: ошибка';
  }
  var HHMM = /^([01]\d|2[0-3]):[0-5]\d$/, YMD = /^\d{4}-\d{2}-\d{2}$/;
  function clean(v, n) { return typeof v === 'string' ? v.trim().slice(0, n) : ''; }
  /* действия AI проверяются по одному; кривое — пропускается. Возвращает счётчик изменений */
  function applyActions(acts, source) {
    var c = { add: 0, note: 0, done: 0, del: 0, upd: 0 };
    (Array.isArray(acts) ? acts : []).slice(0, 12).forEach(function (a) {
      var t;
      if (!a || typeof a !== 'object') return;
      try {
        if (a.type === 'add_task' && clean(a.title, 120)) {
          t = { id: uid(), title: cap(clean(a.title, 120)), kind: KINDS[a.kind] ? a.kind : 'task', daily: a.daily === true, date: YMD.test(a.date || '') ? a.date : today(), time: HHMM.test(a.time || '') ? a.time : '', due: HHMM.test(a.due || '') ? a.due : '' };
          t.remind = !!(t.time || t.due); if (source === 'voice') t.voice = true;
          S.tasks.unshift(t); c.add++;
        } else if (a.type === 'add_note' && clean(a.text, 2000)) {
          var n = addNote(clean(a.text, 2000), a.sticker === true, source === 'voice'); c.note++;
          if (current() === 'notes') setTimeout(function () { flashNote(n.id); }, 50);
        } else if (a.type === 'complete' && (t = find(a.id))) {
          complete(t, true); c.done++;
        } else if (a.type === 'delete' && (t = find(a.id))) {
          S.tasks = S.tasks.filter(function (x) { return x !== t; }); c.del++;
        } else if (a.type === 'update' && (t = find(a.id))) {
          if (clean(a.title, 120)) t.title = cap(clean(a.title, 120));
          if (KINDS[a.kind]) t.kind = a.kind;
          if (YMD.test(a.date || '')) t.date = a.date;
          if (typeof a.daily === 'boolean') t.daily = a.daily;
          if (a.time === '' || HHMM.test(a.time || '')) t.time = a.time;
          if (a.due === '' || HHMM.test(a.due || '')) t.due = a.due;
          t.remind = !!(t.time || t.due); delete t.demo; c.upd++;
        } else if (a.type === 'show_plan') {
          UI.plan = true;
        } else if (a.type === 'pc_find' && clean(a.q, 80)) {
          var pq = clean(a.q, 80); c.pc = 1; setTimeout(function () { PC.find(pq); }, 300);
        }
      } catch (e) { /* пропускаем кривое действие */ }
    });
    lastDone = null;
    save();
    return c;
  }
  function changesText(c) {
    var p = [];
    if (c.add) p.push('+' + c.add + ' в дела');
    if (c.note) p.push('+' + c.note + ' в заметки');
    if (c.done) p.push(c.done + ' выполнено');
    if (c.upd) p.push(c.upd + ' изменено');
    if (c.del) p.push(c.del + ' удалено');
    if (c.pc) p.push('ищу на ноутбуке');
    return p.join(', ');
  }

  /* точка отката: удаление, очистка архива, действия AI — всё можно вернуть одной кнопкой */
  var undoSnap = null;
  function checkpoint() { undoSnap = JSON.stringify({ tasks: S.tasks, notes: S.notes }); lastDone = null; }
  function rollback() {
    if (!undoSnap) return false;
    var o = JSON.parse(undoSnap); undoSnap = null;
    S.tasks = o.tasks; S.notes = o.notes; save();
    return true;
  }

  /* выполнение и архив */
  var lastDone = null;
  function complete(t, quiet) {
    if (t.daily) t.doneOn = today(); else { t.done = true; t.doneAt = Date.now(); }
    if (UI.toastFor === t.id) $('toast').hidden = true;
    if (!quiet) { lastDone = t.id; undoSnap = null; }
    save();
    if (!quiet) toast('Готово: ' + t.title, t.daily ? 'Вернётся завтра' : 'Убрал в архив', false, null, true);
  }
  function uncomplete(t) {
    if (t.daily) t.doneOn = ''; else { t.done = false; delete t.doneAt; }
    save();
  }

  /* ---------- режим шара ---------- */
  var GUST = { idle: '5;6;16;6;5;13;5', listen: '10;16;26;12;18;28;10', think: '8;12;20;10;14;22;8' };
  var WINDDUR = { idle: '7s', listen: '1.6s', think: '2.4s' };
  function setMode(m) {
    UI.mode = m;
    var orb = $('orb');
    orb.className = 'orb-wrap mode-' + m;
    if (ORB) ORB.set(m);
    orb.setAttribute('aria-label', 'AI: ' + (m === 'listen' ? 'слушает' : m === 'think' ? 'думает' : 'готов'));
    ['anim-freq', 'anim-gust'].forEach(function (id) {
      var a = $(id); if (!a) return;
      a.setAttribute('dur', WINDDUR[m]);
      if (id === 'anim-gust') a.setAttribute('values', GUST[m]);
      try { a.beginElement(); } catch (e) { /* SMIL недоступен */ }
    });
    $('glow').hidden = m !== 'listen';
    $('mic-fab').classList.toggle('on', m === 'listen');
    $('mic-fab').setAttribute('aria-pressed', String(m === 'listen'));
    if (m !== 'idle') { $('ai-text').textContent = m === 'listen' ? 'Слушаю… нажми микрофон, когда закончишь' : 'Думаю…'; $('ai-heard').hidden = true; }
  }
  function think(done) { setMode('think'); setTimeout(function () { setMode('idle'); done(); }, 700); }

  function fillWave() {
    var d = 'M0 0 Q15 -6 30 0';
    for (var x = 60; x <= 300; x += 30) d += ' T' + x + ' 0';
    if ($('fillwave')) $('fillwave').setAttribute('d', d + ' L300 240 L0 240 Z');
  }

  /* ---------- отрисовка: Дела ---------- */
  function renderMain() {
    var d = new Date();
    $('date').innerHTML = '<span>' + WD[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + '</span>';
    $('box-place').textContent = S.place || 'Где я';
    var nx = nextTimed();
    $('box-next').textContent = nx ? refTime(nx) : '—';
    $('box-next-wrap').title = nx ? 'Следующее: ' + nx.title : 'Сроков больше нет';

    var tt = todayTasks();
    var done = tt.filter(isDone).length;
    var pct = tt.length ? done / tt.length : 0;
    if ($('level')) $('level').setAttribute('transform', 'translate(0 ' + Math.round(180 - pct * 125) + ')');

    if (UI.mode === 'idle') {
      $('ai-text').textContent = UI.reply || hello();
      $('ai-heard').hidden = !UI.heard;
      $('ai-heard').textContent = UI.heard ? 'Вы: «' + UI.heard + '»' : '';
    }

    $('plan-label').textContent = UI.plan ? 'Пересчитать план' : 'Вычислить план';
    if (UI.plan) {
      var pl = planList();
      $('plan').innerHTML = pl.length ? '<div class="plan"><div class="plan-h">План на сегодня</div>' + pl.map(function (p) {
        return '<div class="plan-row"><div class="plan-t">' + esc(p.when) + '</div><div><div>' + esc(p.t.title) + '</div><div class="plan-why">' + esc(p.why) + '</div></div></div>';
      }).join('') + '</div>' : '<div class="plan"><div class="plan-h">На сегодня всё сделано</div></div>';
    } else $('plan').innerHTML = '';

    var mt = mainTask();
    $('main-task').textContent = mt ? 'Главное: ' + mt.title : 'Главное на сегодня закрыто';

    var pins = S.notes.filter(function (n) { return n.pinned; });
    $('stickers').innerHTML = pins.map(function (n, i) {
      var txt = n.body.length > 48 ? n.body.slice(0, 46) + '…' : n.body;
      return '<button type="button" class="sticker" data-act="open-note" data-id="' + n.id + '" style="background:' + STICKER_COLORS[i % 3] + ';transform:rotate(' + ROTS[i % 4] + 'deg)">' + esc(txt) + '</button>';
    }).join('') + '<button type="button" class="sticker-add" data-act="new-sticker" aria-label="Новый стикер"><svg width="26" height="26" viewBox="0 0 24 24" class="ink" aria-hidden="true"><path d="M12.2 4.8c-.3 4.9.2 9.6-.1 14.4M4.9 12.1c4.7.2 9.6-.3 14.3.1"/></svg></button>';

    var fl = [['today', 'Сегодня'], ['all', 'Всё'], ['deal', 'Дела'], ['duty', 'Обязанности']];
    $('filters').innerHTML = fl.map(function (f, i) {
      var on = UI.filter === f[0];
      return '<button type="button" role="tab" aria-selected="' + on + '" class="filter ' + (on ? 'on ' : '') + (i % 2 ? 'hand-b' : 'hand-a') + '" data-act="filter" data-val="' + f[0] + '">' + f[1] + '</button>';
    }).join('');

    var shown = S.tasks.filter(function (t) {
      if (isDone(t)) return false;
      if (UI.filter === 'today') return isToday(t);
      if (UI.filter === 'all') return true;
      return t.kind === UI.filter;
    }).slice().sort(function (a, b) {
      var ka = (a.daily ? today() : a.date) + (refTime(a) || '99'), kb = (b.daily ? today() : b.date) + (refTime(b) || '99');
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    $('list').innerHTML = shown.length ? shown.map(function (t) {
      var dn = isDone(t), al = alertOf(t);
      return '<div class="item' + (dn ? ' is-done' : '') + '">' +
        '<button type="button" class="circle' + (dn ? ' done' : '') + '" data-act="toggle" data-id="' + t.id + '" aria-label="' + (dn ? 'Вернуть' : 'Отметить') + ': ' + esc(t.title) + '">' +
        (dn ? '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.8c1.6 1.2 3 2.6 4.4 4.6 2.6-4.6 6-8.6 10.8-12.6" fill="none" stroke="#1C1A3A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
        '</button>' +
        '<button type="button" class="item-body" data-act="edit" data-id="' + t.id + '"><span class="item-title">' + esc(t.title) + '</span><span class="item-meta">' + esc(meta(t)) + '</span>' +
        (al ? '<span class="item-alert' + (al.late ? ' late' : '') + '">' + esc(al.text) + '</span>' : '') + '</button>' +
        (refTime(t) ? '<button type="button" class="bell' + (t.remind ? ' on' : '') + '" data-act="bell" data-id="' + t.id + '" aria-pressed="' + !!t.remind + '" aria-label="' + (t.remind ? 'Выключить напоминание' : 'Включить напоминание') + '"><svg width="22" height="22" viewBox="0 0 24 24" class="ink" aria-hidden="true"><path d="M6.2 16.8c.9-1.2 1.2-2.4 1.1-4.6-.1-3 1.9-5.4 4.7-5.5 2.9-.1 4.9 2.2 4.8 5.2 0 2.3.3 3.6 1.1 4.8z"/><path d="M10.3 19.6c.9 1 2.6 1 3.5 0M12.1 4.2v2.4"/></svg></button>' : '') +
        '</div>';
    }).join('') : '<div class="empty">' + (UI.filter === 'today' ? 'На сегодня всё сделано' : 'Здесь пока пусто') + '</div>';

    var arch = S.tasks.filter(isDone).sort(function (a, b) { return (b.doneAt || Date.now()) - (a.doneAt || Date.now()); });
    $('archive').innerHTML = arch.length ? '<button type="button" class="archive-head" data-act="archive-toggle" aria-expanded="' + !!UI.archiveOpen + '">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" class="ink" aria-hidden="true"><path d="M9 5.2c2.4 2.2 4.6 4.4 6.8 6.9-2.2 2.3-4.4 4.5-6.8 6.7"/></svg>Архив · ' + arch.length + '</button>' +
      (UI.archiveOpen ? arch.map(function (t) {
        var when = t.daily ? 'сегодня, вернётся завтра' : t.doneAt ? dateLabel(dstr(new Date(t.doneAt))) : '';
        return '<div class="item is-done"><button type="button" class="circle done" data-act="restore" data-id="' + t.id + '" aria-label="Вернуть: ' + esc(t.title) + '"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.8c1.6 1.2 3 2.6 4.4 4.6 2.6-4.6 6-8.6 10.8-12.6" fill="none" stroke="#1C1A3A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
          '<div class="item-body"><span class="item-title">' + esc(t.title) + '</span><span class="item-meta">' + esc(KINDS[t.kind] + ' · выполнено ' + when) + '</span></div></div>';
      }).join('') + '<button type="button" class="link-btn archive-clear" data-act="archive-clear">Очистить архив</button>' : '') : '';

    $('demo-row').hidden = !S.tasks.some(function (t) { return t.demo; }) && !S.notes.some(function (n) { return n.demo; });
    renderAiBtn();
    $('alarm-btn').textContent = S.alarmSet ? 'План в 08:00 · поставить заново' : 'Будильник плана в 08:00';
  }

  /* ---------- отрисовка: Заметки ---------- */
  function renderNotes() {
    var c = S.notes.length;
    $('notes-count').textContent = c + ' ' + (c % 10 === 1 && c % 100 !== 11 ? 'заметка' : (c % 10 >= 2 && c % 10 <= 4 && (c % 100 < 12 || c % 100 > 14)) ? 'заметки' : 'заметок');
    $('notes-list').innerHTML = c ? S.notes.map(function (n) {
      var d = new Date(n.created);
      var when = dstr(d) === today() ? 'сегодня ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : dateLabel(dstr(d));
      return '<div class="note" id="note-' + n.id + '"><div class="note-top" data-act="edit-note" data-id="' + n.id + '"><div class="note-title">' + esc(n.title) + '</div><div class="note-when">' + esc(when) + '</div></div>' +
        '<div class="note-body" data-act="edit-note" data-id="' + n.id + '">' + esc(n.body) + '</div>' +
        (n.converted.length ? '<div class="note-done"><span class="label-sm">Добавлено в дела</span>' + n.converted.map(function (x) { return '<div>✓ ' + esc(x) + '</div>'; }).join('') + '</div>' : '') +
        '<div class="note-acts">' +
        (n.converted.length ? '' : '<button type="button" class="chip" data-act="to-tasks" data-id="' + n.id + '"><svg width="16" height="16" viewBox="0 0 40 40" aria-hidden="true"><path d="M20.3 3.5 C21 11, 22 16.5, 29 19.2 C 22.5 21, 21.2 25.5, 20 36.2 C 18.8 26, 17.6 21.6, 10.8 20.4 C 17.8 18.8, 19.2 12, 20.3 3.5 Z" fill="none" stroke="#1C1A3A" stroke-width="2.6" stroke-linejoin="round"/></svg>Разобрать в дела</button>') +
        '<button type="button" class="chip" data-act="pin" data-id="' + n.id + '">' + (n.pinned ? 'Снять стикер' : 'На стикер') + '</button>' +
        '<button type="button" class="link-btn danger" data-act="del-note" data-id="' + n.id + '">Удалить</button>' +
        '</div></div>';
    }).join('') : '<div class="empty">Заметок пока нет — напиши или нажми микрофон</div>';
    renderSearch();
  }

  /* ---------- поиск по делам, заметкам и архиву ---------- */
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е'); }
  function qWords() { return norm($('q').value).trim().split(/\s+/).filter(Boolean); }
  function hl(text, words) {
    text = String(text || '');
    if (!words.length) return esc(text);
    var re = new RegExp('(' + words.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]'); }).join('|') + ')', 'gi');
    return text.split(re).map(function (part, i) { return i % 2 ? '<mark>' + esc(part) + '</mark>' : esc(part); }).join('');
  }
  function snippet(body, words) {
    var b = String(body || ''), nb = norm(b), at = -1;
    words.forEach(function (w) { var i = nb.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; });
    if (at < 0) return b.slice(0, 90);
    var s = Math.max(0, at - 40);
    return (s ? '…' : '') + b.slice(s, s + 110) + (s + 110 < b.length ? '…' : '');
  }
  function renderSearch() {
    var words = qWords(), on = words.length > 0;
    $('search-res').hidden = !on; $('notes-list').hidden = on; $('note-form').hidden = on;
    if (!on) { $('search-res').innerHTML = ''; return; }
    var hit = function (s) { s = norm(s); return words.every(function (w) { return s.indexOf(w) >= 0; }); };
    var ts = S.tasks.filter(function (t) { return hit(t.title); });
    var ns = S.notes.filter(function (n) { return hit(n.title + ' ' + n.body); });
    var html = '';
    if (ts.length) html += '<div class="label-sm">Дела: ' + ts.length + '</div>' + ts.map(function (t) {
      return '<button type="button" class="item-body sr-item" data-act="edit" data-id="' + t.id + '"><span class="item-title">' + hl(t.title, words) + '</span><span class="item-meta">' + esc(meta(t) + (isDone(t) ? ' · выполнено' : '')) + '</span></button>';
    }).join('');
    if (ns.length) html += '<div class="label-sm">Заметки: ' + ns.length + '</div>' + ns.map(function (n) {
      return '<button type="button" class="item-body sr-item" data-act="edit-note" data-id="' + n.id + '"><span class="item-title">' + hl(n.title, words) + '</span><span class="item-meta">' + hl(snippet(n.body, words), words) + '</span></button>';
    }).join('');
    $('search-res').innerHTML = html || '<div class="empty">Ничего не нашёл</div>';
  }

  /* ---------- редактор заметки: правка сохраняется сама ---------- */
  var editingNote = null, neTimer = null;
  function openNote(id) {
    var n = findNote(id); if (!n) return;
    editingNote = id;
    $('ne-title').value = n.title; $('ne-body').value = n.body;
    $('ne-saved').textContent = 'Сохраняется само';
    $('note-ed').hidden = false; $('sheet-bg').hidden = false;
  }
  function neFlush() {
    clearTimeout(neTimer); neTimer = null;
    var n = editingNote && findNote(editingNote); if (!n) return;
    var t = $('ne-title').value.trim() || 'Заметка', b = $('ne-body').value;
    if (n.title === t && n.body === b) return;
    n.title = t; n.body = b; save();
    var d = new Date(); $('ne-saved').textContent = 'Сохранено в ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function closeNote() {
    if (!editingNote) return;
    neFlush(); editingNote = null;
    $('note-ed').hidden = true; $('sheet-bg').hidden = true;
    if (current() === 'notes') renderNotes(); else renderMain();
  }
  function flashNote(id) {
    var el = $('note-' + id); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  /* ---------- экраны ---------- */
  function current() { return location.hash === '#notes' ? 'notes' : location.hash === '#sketch' ? 'sketch' : 'main'; }
  function route() {
    var v = current();
    $('view-main').hidden = v !== 'main';
    $('view-notes').hidden = v !== 'notes';
    $('view-sketch').hidden = v !== 'sketch';
    $('mic-fab').hidden = v === 'sketch';
    if (v === 'notes') renderNotes(); else if (v === 'sketch') requestAnimationFrame(skSize); else renderMain();
    window.scrollTo(0, 0);
  }

  /* ---------- уведомление ---------- */
  var toastTimer = null;
  function toast(title, sub, keep, taskId, undo) {
    UI.toastFor = taskId || null; UI.skUndo = false;
    $('toast-title').textContent = title;
    $('toast-sub').textContent = sub || '';
    $('toast-undo').hidden = !undo;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    if (!keep) toastTimer = setTimeout(function () { $('toast').hidden = true; }, undo ? 6000 : 4500);
  }
  function startupToast() {
    var list = todayTasks().filter(function (t) { return !isDone(t) && t.remind && refTime(t); });
    var n = nowMin();
    var soon = list.filter(function (t) { return toMin(refTime(t)) >= n; }).sort(function (a, b) { return toMin(refTime(a)) - toMin(refTime(b)); })[0];
    var late = list.filter(function (t) { return toMin(refTime(t)) < n; })[0];
    if (soon) { var df = toMin(refTime(soon)) - n; toast(soon.title, (df <= 60 ? 'Скоро срок' : 'Напоминание') + ' · ' + (soon.time ? 'в ' + soon.time : 'до ' + soon.due) + ', через ' + dur(df), true, soon.id); }
    else if (late) toast(late.title, 'Срок прошёл · ' + (late.time ? 'в ' + late.time : 'до ' + late.due), true, late.id);
  }
  function checkReminders() {
    var n = nowMin(), d = today(), changed = false;
    todayTasks().forEach(function (t) {
      if (isDone(t) || !t.remind || !refTime(t)) return;
      if (!t.daily && t.date !== d) return;
      var r = toMin(refTime(t)), key = t.id + '@' + d;
      if (n >= r - 15 && n <= r && !S.fired[key]) {
        S.fired[key] = 1; changed = true;
        var sub = 'Через ' + dur(r - n) + ' · ' + (t.time ? 'в ' + t.time : 'до ' + t.due);
        toast(t.title, sub, true, t.id);
        if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
          navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(t.title, { body: sub, tag: key, icon: 'icons/icon-192.png' }); }).catch(function () {});
        }
      }
    });
    Object.keys(S.fired).forEach(function (k) { if (k.split('@')[1] !== d) { delete S.fired[k]; changed = true; } });
    if (changed) save();
    if (current() === 'main') renderMain();
  }
  function askNotify() {
    if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { /* нет поддержки */ } }
  }

  /* ---------- календарь (.ics) ---------- */
  function toCalendar(t) {
    var date = (t.daily ? today() : t.date).replace(/-/g, '');
    var tm = refTime(t) || '09:00';
    var st = date + 'T' + tm.replace(':', '') + '00';
    var endMin = toMin(tm) + 30;
    var en = date + 'T' + fromMin(Math.min(endMin, 1439)).replace(':', '') + '00';
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dela//RU', 'BEGIN:VEVENT', 'UID:' + t.id + '@dela', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
      'DTSTART:' + st, 'DTEND:' + en, 'SUMMARY:' + t.title.replace(/[,;]/g, ' '), 'DESCRIPTION:' + meta(t)];
    if (t.daily) lines.push('RRULE:FREQ=DAILY');
    lines.push('BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:' + t.title.replace(/[,;]/g, ' '), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
    saveIcs(lines, 'delo.ics');
  }
  function saveIcs(lines, name) {
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }
  /* будильник утреннего плана: ежедневное событие в календаре iPhone в 08:00 со ссылкой на приложение */
  function morningAlarm() {
    var appUrl = CANON;
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dela//RU', 'BEGIN:VEVENT', 'UID:morning-plan@dela',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
      'DTSTART;TZID=Asia/Baku:' + addDays(today(), 1).replace(/-/g, '') + 'T080000',
      'DURATION:PT10M', 'RRULE:FREQ=DAILY', 'SUMMARY:План дня — открой «Блатной блокнот»', 'URL:' + appUrl, 'DESCRIPTION:' + appUrl,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:План дня готов — открой «Блатной блокнот»', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
    saveIcs(lines, 'plan-8-00.ics');
    S.alarmSet = true; save();
  }

  /* утренний план: при первом открытии за день AI сам составляет план */
  function morningBrief() {
    var d = today(), h = new Date().getHours();
    if (S.briefDate === d || h < 5) return;
    S.briefDate = d; save();
    if (current() !== 'main') return;
    UI.plan = true;
    if (S.aiKey) command('Утро. Составь мой план на сегодня: главное первым, по времени и срокам, коротко. Ничего не добавляй и не меняй.', 'auto');
    else { UI.reply = hello() + ' План — ниже.'; renderMain(); }
  }

  /* ---------- редактор ---------- */
  function setSeg(id, val) { Array.prototype.forEach.call($(id).children, function (b) { b.classList.toggle('on', b.dataset.val === val); }); }
  function openSheet(t) {
    UI.editing = t ? t.id : null;
    $('f-title').value = t ? t.title : '';
    UI.sheetKind = t ? t.kind : 'task';
    var d = today();
    UI.sheetWhen = !t || t.daily || t.date === d ? 'today' : t.date === addDays(d, 1) ? 'tomorrow' : 'date';
    setSeg('f-kind', UI.sheetKind); setSeg('f-when', UI.sheetWhen);
    $('f-date').hidden = UI.sheetWhen !== 'date';
    $('f-date').value = t ? t.date : d;
    $('f-daily').checked = !!(t && t.daily);
    $('f-time').value = t ? t.time : '';
    $('f-due').value = t ? t.due : '';
    $('f-remind').checked = t ? !!t.remind : true;
    $('f-del').hidden = !t; $('f-cal').hidden = !t || IN_FRAME;
    $('sheet').hidden = false; $('sheet-bg').hidden = false;
    if (!t) setTimeout(function () { $('f-title').focus(); }, 150);
  }
  function closeSheet() { $('sheet').hidden = true; $('sheet-bg').hidden = true; UI.editing = null; }
  function saveSheet() {
    var title = $('f-title').value.trim(); if (!title) { $('f-title').focus(); return; }
    var d = today();
    var date = UI.sheetWhen === 'today' ? d : UI.sheetWhen === 'tomorrow' ? addDays(d, 1) : ($('f-date').value || d);
    var data = { title: title, kind: UI.sheetKind, date: date, daily: $('f-daily').checked, time: $('f-time').value, due: $('f-due').value, remind: $('f-remind').checked };
    if (UI.editing) { var t = find(UI.editing); Object.assign(t, data); delete t.demo; }
    else S.tasks.unshift(Object.assign({ id: uid() }, data));
    if (data.remind && (data.time || data.due)) askNotify();
    save(); closeSheet(); renderMain();
  }
  function find(id) { return S.tasks.filter(function (t) { return t.id === id; })[0]; }
  function findNote(id) { return S.notes.filter(function (n) { return n.id === id; })[0]; }

  /* ---------- короткий ввод и двойное нажатие ---------- */
  var miniCb = null;
  function ask(label, value, cb) {
    miniCb = cb;
    $('mini-label').textContent = label;
    $('mini-input').value = value || '';
    $('mini').hidden = false; $('sheet-bg').hidden = false;
    setTimeout(function () { $('mini-input').focus(); }, 150);
  }
  function closeMini() { $('mini').hidden = true; if ($('sheet').hidden) $('sheet-bg').hidden = true; miniCb = null; }
  function armed(el) {
    if (el.dataset.armed) return true;
    var old = el.textContent;
    el.dataset.armed = '1'; el.textContent = 'Точно? Нажми ещё раз';
    setTimeout(function () { if (el.isConnected) { delete el.dataset.armed; el.textContent = old; } }, 3000);
    return false;
  }

  /* ---------- голос ---------- */
  var IN_FRAME = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();
  var SR = IN_FRAME ? null : (window.SpeechRecognition || window.webkitSpeechRecognition);
  var rec = null, heard = '', pressAt = 0, active = false;
  function voiceStart(e) {
    if (e) e.preventDefault();
    if (active || UI.mode !== 'idle') return;
    if (!SR) {
      var inp = current() === 'notes' ? $('note-input') : $('ask');
      inp.focus();
      toast('Голос через клавиатуру', 'Нажми значок микрофона на клавиатуре iPhone');
      return;
    }
    active = true; heard = ''; pressAt = Date.now();
    setMode('listen');
    try {
      rec = new SR(); rec.lang = 'ru-RU'; rec.continuous = true; rec.interimResults = true;
      rec.onresult = function (ev) {
        var s = ''; for (var i = 0; i < ev.results.length; i++) s += ev.results[i][0].transcript;
        heard = s;
        if (current() === 'main') $('ai-text').textContent = s || 'Слушаю…';
      };
      rec.onerror = function (ev) {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') toast('Нет доступа к микрофону', 'Разреши микрофон для этого приложения в Настройках');
      };
      rec.onend = function () { finish(); };
      rec.start();
    } catch (err) { active = false; setMode('idle'); renderMain(); }
  }
  function voiceStop() {
    if (!active) return;
    var wait = Math.max(0, 500 - (Date.now() - pressAt));
    setTimeout(function () { try { rec && rec.stop(); } catch (e) { finish(); } }, wait);
  }
  function finish() {
    if (!active) return;
    active = false;
    var text = heard.trim(); rec = null;
    setMode('idle');
    if (text) command(text, 'voice');
    else { if (current() === 'main') renderMain(); toast('Не расслышал', 'Нажми микрофон, скажи и нажми ещё раз'); }
  }

  /* ---------- события ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.dataset.act, id = el.dataset.id, t, n;
    switch (act) {
      case 'close-toast': $('toast').hidden = true; break;
      case 'toggle':
        t = find(id); if (!t) break;
        var row = el.closest('.item');
        el.classList.add('done');
        if (row) { row.style.transition = 'opacity .35s'; row.style.opacity = '0'; }
        setTimeout(function () { var cur = find(id); if (cur && !isDone(cur)) complete(cur); renderMain(); }, 350);
        break;
      case 'restore':
        t = find(id); if (t) { uncomplete(t); renderMain(); toast('Вернул: ' + t.title, ''); }
        break;
      case 'undo':
        if (UI.skUndo && sk.cleared) { S.sketch.strokes = sk.cleared; sk.cleared = null; UI.skUndo = false; skCommit(); $('toast').hidden = true; break; }
        if (lastDone) { t = find(lastDone); if (t) uncomplete(t); lastDone = null; }
        else if (rollback()) toast('Вернул как было', '');
        $('toast').hidden = true; if (current() === 'notes') renderNotes(); else renderMain();
        break;
      case 'archive-toggle': UI.archiveOpen = !UI.archiveOpen; renderMain(); break;
      case 'archive-clear':
        if (armed(el)) { checkpoint(); S.tasks = S.tasks.filter(function (x) { return x.daily || !x.done; }); save(); UI.archiveOpen = false; renderMain(); toast('Архив очищен', '', false, null, true); }
        break;
      case 'sync': SYNC.press(); break;
      case 'sb-go': SYNC.bannerGo(); break;
      case 'sb-alt': SYNC.bannerAlt(); break;
      case 'sb-close': SYNC.bannerClose(); break;
      case 'backup': backup(); break;
      case 'restore-file': $('restore-input').click(); break;
      case 'copy-link':
        var lo = $('link-out'); lo.select(); lo.setSelectionRange(0, 99999);
        (navigator.clipboard ? navigator.clipboard.writeText(lo.value) : Promise.reject()).then(function () { toast('Ссылка скопирована', 'Открой её на другом устройстве'); }, function () { try { document.execCommand('copy'); toast('Ссылка скопирована', ''); } catch (e2) { toast('Скопируй ссылку вручную', ''); } });
        break;
      case 'share-link':
        if (navigator.share) navigator.share({ title: 'Блатной блокнот — синхронизация', url: $('link-out').value }).catch(function () {});
        else toast('Скопируй ссылку', 'Кнопка «Копировать»');
        break;
      case 'sync-off': if (armed(el)) { $('link-sheet').hidden = true; $('sheet-bg').hidden = true; SYNC.off(); } break;
      case 'close-link': $('link-sheet').hidden = true; $('sheet-bg').hidden = true; break;
      case 'alarm':
        if (IN_FRAME) { toast('Будильник плана', 'Работает в приложении с экрана «Домой»'); break; }
        morningAlarm(); toast('Будильник на 08:00', 'Нажми «Добавить» в календаре'); renderMain();
        break;
      case 'ai-setup':
        ask(S.aiKey ? 'Ключ AI (пусто — отключить)' : 'Вставь ключ Google AI Studio целиком', S.aiKey || '', function (v) {
          v = v.replace(/\s+/g, '').replace(/^["'«]+|["'»]+$/g, '');
          S.aiKey = v; S.geminiModels = null; S.ai = null; save(); renderMain();
          if (!v) { toast('AI отключён', 'Работаю без AI'); return; }
          if (!/^sk-ant/.test(v)) {
            toast('Проверяю ключ…', '', true);
            geminiPick(v).then(function (ls) {
              S.geminiModels = ls; S.ai = { ok: Date.now(), err: '' }; save(); renderAiBtn();
              toast('AI подключён ✓', 'Google Gemini, модель ' + ls[0] + '. Спроси что-нибудь в строке «Напиши AI»');
            }).catch(function (e) {
              var m = String(e.message || e);
              S.ai = { ok: 0, err: m.slice(0, 200), errAt: Date.now() }; store(); renderAiBtn();
              toast(aiErrorTitle(m), m.slice(0, 120), true);
            });
          } else toast('Ключ Claude сохранён', 'Проверится первым вопросом в строке «Напиши AI»');
        });
        break;
      case 'bell':
        t = find(id); t.remind = !t.remind; if (t.remind) askNotify(); save(); renderMain(); break;
      case 'edit': openSheet(find(id)); break;
      case 'new-task': openSheet(null); break;
      case 'close-sheet': closeNote(); closeSheet(); closeMini(); $('link-sheet').hidden = true; $('pc-sheet').hidden = true; break;
      case 'close-mini': closeMini(); break;
      case 'delete-task':
        if (UI.editing && armed(el)) { delete el.dataset.armed; el.textContent = 'Удалить'; checkpoint(); S.tasks = S.tasks.filter(function (x) { return x.id !== UI.editing; }); save(); closeSheet(); renderMain(); toast('Дело удалено', '', false, null, true); }
        break;
      case 'to-calendar': t = find(UI.editing); if (t) toCalendar(t); break;
      case 'filter': UI.filter = el.dataset.val; renderMain(); break;
      case 'plan':
        if (UI.mode !== 'idle') break;
        think(function () { UI.plan = true; UI.heard = ''; UI.reply = planList().length ? 'План готов — ниже, по времени и срокам.' : 'На сегодня всё сделано.'; renderMain(); var p = $('plan'); if (p.firstChild) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        break;
      case 'soon': toast(el.dataset.name, 'Подключим на втором этапе вместе с AI'); break;
      case 'edit-place':
        ask('Где ты сейчас?', S.place || '', function (v) { S.place = v.trim() || 'Где я'; save(); renderMain(); });
        break;
      case 'new-sticker':
        ask('Текст стикера', '', function (v) { if (v.trim()) { addNote(v, true, false); renderMain(); } });
        break;
      case 'open-note': location.hash = '#notes'; setTimeout(function () { openNote(id); }, 150); break;
      case 'edit-note': openNote(id); break;
      case 'ne-del':
        if (editingNote && armed(el)) {
          delete el.dataset.armed; el.textContent = 'Удалить';
          var gone = editingNote; editingNote = null; clearTimeout(neTimer);
          checkpoint(); S.notes = S.notes.filter(function (x) { return x.id !== gone; }); save();
          $('note-ed').hidden = true; $('sheet-bg').hidden = true;
          if (current() === 'notes') renderNotes(); else renderMain();
          toast('Заметка удалена', '', false, null, true);
        }
        break;
      case 'pc': PC.show(); break;
      case 'pc-open': PC.open(el.dataset.id, el.dataset.name); break;
      case 'close-pc': PC.hide(); break;
      case 'timbre':
        var ti = TIMBRES.map(function (x) { return x[0]; }).indexOf(S.voice.timbre);
        S.voice.timbre = TIMBRES[(ti + 1) % TIMBRES.length][0]; liveErrShown = false; store(); renderTimbreBtn();
        speakOut(S.voice.timbre === 'iphone' ? 'Это голос iPhone.' : 'Привет, Макс. Так звучит мой голос.', true);
        break;
      case 'voice-mode':
        S.voice.mode = { voice: 'always', always: 'off', off: 'voice' }[S.voice.mode]; store(); renderVoiceBtn();
        if (S.voice.mode !== 'off') speakOut(S.voice.mode === 'always' ? 'Буду отвечать голосом всегда, кроме ночи.' : 'Отвечу голосом, когда спросишь голосом.', true);
        else ttsStop();
        break;
      case 'theme': S.theme = { auto: 'dark', dark: 'light', light: 'auto' }[S.theme || 'auto']; store(); applyTheme(); break;
      case 'sk-tool': skTool(el.dataset.val); break;
      case 'sk-undo': skUndo(); break;
      case 'sk-clear': if (armed(el)) { delete el.dataset.armed; el.textContent = 'Очистить лист'; skClear(); } break;
      case 'sk-share': skShare(); break;
      case 'sk-note': skToNote(); break;
      case 'go-main': e.preventDefault(); location.hash = ''; break;
      case 'pin': n = findNote(id); n.pinned = !n.pinned; save(); renderNotes(); break;
      case 'del-note':
        if (armed(el)) { checkpoint(); S.notes = S.notes.filter(function (x) { return x.id !== id; }); save(); renderNotes(); toast('Заметка удалена', '', false, null, true); }
        break;
      case 'to-tasks':
        n = findNote(id);
        var parts = n.body.split(/[.\n;!?]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 2; });
        parts.forEach(function (p) { var tk = addTaskFrom(p); n.converted.push(tk.title); });
        save(); renderNotes();
        toast('Добавил в дела: ' + parts.length, 'Смотри на экране «Дела»');
        break;
      case 'clear-demo':
        if (armed(el)) {
          S.tasks = S.tasks.filter(function (x) { return !x.demo; });
          S.notes = S.notes.filter(function (x) { return !x.demo; });
          UI.reply = ''; save(); renderMain();
        }
        break;
    }
  });
  Array.prototype.forEach.call(document.querySelectorAll('.seg'), function (seg) {
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (seg.id === 'f-kind') { UI.sheetKind = b.dataset.val; setSeg('f-kind', UI.sheetKind); }
      else { UI.sheetWhen = b.dataset.val; setSeg('f-when', UI.sheetWhen); $('f-date').hidden = UI.sheetWhen !== 'date'; }
    });
  });
  $('sheet').addEventListener('submit', function (e) { e.preventDefault(); saveSheet(); });
  $('mini').addEventListener('submit', function (e) { e.preventDefault(); var cb = miniCb, v = $('mini-input').value; closeMini(); if (cb) cb(v); });
  $('ask-form').addEventListener('submit', function (e) {
    e.preventDefault(); var v = $('ask').value; $('ask').value = ''; $('ask').blur(); command(v, 'text');
  });
  $('note-form').addEventListener('submit', function (e) {
    e.preventDefault(); var v = $('note-input').value.trim(); if (!v) return;
    $('note-input').value = ''; $('note-input').blur();
    var n = addNote(v, false, false); renderNotes(); flashNote(n.id);
  });
  $('mic-fab').addEventListener('click', function (e) {
    e.preventDefault();
    if (active) voiceStop(); else voiceStart();
  });
  window.addEventListener('hashchange', route);
  $('note-ed').addEventListener('submit', function (e) { e.preventDefault(); closeNote(); });
  $('ne-title').addEventListener('input', function () { clearTimeout(neTimer); neTimer = setTimeout(neFlush, 500); });
  $('ne-body').addEventListener('input', function () { clearTimeout(neTimer); neTimer = setTimeout(neFlush, 500); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) neFlush(); });
  $('q').addEventListener('input', renderSearch);
  $('search-form').addEventListener('submit', function (e) { e.preventDefault(); $('q').blur(); });
  $('sheet').addEventListener('submit', function () { if (current() === 'notes') setTimeout(renderSearch, 0); });
  window.addEventListener('resize', function () { if (current() === 'sketch') skSize(); });
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (e) { /* старый браузер */ }

  /* ---------- тема ---------- */
  function applyTheme() {
    var t = S.theme || 'auto', root = document.documentElement;
    if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    var dark = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#15141F' : '#F6F3EA');
    $('theme-btn').textContent = 'Тема: ' + { auto: 'авто', light: 'светлая', dark: 'тёмная' }[t];
    if (current() === 'sketch') skRebuild();
    if (ORB) ORB.light(!dark);
  }

  /* ---------- лист: рисунок пальцем, хранится векторами, синхронизируется ---------- */
  var SK_W = 1000, SK_H = 1400;
  var TOOLS = { pen: 3.2, marker: 16, eraser: 30 };
  var sk = { tool: 'pen', cur: null, pid: null, base: null, k: 1, raf: 0, cleared: null };
  S.sketch = S.sketch && Array.isArray(S.sketch.strokes) ? S.sketch : { strokes: [], u: 0 };
  function inkColor() { return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#1C1A3A'; }
  function drawStroke(ctx, s, k, ink) {
    var p = s.p; if (!p || p.length < 2) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = s.w * k;
    if (s.t === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; }
    else if (s.t === 'marker') { ctx.globalAlpha = 0.35; ctx.strokeStyle = '#8A8A3A'; }
    else ctx.strokeStyle = ink;
    ctx.beginPath(); ctx.moveTo(p[0] * k, p[1] * k);
    if (p.length === 2) ctx.lineTo(p[0] * k + 0.1, p[1] * k);
    for (var i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(p[i] * k, p[i + 1] * k, (p[i] + p[i + 2]) / 2 * k, (p[i + 1] + p[i + 3]) / 2 * k);
    if (p.length >= 4) ctx.lineTo(p[p.length - 2] * k, p[p.length - 1] * k);
    ctx.stroke(); ctx.restore();
  }
  function skRebuild() {
    var c = $('sk'); if (!c || !c.width) return;
    if (!sk.base) sk.base = document.createElement('canvas');
    sk.base.width = c.width; sk.base.height = c.height;
    var bx = sk.base.getContext('2d'), ink = inkColor();
    S.sketch.strokes.forEach(function (s) { drawStroke(bx, s, sk.k, ink); });
    skDraw(); skStatus();
  }
  function skDraw() {
    sk.raf = 0;
    var c = $('sk'), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    if (sk.base) ctx.drawImage(sk.base, 0, 0);
    if (sk.cur) drawStroke(ctx, sk.cur, sk.k, inkColor());
  }
  function skSize() {
    var c = $('sk'); var w = c.clientWidth; if (!w) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1), h = w * SK_H / SK_W;
    c.style.height = h + 'px'; c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    sk.k = c.width / SK_W; skRebuild();
  }
  function skStatus() {
    var n = S.sketch.strokes.length;
    $('sk-status').textContent = n ? 'Штрихов: ' + n + (S.sync && S.sync.id ? ' · синхронизируется' : '') : 'Лист пустой';
  }
  function skTool(t) {
    sk.tool = TOOLS[t] ? t : 'pen';
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="sk-tool"]'), function (b) { b.classList.toggle('on', b.dataset.val === sk.tool); });
  }
  function skCommit() { S.sketch.u = Date.now(); store(); if (window.DelaSync) window.DelaSync.schedule(); skRebuild(); }
  function skUndo() { if (!S.sketch.strokes.length) return; S.sketch.strokes.pop(); skCommit(); }
  function skClear() {
    if (!S.sketch.strokes.length) return;
    var old = S.sketch.strokes; S.sketch.strokes = []; skCommit();
    toast('Лист очищен', '', false, null, true); sk.cleared = old; UI.skUndo = true;
  }
  function skPoint(e) {
    var r = $('sk').getBoundingClientRect();
    var x = Math.round((e.clientX - r.left) / r.width * SK_W), y = Math.round((e.clientY - r.top) / r.height * SK_H);
    x = Math.max(0, Math.min(SK_W, x)); y = Math.max(0, Math.min(SK_H, y));
    var p = sk.cur.p, n = p.length;
    if (n && Math.abs(p[n - 2] - x) + Math.abs(p[n - 1] - y) < 3) return;
    p.push(x, y);
  }
  (function () {
    var c = $('sk');
    c.addEventListener('pointerdown', function (e) {
      if (sk.cur || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      try { c.setPointerCapture(e.pointerId); } catch (er) { /* без захвата тоже рисует */ }
      sk.pid = e.pointerId; sk.cur = { t: sk.tool, w: TOOLS[sk.tool], p: [] };
      skPoint(e); skDraw();
    });
    c.addEventListener('pointermove', function (e) {
      if (!sk.cur || e.pointerId !== sk.pid) return;
      e.preventDefault();
      var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      (list.length ? list : [e]).forEach(skPoint);
      if (!sk.raf) sk.raf = requestAnimationFrame(skDraw);
    });
    function end(e) {
      if (!sk.cur || e.pointerId !== sk.pid) return;
      var s = sk.cur; sk.cur = null; sk.pid = null;
      if (s.p.length >= 2) { S.sketch.strokes.push(s); skCommit(); } else skDraw();
    }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  })();
  /* картинка листа: всегда тёмные чернила на светлой бумаге */
  function skImage(type) {
    var W = SK_W, Hh = SK_H, layer = document.createElement('canvas'), out = document.createElement('canvas');
    layer.width = out.width = W; layer.height = out.height = Hh;
    var lx = layer.getContext('2d');
    S.sketch.strokes.forEach(function (s) { drawStroke(lx, s, 1, '#1C1A3A'); });
    var ox = out.getContext('2d'); ox.fillStyle = '#FFFDF6'; ox.fillRect(0, 0, W, Hh); ox.drawImage(layer, 0, 0);
    return out.toDataURL(type || 'image/png', 0.88);
  }
  function dataFile(url, name) {
    var parts = url.split(','), mime = parts[0].match(/:(.*?);/)[1], bin = atob(parts[1]), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new File([a], name, { type: mime });
  }
  function skShare() {
    if (!S.sketch.strokes.length) { toast('Лист пустой', 'Сначала напиши или нарисуй что-нибудь'); return; }
    var url = skImage('image/png'), name = 'list-' + today() + '.png', f = dataFile(url, name);
    if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: 'Лист' }).catch(function () {}); return; }
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    toast('Картинка сохранена', name);
  }
  var VISION_PROMPT = 'На картинке — страница, написанная от руки. Перепиши весь рукописный текст по-русски, сохраняя строки и списки. Исправь только явные ошибки распознавания, ничего не добавляй от себя. Если текста нет — ответь одним символом «—». Если есть рисунок или схема — в конце одной строкой опиши его, начиная со слова «Рисунок:». Ответ — только текст, без пояснений.';
  function askVision(b64) {
    if (/^sk-ant/.test(S.aiKey)) {
      return fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': S.aiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: AI_MODEL, max_tokens: 1500, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: VISION_PROMPT }] }] })
      }).then(function (r) { return r.json().then(function (j) {
        if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
        return (j.content || []).map(function (c) { return c.text || ''; }).join('');
      }); });
    }
    var list = (S.geminiModels && S.geminiModels.length) ? S.geminiModels.slice(0, 3) : GEMINI_MODELS;
    function tryModel(i) {
      if (i >= list.length) return Promise.reject(new Error('Модели Gemini недоступны'));
      return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + list[i] + ':generateContent', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': S.aiKey },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: b64 } }, { text: VISION_PROMPT }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0.1 } })
      }).then(function (r) { return r.json().then(function (j) {
        if (!r.ok) { if (i + 1 < list.length) return tryModel(i + 1); throw new Error((j.error && j.error.message) || ('HTTP ' + r.status)); }
        var c = j.candidates && j.candidates[0];
        return ((c && c.content && c.content.parts) || []).map(function (p) { return p.text || ''; }).join('');
      }); });
    }
    return tryModel(0);
  }
  function skToNote() {
    if (!S.sketch.strokes.length) { toast('Лист пустой', 'Сначала напиши что-нибудь'); return; }
    if (!S.aiKey) { toast('AI не подключён', 'Внизу главного экрана — «Подключить AI». Пока можно отправить картинкой', true); return; }
    $('sk-status').textContent = 'AI читает лист…';
    askVision(skImage('image/jpeg').split(',')[1]).then(function (text) {
      text = String(text || '').trim();
      if (!text || text === '—') { toast('Текста не нашёл', 'Похоже, на листе только рисунок — отправь его картинкой', true); return; }
      var n = addNote(text, false, false); n.title = 'С листа'; save();
      location.hash = '#notes'; setTimeout(function () { openNote(n.id); }, 150);
      toast('Заметка из листа готова', 'Проверь текст — AI мог ошибиться в почерке');
    }).catch(function (err) {
      var msg = String(err && err.message || err);
      toast(aiErrorTitle(msg), msg.slice(0, 110), true);
    }).then(function () { if (current() === 'sketch') skStatus(); });
  }
  try { if (window.AIOrb) ORB = window.AIOrb($('orb-cv'), { energy: 1.3 }); } catch (e) { ORB = null; }
  if (ORB) ORB.amp(function () { if (liveOn) return 0.15 + liveLevel(); if (!ttsSpeaking) return 0; ttsBump *= 0.92; return 0.3 + 0.7 * Math.max(ttsBump, 0.4 * Math.abs(Math.sin(Date.now() / 140))); });
  document.addEventListener('click', ttsUnlock, true);
  document.addEventListener('touchend', ttsUnlock, true);
  $('orb').addEventListener('click', function () { if (ttsStop()) toast('Замолчал', ''); });
  renderVoiceBtn();
  applyTheme();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { checkReminders(); } });

  /* ---------- копия данных: файл без ключей (AI-ключ и ключ синхронизации не попадают) ---------- */
  function backup() {
    var data = { app: 'dela', v: 1, at: new Date().toISOString(), tasks: S.tasks, notes: S.notes, place: S.place, sketch: S.sketch };
    var name = 'dela-kopiya-' + today() + '.json';
    var blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    var file = null;
    try { file = new File([blob], name, { type: 'application/json' }); } catch (e) { /* старый браузер */ }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Блатной блокнот — копия' }).then(function () { toast('Копия сохранена', name); }, function () {});
      return;
    }
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    toast('Копия скачана', name);
  }
  function restoreFrom(text) {
    var o;
    try { o = JSON.parse(text); } catch (e) { toast('Файл не читается', 'Нужен файл копии dela-kopiya-….json', true); return; }
    if (!o || o.app !== 'dela' || !Array.isArray(o.tasks)) { toast('Это не копия блокнота', 'Выбери файл dela-kopiya-….json', true); return; }
    checkpoint();
    S.tasks = validList(o.tasks, 'title'); S.notes = validList(o.notes, 'body');
    if (typeof o.place === 'string') S.place = o.place;
    var bs = validSketch(o.sketch); if (bs) { bs.u = Date.now(); S.sketch = bs; }
    save(); renderMain();
    toast('Восстановлено: ' + S.tasks.length + ' дел, ' + S.notes.length + ' заметок', 'Не то — нажми «Вернуть»', false, null, true);
  }
  $('restore-input').addEventListener('change', function () {
    var f = this.files && this.files[0]; this.value = '';
    if (!f) return;
    if (f.size > 2e6) { toast('Файл слишком большой', 'Копия «Дел» весит меньше 2 МБ', true); return; }
    f.text().then(restoreFrom);
  });

  /* ---------- погода (Open-Meteo, без ключа) ---------- */
  function weather() {
    try {
      var c = JSON.parse(localStorage.getItem('dela.weather') || 'null');
      if (c && Date.now() - c.at < 30 * 60e3) { $('box-weather').textContent = c.t; return; }
    } catch (e) { /* кэш недоступен */ }
    fetch('https://api.open-meteo.com/v1/forecast?latitude=40.41&longitude=49.87&current=temperature_2m&timezone=Asia%2FBaku')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var v = Math.round(j.current.temperature_2m); var t = (v > 0 ? '+' : '') + v + '°';
        $('box-weather').textContent = t;
        try { localStorage.setItem('dela.weather', JSON.stringify({ t: t, at: Date.now() })); } catch (e) { /* нет места */ }
      }).catch(function () { $('box-weather').textContent = '—°'; });
  }

  /* ---------- старт ---------- */
  fillWave();
  route();
  weather();
  setTimeout(startupToast, 1200);
  if (S.aiKey && !/^sk-ant/.test(S.aiKey) && !S.geminiModels) geminiPick(S.aiKey).then(function (ls) { S.geminiModels = ls; save(); }).catch(function () { /* проверим при первом запросе */ });
  setTimeout(morningBrief, 600);

  /* ---------- синхронизация: зашифрованная копия в облачном хранилище textdb.dev ----------
     Ключ шифрования есть только на устройствах Макса (в ссылке подключения), хранилище видит только шифр. */
  var SYNC = (function () {
    var BASE = 'https://textdb.dev/api/data/';
    var busy = false, again = false, timer = null, cryptoKey = null;
    function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
    function unb64(t) { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; var s = atob(t), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
    function on() { return !!(S.sync && S.sync.id && S.sync.k); }
    function key() {
      if (cryptoKey) return Promise.resolve(cryptoKey);
      return crypto.subtle.importKey('raw', unb64(S.sync.k), 'AES-GCM', false, ['encrypt', 'decrypt']).then(function (k) { cryptoKey = k; return k; });
    }
    function enc(obj) {
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return key().then(function (k) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(JSON.stringify(obj))); })
        .then(function (ct) { return 'dela1.' + b64(iv) + '.' + b64(ct); });
    }
    function dec(text) {
      var parts = (text || '').trim().split('.');
      if (parts.length !== 3 || parts[0] !== 'dela1') return Promise.resolve(null);
      return key().then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(parts[1]) }, k, unb64(parts[2])); })
        .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
    }
    function pull() {
      return fetch(BASE + S.sync.id, { cache: 'no-store' }).then(function (r) {
        if (r.status === 404) return '';
        if (!r.ok) throw new Error('хранилище ответило ' + r.status);
        return r.text();
      }).then(function (t) { return t ? dec(t) : null; });
    }
    function push() {
      return enc(payload()).then(function (body) {
        return fetch(BASE + S.sync.id, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body });
      }).then(function (r) { if (!r.ok) throw new Error('запись не прошла: ' + r.status); });
    }
    function rerender() { if (current() === 'notes') renderNotes(); else if (current() === 'sketch') skRebuild(); else renderMain(); }
    function run() {
      if (!on() || !navigator.onLine) { render(); return Promise.resolve(); }
      if (busy) { again = true; return Promise.resolve(); }
      busy = true;
      return pull().then(function (R) {
        var before = JSON.stringify([S.tasks, S.notes, S.place, S.aiKey, S.sketch]);
        if (R) {
          if (S.sync.joining && ((R.tasks || []).length || (R.notes || []).length)) {
            S.tasks = S.tasks.filter(function (x) { return !x.demo; });
            S.notes = S.notes.filter(function (x) { return !x.demo; });
            takeSnap();
          }
          mergeRemote(R);
        }
        if (JSON.stringify([S.tasks, S.notes, S.place, S.aiKey, S.sketch]) !== before) rerender();
        var remoteStr = R ? JSON.stringify([R.tasks, R.notes, R.place, R.aiKey, R.sketch]) : '';
        if (JSON.stringify([S.tasks, S.notes, S.place, S.aiKey, S.sketch]) !== remoteStr) return push();
      }).then(function () {
        S.sync.joining = false; S.sync.last = Date.now(); S.sync.err = ''; store();
      }).catch(function (e) {
        S.sync.err = String(e && e.message || e); store();
      }).then(function () {
        busy = false; render();
        if (again) { again = false; return run(); }
      });
    }
    function render() {
      var b = $('sync-btn'); if (!b) return;
      b.hidden = false;
      var s = S.sync || {};
      if (!on()) b.textContent = 'Синхронизация: включить';
      else if (s.err) b.textContent = 'Синхронизация: ошибка — нажми';
      else if (s.last) b.textContent = 'Синхронизировано ' + pad(new Date(s.last).getHours()) + ':' + pad(new Date(s.last).getMinutes()) + ' · ссылка';
      else b.textContent = 'Синхронизирую…';
    }
    function link() { return CANON + '#sync=' + S.sync.id + '.' + S.sync.k; }
    function showLink() {
      $('link-out').value = link();
      $('link-sheet').hidden = false; $('sheet-bg').hidden = false;
    }
    function create() {
      var raw = new Uint8Array(32); crypto.getRandomValues(raw);
      var idb = new Uint8Array(18); crypto.getRandomValues(idb);
      S.sync = { id: 'dela-' + b64(idb), k: b64(raw) }; cryptoKey = null; store();
      return run();
    }
    function press() {
      if (!on()) { bannerHidden = false; banner('choose'); window.scrollTo(0, 0); return; }
      if (S.sync.err) { run().then(function () { if (S.sync.err) toast('Синхронизация: ошибка', S.sync.err, true); else toast('Синхронизировано', ''); }); return; }
      run(); showLink();
    }
    var LINK_RE = /#sync=(dela-[A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{40,})/;
    function join(text) {
      var m = String(text || '').trim().match(LINK_RE);
      if (!m) { toast('Это не ссылка синхронизации', 'Она начинается с ' + CANON + '#sync=', true); return false; }
      if (S.sync && S.sync.id === m[1]) { toast('Это устройство уже подключено', ''); banner(); return true; }
      S.sync = { id: m[1], k: m[2], joining: true }; cryptoKey = null; store();
      toast('Подключаю синхронизацию…', '', true);
      run().then(function () {
        if (S.sync.err) toast('Не удалось подключиться', S.sync.err, true);
        else toast('Синхронизация включена ✓', 'Дела и заметки теперь общие с другим устройством');
        banner();
      });
      return true;
    }
    function readLink() {
      if (!LINK_RE.test(location.hash)) return;
      var h = location.hash;
      history.replaceState(null, '', location.origin + location.pathname);
      join(h);
    }
    function pasteJoin() {
      var manual = function () { ask('Вставь ссылку синхронизации', '', join); };
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (t) { if (LINK_RE.test(t || '')) join(t); else manual(); }, manual);
      } else manual();
    }
    /* верхняя плашка: переезд со старого адреса или подключение нового устройства */
    var bannerHidden = false, migrateReady = false;
    function hasReal() { return S.tasks.concat(S.notes).some(function (x) { return !x.demo; }); }
    function banner(mode) {
      var el = $('sync-banner'); if (!el) return;
      if (!mode) {
        if (OLD_HOST) mode = 'move';
        else if (!on() && !hasReal()) mode = 'choose';
      }
      if (!mode || bannerHidden) { el.hidden = true; return; }
      el.dataset.mode = mode;
      var alt = $('sb-alt');
      if (mode === 'move') {
        $('sb-text').textContent = migrateReady
          ? 'Готово, данные отправлены. Нажми — откроется новый адрес в Safari. Там: «Поделиться» → «На экран Домой». В новой иконке нажми «Вставить ссылку» (она уже будет скопирована). Старую иконку удали, когда увидишь дела в новой.'
          : 'Блокнот переехал на новый адрес — без лишних страниц и рекламы. Нажми, и дела с заметками переедут вместе с тобой.';
        $('sb-btn').textContent = migrateReady ? 'Открыть новый блокнот' : 'Перенести';
        alt.hidden = true;
      } else {
        $('sb-text').textContent = 'Ведёшь блокнот на другом устройстве? Скопируй там ссылку синхронизации и нажми «Вставить ссылку» — дела и заметки станут общими. Если это твоё первое устройство — нажми «Это первое устройство».';
        $('sb-btn').textContent = 'Вставить ссылку';
        alt.textContent = 'Это первое устройство'; alt.hidden = false;
      }
      el.hidden = false;
    }
    function bannerGo() {
      var mode = $('sync-banner').dataset.mode;
      if (mode === 'move') {
        if (!migrateReady) {
          toast('Готовлю перенос…', '', true);
          (on() ? run() : create()).then(function () {
            if (S.sync.err) { toast('Не получилось отправить данные', S.sync.err + ' — проверь интернет и нажми ещё раз', true); return; }
            migrateReady = true; $('toast').hidden = true; banner('move');
          });
          return;
        }
        var l = link();
        try { if (navigator.clipboard) navigator.clipboard.writeText(l).catch(function () {}); } catch (e) { /* без буфера: ссылка всё равно в адресе */ }
        window.open(l, '_blank');
        return;
      }
      pasteJoin();
    }
    function bannerAlt() {
      bannerHidden = true; banner();
      create().then(function () {
        if (S.sync.err) toast('Синхронизация не включилась', S.sync.err, true);
        else showLink();
      });
    }
    function bannerClose() { bannerHidden = true; banner(); }
    function off() { S.sync = null; cryptoKey = null; store(); render(); toast('Синхронизация выключена на этом устройстве', ''); }
    function schedule() { if (!on()) return; clearTimeout(timer); timer = setTimeout(run, 1500); }
    return { run: run, schedule: schedule, render: render, press: press, readLink: readLink, off: off, link: link, banner: banner, bannerGo: bannerGo, bannerAlt: bannerAlt, bannerClose: bannerClose, enc: enc, dec: dec, base: BASE, on: on };
  })();
  window.DelaSync = SYNC;

  /* ---------- компьютер: помощник на ноутбуке ищет и открывает файлы, сохраняет блокнот в папку ---------- */
  var PC = (function () {
    var st = null, pend = {}, timer = null, lastQ = '';
    function ids() { return SYNC.on() ? { q: S.sync.id + '-pcq', r: S.sync.id + '-pcr' } : null; }
    function get(id) { return fetch(SYNC.base + id, { cache: 'no-store' }).then(function (r) { if (r.status === 404) return ''; if (!r.ok) throw new Error('хранилище ' + r.status); return r.text(); }).then(function (t) { return t ? SYNC.dec(t) : null; }); }
    function put(id, obj) { return SYNC.enc(obj).then(function (b) { return fetch(SYNC.base + id, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: b }); }).then(function (r) { if (!r.ok) throw new Error('запись ' + r.status); }); }
    function online() { return !!(st && st.seen && Date.now() - st.seen < 90e3); }
    function statusText() {
      if (!SYNC.on()) return 'Сначала включи синхронизацию — через неё блокнот говорит с ноутбуком.';
      if (!st || !st.seen) return 'Ноутбук не подключён: помощник на ноутбуке ещё не установлен или выключен.';
      var d = new Date(st.seen);
      return online() ? 'Ноутбук на связи ✓ ' + (st.host || '') : 'Ноутбук был на связи в ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' — сейчас выключен или спит.';
    }
    function chip() {
      var b = document.querySelector('[data-act="pc"]'); if (b) b.style.opacity = online() ? '1' : '';
    }
    function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ'; }
    function render() {
      chip();
      if ($('pc-sheet').hidden) return;
      $('pc-status').textContent = statusText();
      var r = st && st.res ? st.res.filter(function (x) { return x.kind === 'find'; }).slice(-1)[0] : null;
      var waiting = Object.keys(pend).some(function (k) { return pend[k].kind === 'find'; });
      var html = '';
      if (waiting) html = '<div class="empty">Ищу на ноутбуке «' + esc(lastQ) + '»…</div>';
      else if (r) {
        html = '<div class="label-sm">«' + esc(r.q) + '»: ' + (r.items.length ? 'нашёл ' + r.items.length : 'ничего не нашёл') + '</div>' + r.items.map(function (it) {
          return '<button type="button" class="item-body sr-item" data-act="pc-open" data-id="' + esc(it.t) + '" data-name="' + esc(it.name) + '"><span class="item-title">' + esc(it.name) + '</span><span class="item-meta">' + esc(it.dir) + ' · ' + fmtSize(it.size) + ' · открыть на ноутбуке</span></button>';
        }).join('');
      }
      $('pc-res').innerHTML = html;
      $('pc-folder').textContent = st && st.folder ? 'Дела и заметки сами сохраняются на ноутбуке: ' + st.folder : 'Дела и заметки будут сами сохраняться на ноутбуке в папку «Блатной блокнот» на рабочем столе.';
    }
    function poll() {
      var I = ids(); if (!I) { render(); return Promise.resolve(); }
      return get(I.r).then(function (R) {
        if (R) st = R;
        (st && st.res || []).forEach(function (x) {
          var p = pend[x.id]; if (!p) return;
          delete pend[x.id];
          if (p.kind === 'open') { if (x.ok) toast('Открыл на ноутбуке', x.name || ''); else toast('Не открыл', x.err || '', true); }
        });
        Object.keys(pend).forEach(function (k) { if (Date.now() - pend[k].at > 45e3) { var p = pend[k]; delete pend[k]; toast('Ноутбук не ответил', online() ? 'Попробуй ещё раз' : 'Он выключен или спит', true); } });
        render();
        if (Object.keys(pend).length) { clearTimeout(timer); timer = setTimeout(poll, 2000); }
      }).catch(function () { render(); });
    }
    function send(req) {
      var I = ids(); if (!I) { toast('Компьютер', 'Сначала включи синхронизацию', true); return; }
      req.id = uid(); req.at = Date.now(); pend[req.id] = { kind: req.kind, at: req.at };
      get(I.q).catch(function () { return null; }).then(function (Q) {
        var reqs = (Q && Array.isArray(Q.reqs) ? Q.reqs : []).filter(function (x) { return x && Date.now() - x.at < 10 * 60e3; });
        reqs.push(req);
        return put(I.q, { v: 1, reqs: reqs.slice(-20) });
      }).then(function () { clearTimeout(timer); timer = setTimeout(poll, 1500); }, function (e) { delete pend[req.id]; toast('Не отправил на ноутбук', String(e.message || e), true); render(); });
    }
    function show() { $('pc-sheet').hidden = false; $('sheet-bg').hidden = false; render(); poll(); }
    function hide() { $('pc-sheet').hidden = true; if ($('sheet').hidden && $('mini').hidden && $('note-ed').hidden) $('sheet-bg').hidden = true; }
    function find(q) { q = String(q || '').trim().slice(0, 80); if (!q) return; lastQ = q; $('pc-q').value = q; show(); send({ kind: 'find', q: q }); render(); }
    function open(t, name) { send({ kind: 'open', t: t }); toast('Открываю на ноутбуке', name || ''); }
    return { show: show, hide: hide, find: find, open: open, poll: poll };
  })();
  setTimeout(function () { PC.poll(); }, 2500);
  setInterval(function () { if (!document.hidden) PC.poll(); }, 60e3);
  $('pc-form').addEventListener('submit', function (e) { e.preventDefault(); $('pc-q').blur(); PC.find($('pc-q').value); });
  SYNC.readLink();
  SYNC.render();
  SYNC.banner();
  SYNC.run();
  setInterval(function () { if (!document.hidden) SYNC.run(); }, 30e3);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) SYNC.run(); });
  window.addEventListener('online', function () { SYNC.run(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) morningBrief(); });
  setInterval(checkReminders, 30000);
  /* обновления: новая версия подтягивается сама и страница один раз перезагружается */
  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      reg.update();
      document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update(); });
    }).catch(function () {});
  }
  $('app-ver').textContent = 'версия ' + APP_VERSION;
})();
