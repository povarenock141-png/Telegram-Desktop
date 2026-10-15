(function () {
  'use strict';

  /* ---------- утилиты ---------- */
  var KEY = 'dela.v1';
  var APP_VERSION = '12';
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
      if (snap[x.id] !== j) { x.u = now; snap[x.id] = j; }
    });
    Object.keys(snap).forEach(function (id) {
      if (id !== '__meta' && !seen[id]) { S.del[id] = now; delete snap[id]; }
    });
    var m = metaStr();
    if (snap.__meta !== m) { S.metaU = now; snap.__meta = m; }
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
    S.tasks = un(R.tasks, S.tasks);
    S.notes = un(R.notes, S.notes);
    S.del = del;
    if ((R.metaU || 0) > (S.metaU || 0)) { S.place = R.place; S.aiKey = R.aiKey; S.metaU = R.metaU; }
    takeSnap(); store();
  }
  function payload() {
    return { v: 1, tasks: S.tasks, notes: S.notes, del: S.del || {}, place: S.place, aiKey: S.aiKey || '', metaU: S.metaU || 0, at: Date.now() };
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
  function showReply(text, heard) {
    UI.heard = heard || ''; UI.reply = text;
    if (current() === 'notes') { renderNotes(); toast('AI', text); } else renderMain();
  }
  function command(text, source) {
    text = (text || '').trim();
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
    'Ты — личный AI-помощник Макса, бренд-шефа ресторанов Novikov Group в Баку. Приложение «Дела»: дела, обязанности, заметки, стикеры.',
    'Пойми, чего хочет Макс, и ответь ТОЛЬКО JSON без пояснений вокруг: {"reply": "...", "actions": [...]}.',
    'reply — коротко по-русски, 1–3 предложения, по делу, без воды. Если это вопрос — ответь на него по существу (используй список дел, если вопрос про них, или свои знания).',
    'actions — что сделать в приложении (может быть пустым):',
    '{"type":"add_task","title":"…","kind":"task|deal|duty","date":"ГГГГ-ММ-ДД","daily":false,"time":"ЧЧ:ММ или пусто","due":"ЧЧ:ММ или пусто"} — title чистый и короткий, без слов «напомни», дат и времени.',
    '{"type":"add_note","text":"…","sticker":false} — идея, мысль, информация для памяти. sticker=true для коротких напоминалок.',
    '{"type":"complete","id":"…"} — Макс говорит, что что-то сделал.',
    '{"type":"delete","id":"…"}, {"type":"update","id":"…", поля как у add_task} — перенести, переименовать, удалить.',
    '{"type":"show_plan"} — показать план дня.',
    'kind: task — задача (своя работа), deal — дело (звонок, заказ, письмо, встреча), duty — обязанность (регулярное, по должности).',
    'Одна фраза может дать несколько действий. Вопрос — это не задача и не заметка: просто ответь. Не создавай дубли уже существующих дел.',
    'Если на экране «Заметки» и фраза похожа на мысль — это заметка. Если в фразе есть поручение со сроком — это дело.',
    'У тебя НЕТ доступа к почте, WhatsApp, Instagram, Telegram, календарю и компьютеру Макса — они ещё не подключены. Если просят проверить их, честно скажи, что это подключим на следующем этапе, и предложи добавить напоминание. Никогда не выдумывай содержимое писем и сообщений.'
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
      var m = raw.match(/\{[\s\S]*\}/);
      var out = m ? JSON.parse(m[0]) : { reply: raw, actions: [] };
      applyActions(out.actions || [], source);
      setMode('idle');
      showReply(out.reply || 'Готово.', source === 'voice' ? text : '');
    }).catch(function (err) {
      setMode('idle');
      var msg = String(err && err.message || err);
      toast(aiErrorTitle(msg), msg.slice(0, 110), true);
      showReply(localCommand(text, source), source === 'voice' ? text : '');
    });
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
  function applyActions(acts, source) {
    acts.forEach(function (a) {
      var t;
      try {
        if (a.type === 'add_task' && a.title) {
          t = { id: uid(), title: cap(a.title), kind: KINDS[a.kind] ? a.kind : 'task', daily: !!a.daily, date: /^\d{4}-\d{2}-\d{2}$/.test(a.date || '') ? a.date : today(), time: a.time || '', due: a.due || '' };
          t.remind = !!(t.time || t.due); if (source === 'voice') t.voice = true;
          S.tasks.unshift(t);
        } else if (a.type === 'add_note' && a.text) {
          var n = addNote(a.text, !!a.sticker, source === 'voice');
          if (current() === 'notes') setTimeout(function () { flashNote(n.id); }, 50);
        } else if (a.type === 'complete' && (t = find(a.id))) {
          complete(t, true);
        } else if (a.type === 'delete' && (t = find(a.id))) {
          S.tasks = S.tasks.filter(function (x) { return x !== t; });
        } else if (a.type === 'update' && (t = find(a.id))) {
          ['title', 'kind', 'date', 'time', 'due', 'daily'].forEach(function (k) { if (a[k] !== undefined && a[k] !== null) t[k] = a[k]; });
          t.remind = !!(t.time || t.due); delete t.demo;
        } else if (a.type === 'show_plan') {
          UI.plan = true;
        }
      } catch (e) { /* пропускаем кривое действие */ }
    });
    save();
  }

  /* выполнение и архив */
  var lastDone = null;
  function complete(t, quiet) {
    if (t.daily) t.doneOn = today(); else { t.done = true; t.doneAt = Date.now(); }
    if (UI.toastFor === t.id) $('toast').hidden = true;
    lastDone = t.id;
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
    $('fillwave').setAttribute('d', d + ' L300 240 L0 240 Z');
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
    $('level').setAttribute('transform', 'translate(0 ' + Math.round(180 - pct * 125) + ')');

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
    $('ai-setup').textContent = S.aiKey ? 'AI подключён · изменить ключ' : 'Подключить AI';
    $('alarm-btn').textContent = S.alarmSet ? 'План в 08:00 · поставить заново' : 'Будильник плана в 08:00';
  }

  /* ---------- отрисовка: Заметки ---------- */
  function renderNotes() {
    var c = S.notes.length;
    $('notes-count').textContent = c + ' ' + (c % 10 === 1 && c % 100 !== 11 ? 'заметка' : (c % 10 >= 2 && c % 10 <= 4 && (c % 100 < 12 || c % 100 > 14)) ? 'заметки' : 'заметок');
    $('notes-list').innerHTML = c ? S.notes.map(function (n) {
      var d = new Date(n.created);
      var when = dstr(d) === today() ? 'сегодня ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : dateLabel(dstr(d));
      return '<div class="note" id="note-' + n.id + '"><div class="note-top"><div class="note-title">' + esc(n.title) + '</div><div class="note-when">' + esc(when) + '</div></div>' +
        '<div class="note-body">' + esc(n.body) + '</div>' +
        (n.converted.length ? '<div class="note-done"><span class="label-sm">Добавлено в дела</span>' + n.converted.map(function (x) { return '<div>✓ ' + esc(x) + '</div>'; }).join('') + '</div>' : '') +
        '<div class="note-acts">' +
        (n.converted.length ? '' : '<button type="button" class="chip" data-act="to-tasks" data-id="' + n.id + '"><svg width="16" height="16" viewBox="0 0 40 40" aria-hidden="true"><path d="M20.3 3.5 C21 11, 22 16.5, 29 19.2 C 22.5 21, 21.2 25.5, 20 36.2 C 18.8 26, 17.6 21.6, 10.8 20.4 C 17.8 18.8, 19.2 12, 20.3 3.5 Z" fill="none" stroke="#1C1A3A" stroke-width="2.6" stroke-linejoin="round"/></svg>Разобрать в дела</button>') +
        '<button type="button" class="chip" data-act="pin" data-id="' + n.id + '">' + (n.pinned ? 'Снять стикер' : 'На стикер') + '</button>' +
        '<button type="button" class="link-btn danger" data-act="del-note" data-id="' + n.id + '">Удалить</button>' +
        '</div></div>';
    }).join('') : '<div class="empty">Заметок пока нет — напиши или нажми микрофон</div>';
  }
  function flashNote(id) {
    var el = $('note-' + id); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  /* ---------- экраны ---------- */
  function current() { return location.hash === '#notes' ? 'notes' : 'main'; }
  function route() {
    var v = current();
    $('view-main').hidden = v !== 'main';
    $('view-notes').hidden = v !== 'notes';
    if (v === 'notes') renderNotes(); else renderMain();
    window.scrollTo(0, 0);
  }

  /* ---------- уведомление ---------- */
  var toastTimer = null;
  function toast(title, sub, keep, taskId, undo) {
    UI.toastFor = taskId || null;
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
    var appUrl = location.href.split('#')[0];
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dela//RU', 'BEGIN:VEVENT', 'UID:morning-plan@dela',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
      'DTSTART;TZID=Asia/Baku:' + addDays(today(), 1).replace(/-/g, '') + 'T080000',
      'DURATION:PT10M', 'RRULE:FREQ=DAILY', 'SUMMARY:План дня — открой «Дела»', 'URL:' + appUrl, 'DESCRIPTION:' + appUrl,
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:План дня готов — открой «Дела»', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
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
        t = find(lastDone); if (t) { uncomplete(t); lastDone = null; $('toast').hidden = true; renderMain(); }
        break;
      case 'archive-toggle': UI.archiveOpen = !UI.archiveOpen; renderMain(); break;
      case 'archive-clear':
        if (armed(el)) { S.tasks = S.tasks.filter(function (x) { return x.daily || !x.done; }); save(); UI.archiveOpen = false; renderMain(); }
        break;
      case 'sync': SYNC.press(); break;
      case 'alarm':
        if (IN_FRAME) { toast('Будильник плана', 'Работает в приложении с экрана «Домой»'); break; }
        morningAlarm(); toast('Будильник на 08:00', 'Нажми «Добавить» в календаре'); renderMain();
        break;
      case 'ai-setup':
        ask(S.aiKey ? 'Ключ AI (пусто — отключить)' : 'Вставь ключ Google AI Studio целиком', S.aiKey || '', function (v) {
          v = v.replace(/\s+/g, '').replace(/^["'«]+|["'»]+$/g, '');
          S.aiKey = v; S.geminiModels = null; save(); renderMain();
          if (!v) { toast('AI отключён', 'Работаю без AI'); return; }
          if (!/^sk-ant/.test(v)) {
            toast('Проверяю ключ…', '', true);
            geminiPick(v).then(function (ls) {
              S.geminiModels = ls; save();
              toast('AI подключён ✓', 'Google Gemini, модель ' + ls[0] + '. Спроси что-нибудь в строке «Напиши AI»');
            }).catch(function (e) {
              var m = String(e.message || e);
              var hint = m.slice(0, 120);
              toast(aiErrorTitle(m), hint, true);
            });
          } else toast('AI подключён', 'Claude. Спроси что-нибудь в строке «Напиши AI»');
        });
        break;
      case 'bell':
        t = find(id); t.remind = !t.remind; if (t.remind) askNotify(); save(); renderMain(); break;
      case 'edit': openSheet(find(id)); break;
      case 'new-task': openSheet(null); break;
      case 'close-sheet': closeSheet(); closeMini(); break;
      case 'close-mini': closeMini(); break;
      case 'delete-task':
        if (UI.editing && armed(el)) { delete el.dataset.armed; el.textContent = 'Удалить'; S.tasks = S.tasks.filter(function (x) { return x.id !== UI.editing; }); save(); closeSheet(); renderMain(); toast('Дело удалено', ''); }
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
      case 'open-note': location.hash = '#notes'; setTimeout(function () { flashNote(id); }, 120); break;
      case 'go-main': e.preventDefault(); location.hash = ''; break;
      case 'pin': n = findNote(id); n.pinned = !n.pinned; save(); renderNotes(); break;
      case 'del-note':
        if (armed(el)) { S.notes = S.notes.filter(function (x) { return x.id !== id; }); save(); renderNotes(); }
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
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { checkReminders(); } });

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

  /* ---------- синхронизация через Google Drive (скрытая папка приложения) ---------- */
  var GOOGLE_CLIENT_ID = '';
  var SYNC = (function () {
    var TOKEN_KEY = 'dela.gtoken', FILE = 'dela-sync.json';
    var SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
    var busy = false, again = false, timer = null;
    function appUrl() { return location.origin + location.pathname; }
    function getToken() {
      try { var t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); if (t && t.exp > Date.now() + 60e3) return t.v; } catch (e) { /* нет */ }
      return null;
    }
    function on() { return !!(S.sync && S.sync.on && GOOGLE_CLIENT_ID); }
    function auth(silent) {
      if (!GOOGLE_CLIENT_ID) return;
      S.sync = S.sync || {}; S.sync.on = true; S.sync.tried = Date.now(); store();
      var p = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, redirect_uri: appUrl(), response_type: 'token', scope: SCOPE, include_granted_scopes: 'true', state: 'dela-sync' });
      if (silent) p.set('prompt', 'none');
      if (S.sync.email) p.set('login_hint', S.sync.email);
      location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
    }
    function readRedirect() {
      if (location.hash.indexOf('state=dela-sync') < 0) return;
      var h = new URLSearchParams(location.hash.slice(1));
      history.replaceState(null, '', appUrl());
      if (h.get('access_token')) {
        try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ v: h.get('access_token'), exp: Date.now() + (+h.get('expires_in') || 3600) * 1000 })); } catch (e) { /* нет места */ }
        S.sync = S.sync || {}; S.sync.on = true; S.sync.needLogin = false; store();
        S.sync.justLinked = true;
      } else if (h.get('error')) {
        S.sync = S.sync || {}; S.sync.needLogin = true; store();
      }
    }
    function api(method, url, body, type) {
      var tok = getToken();
      if (!tok) return Promise.reject(new Error('no-token'));
      var o = { method: method, headers: { Authorization: 'Bearer ' + tok } };
      if (body !== undefined) { o.body = body; o.headers['Content-Type'] = type || 'application/json'; }
      return fetch(url, o).then(function (r) {
        if (r.status === 401) { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* нет */ } throw new Error('no-token'); }
        if (!r.ok) return r.text().then(function (t) { throw new Error('drive ' + r.status + ' ' + t.slice(0, 80)); });
        return r.status === 204 ? null : r.json();
      });
    }
    function findFile() {
      if (S.sync.fileId) return Promise.resolve(S.sync.fileId);
      return api('GET', 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&q=' + encodeURIComponent("name='" + FILE + "'")).then(function (j) {
        var f = j.files && j.files[0];
        if (f) { S.sync.fileId = f.id; store(); return f.id; }
        return null;
      });
    }
    function create() {
      var b = 'dela' + Date.now();
      var body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: FILE, parents: ['appDataFolder'] }) +
        '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(payload()) + '\r\n--' + b + '--';
      return api('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', body, 'multipart/related; boundary=' + b)
        .then(function (j) { S.sync.fileId = j.id; store(); });
    }
    function run() {
      if (!on() || !navigator.onLine) return Promise.resolve();
      if (!getToken()) {
        if (!S.sync.needLogin && Date.now() - (S.sync.tried || 0) > 5 * 60e3) auth(true);
        render(); return Promise.resolve();
      }
      if (busy) { again = true; return Promise.resolve(); }
      busy = true;
      return findFile().then(function (id) {
        if (!id) {
          if (S.sync.firstLink) dropDemo();
          return create();
        }
        return api('GET', 'https://www.googleapis.com/drive/v3/files/' + id + '?alt=media').then(function (R) {
          if (S.sync.firstLink && R && ((R.tasks || []).length || (R.notes || []).length)) dropDemo();
          var before = JSON.stringify([S.tasks, S.notes, S.place, S.aiKey]);
          var remoteStr = JSON.stringify([R.tasks, R.notes, R.place, R.aiKey]);
          mergeRemote(R || {});
          var after = JSON.stringify([S.tasks, S.notes, S.place, S.aiKey]);
          if (after !== before) rerender();
          if (after !== remoteStr) return api('PATCH', 'https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media', JSON.stringify(payload()));
        }).catch(function (e) {
          if (/drive 404/.test(e.message)) { S.sync.fileId = null; store(); }
          throw e;
        });
      }).then(function () {
        S.sync.firstLink = false; S.sync.last = Date.now(); S.sync.err = ''; store();
      }).catch(function (e) {
        S.sync.err = e.message === 'no-token' ? '' : e.message; store();
      }).then(function () {
        busy = false; render();
        if (again) { again = false; return run(); }
      });
    }
    function dropDemo() {
      S.tasks = S.tasks.filter(function (x) { return !x.demo; });
      S.notes = S.notes.filter(function (x) { return !x.demo; });
      takeSnap(); store();
    }
    function rerender() { if (current() === 'notes') renderNotes(); else renderMain(); }
    function render() {
      var b = $('sync-btn'); if (!b) return;
      if (!GOOGLE_CLIENT_ID) { b.hidden = true; return; }
      b.hidden = false;
      var s = S.sync || {};
      if (!s.on) b.textContent = 'Синхронизация с Google';
      else if (s.needLogin) b.textContent = 'Google: войти снова';
      else if (s.err) b.textContent = 'Google: ошибка, нажми ещё раз';
      else if (s.last) b.textContent = 'Google ✓ ' + pad(new Date(s.last).getHours()) + ':' + pad(new Date(s.last).getMinutes());
      else b.textContent = 'Google: синхронизирую…';
    }
    function schedule() { if (!on()) return; clearTimeout(timer); timer = setTimeout(run, 1500); }
    function press() {
      if (!S.sync || !S.sync.on || S.sync.needLogin || !getToken()) {
        S.sync = S.sync || {}; if (!S.sync.on) S.sync.firstLink = true;
        auth(false); return;
      }
      run(); toast('Синхронизирую', 'Дела и заметки — с Google Drive');
    }
    return { readRedirect: readRedirect, run: run, schedule: schedule, render: render, press: press };
  })();
  window.DelaSync = SYNC;
  SYNC.readRedirect();
  if (S.sync && S.sync.justLinked) { delete S.sync.justLinked; store(); setTimeout(function () { toast('Google подключён', 'Дела синхронизируются автоматически'); }, 400); }
  SYNC.render();
  SYNC.run();
  setInterval(function () { if (!document.hidden) SYNC.run(); }, 60e3);
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
