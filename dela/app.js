(function () {
  'use strict';

  /* ---------- утилиты ---------- */
  var KEY = 'dela.v1';
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
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* хранилище недоступно */ } }

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
    'Если на экране «Заметки» и фраза похожа на мысль — это заметка. Если в фразе есть поручение со сроком — это дело.'
  ].join('\n');
  function aiCommand(text, source) {
    setMode('think');
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': S.aiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 700, system: AI_SYSTEM, messages: [{ role: 'user', content: aiContext() + '\n\nМакс говорит: ' + text }] })
    }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status)); return j; });
    }).then(function (j) {
      var raw = (j.content || []).map(function (c) { return c.text || ''; }).join('');
      var m = raw.match(/\{[\s\S]*\}/);
      var out = m ? JSON.parse(m[0]) : { reply: raw, actions: [] };
      applyActions(out.actions || [], source);
      setMode('idle');
      showReply(out.reply || 'Готово.', source === 'voice' ? text : '');
    }).catch(function (err) {
      setMode('idle');
      var msg = String(err && err.message || err);
      if (/auth|api.key|401|invalid x-api-key/i.test(msg)) toast('AI: ключ не подходит', 'Проверь ключ — «Изменить ключ AI» внизу');
      else if (/credit|balance|billing/i.test(msg)) toast('AI: закончился баланс', 'Пополни счёт на console.anthropic.com');
      else toast('AI недоступен', 'Сделал без AI. ' + msg.slice(0, 60));
      showReply(localCommand(text, source), source === 'voice' ? text : '');
    });
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
    if (m !== 'idle') { $('ai-text').textContent = m === 'listen' ? 'Слушаю… отпусти, когда закончишь' : 'Думаю…'; $('ai-heard').hidden = true; }
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
    }).join('') : '<div class="empty">Заметок пока нет — напиши или зажми низ экрана</div>';
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
    var blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'delo.ics'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
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
    else { if (current() === 'main') renderMain(); toast('Не расслышал', 'Зажми низ экрана и говори, пока держишь'); }
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
        setTimeout(function () { complete(t); renderMain(); }, 350);
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
      case 'ai-setup':
        ask(S.aiKey ? 'Ключ Claude API (пусто — отключить AI)' : 'Вставь ключ Claude API (sk-ant-…)', S.aiKey || '', function (v) {
          v = v.trim();
          S.aiKey = v; save(); renderMain();
          toast(v ? 'AI подключён' : 'AI отключён', v ? 'Спроси что-нибудь в строке «Напиши AI»' : 'Работаю без AI');
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
  var vz = $('voice-zone');
  vz.addEventListener('pointerdown', voiceStart);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { vz.addEventListener(ev, voiceStop); });
  vz.addEventListener('contextmenu', function (e) { e.preventDefault(); });
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
  setInterval(checkReminders, 30000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
