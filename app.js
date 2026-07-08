/* ===== Retal Tasks — المنطق المشترك ===== */
const STORE_KEY = 'retal_tasks_v1';

const loadTasks = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY)) || [];
    // ترقية المهام القديمة اللي ما فيها وقت/تكرار
    return raw.map((t) => ({ time: '', repeat: 'none', ...t }));
  } catch { return []; }
};
const saveTasks = (tasks) => localStorage.setItem(STORE_KEY, JSON.stringify(tasks));

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => toDateStr(new Date());
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return toDateStr(d); };

const arabicDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('ar', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(y, m - 1, d));
};
const arabicTime = (hm) => {
  const [h, mi] = hm.split(':').map(Number);
  return new Date(2000, 0, 1, h, mi).toLocaleTimeString('ar', { hour: 'numeric', minute: '2-digit' });
};

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

let tasks = loadTasks();

/* ===== الأصوات التحفيزية 🎵 (مولّدة داخل المتصفح، بدون ملفات) ===== */
let audioCtx = null;
const playNotes = (notes) => {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    for (const [freq, start, dur] of notes) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.linearRampToValueAtTime(0.22, t0 + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.05);
    }
  } catch { /* الصوت كماليات — ما نكسر التطبيق لو انمنع */ }
};
// رنة إنجاز مهمة: دو-مي-صول صاعدة ومبهجة
const soundDone = () => playNotes([[523.25, 0, .18], [659.25, .09, .18], [783.99, .18, .32]]);
// لحن الاحتفال عند إكمال كل المهام
const soundCelebrate = () => playNotes([
  [523.25, 0, .15], [659.25, .12, .15], [783.99, .24, .15],
  [1046.5, .36, .4], [783.99, .58, .18], [1046.5, .74, .55],
]);
// رنة التذكير اللطيفة
const soundReminder = () => playNotes([[880, 0, .2], [1174.66, .16, .38]]);

/* ===== التوست (رسائل لطيفة داخل التطبيق) ===== */
const showToast = (msg) => {
  const layer = document.getElementById('toast-layer');
  if (!layer) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  layer.appendChild(el);
  setTimeout(() => el.classList.add('hide'), 3800);
  setTimeout(() => el.remove(), 4400);
};

const PRAISES = [
  'أحسنتِ يا بطلة! 👏',
  'واو! وحدة خلصت ✨',
  'شغل عالي يا ريتال! 💖',
  'استمري، أنتِ رائعة 🌟',
  'يا سلااام عليكِ! 🎀',
  'إنجاز جديد يا قمر 🦋',
];
const randomPraise = () => PRAISES[Math.floor(Math.random() * PRAISES.length)];

/* ===== إشعارات النظام ===== */
const initNotifyButton = () => {
  const btn = document.getElementById('notify-btn');
  if (!btn) return;
  const refresh = () => {
    if (!('Notification' in window)) { btn.textContent = '🔕'; btn.title = 'التذكير يظهر داخل التطبيق فقط'; return; }
    if (Notification.permission === 'granted') { btn.classList.add('on'); btn.title = 'الإشعارات مفعّلة ✨'; }
  };
  btn.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      showToast('متصفحك ما يدعم إشعارات النظام — بس التذكير بيظهر داخل التطبيق 💌');
      return;
    }
    if (Notification.permission === 'granted') {
      showToast('الإشعارات مفعّلة من قبل ✨');
      try { new Notification('Retal Tasks 🎀', { body: 'هذا شكل التنبيه! بنذكّرك بمهامك بكل حب 💖' }); } catch {}
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      showToast('يااي! الإشعارات اشتغلت 🔔💖');
      try { new Notification('Retal Tasks 🎀', { body: 'بنذكّرك بمهامك بكل حب 💖' }); } catch {}
    } else {
      showToast('المتصفح ما سمح بالإشعارات — بس التذكير بيظهر داخل التطبيق 💌');
    }
    refresh();
  });
  refresh();
};

/* ===== التذكير بموعد المهمة ⏰ ===== */
const notifyTask = (t) => {
  soundReminder();
  const msg = `⏰ يا قمر، حان وقت "${t.title}" ${t.emoji} — أنتِ قدها! 💪`;
  showToast(msg);
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Retal Tasks 🎀', { body: msg, tag: t.id }); } catch {}
  }
};

let rerenderPage = () => {};
const checkReminders = () => {
  const now = new Date();
  const nowHM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const today = todayStr();
  let changed = false;
  for (const t of tasks) {
    if (t.done || !t.time || t.date !== today || t.notifiedOn === today) continue;
    if (t.time <= nowHM) {
      notifyTask(t);
      t.notifiedOn = today;
      changed = true;
    }
  }
  if (changed) saveTasks(tasks);
};

/* ===== تدوير المهام المتكررة 🔁 ===== */
/* المهمة المتكررة اللي عدّى تاريخها تنتقل تلقائيًا لموعدها الجاي وترجع غير منجزة */
const REPEAT_LABEL = { daily: 'كل يوم', weekly: 'كل أسبوع', monthly: 'كل شهر' };
const rollForwardRepeats = () => {
  const today = todayStr();
  let changed = false;
  for (const t of tasks) {
    if (!t.repeat || t.repeat === 'none' || t.date >= today) continue;
    const [y, m, d] = t.date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    while (toDateStr(dt) < today) {
      if (t.repeat === 'daily') dt.setDate(dt.getDate() + 1);
      else if (t.repeat === 'weekly') dt.setDate(dt.getDate() + 7);
      else dt.setMonth(dt.getMonth() + 1);
    }
    t.date = toDateStr(dt);
    t.done = false;
    delete t.notifiedOn;
    changed = true;
  }
  if (changed) saveTasks(tasks);
  return changed;
};

const toggleTask = (id, done) => {
  const t = tasks.find((t) => t.id === id);
  if (t) { t.done = done; saveTasks(tasks); }
};
const deleteTask = (id) => {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks(tasks);
};

const sortByTime = (list) => [...list].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

const taskItemHtml = (t) => {
  const badges = [
    t.time ? `<span class="task-badge">⏰ ${arabicTime(t.time)}</span>` : '',
    t.repeat && t.repeat !== 'none' ? `<span class="task-badge repeat">🔁 ${REPEAT_LABEL[t.repeat]}</span>` : '',
  ].filter(Boolean).join('');
  return `
  <li class="task-item ${t.done ? 'done' : ''}" data-id="${t.id}">
    <input type="checkbox" class="task-check" ${t.done ? 'checked' : ''} title="خلصتيها؟">
    <span class="task-cat">${t.emoji}</span>
    <div class="task-body">
      <span class="task-text">${escapeHtml(t.title)}</span>
      ${badges ? `<div class="task-badges">${badges}</div>` : ''}
    </div>
    <button class="task-del" title="احذفي المهمة">🗑️</button>
  </li>`;
};

let suppressChime = false; // عشان ما تتراكب رنة المهمة مع لحن الاحتفال
const bindListEvents = (listEl, onChange) => {
  listEl.addEventListener('change', (e) => {
    if (!e.target.classList.contains('task-check')) return;
    const checked = e.target.checked;
    toggleTask(e.target.closest('.task-item').dataset.id, checked);
    onChange();
    if (checked) {
      if (!suppressChime) { soundDone(); showToast(randomPraise()); }
      suppressChime = false;
    }
  });
  listEl.addEventListener('click', (e) => {
    const del = e.target.closest('.task-del');
    if (!del) return;
    deleteTask(del.closest('.task-item').dataset.id);
    onChange();
  });
};

/* ===== صفحة خطتي (index.html) ===== */
const initPlanPage = () => {
  const form = document.getElementById('add-form');
  const titleInput = document.getElementById('task-title');
  const emojiSelect = document.getElementById('task-emoji');
  const dateInput = document.getElementById('task-date');
  const timeInput = document.getElementById('task-time');
  const repeatSelect = document.getElementById('task-repeat');
  const groupsEl = document.getElementById('groups');

  dateInput.value = todayStr();

  const groupLabel = (dateStr) => {
    if (dateStr === todayStr()) return `🌞 اليوم — ${arabicDate(dateStr)}`;
    if (dateStr === tomorrowStr()) return `🌙 غدًا — ${arabicDate(dateStr)}`;
    return `📅 ${arabicDate(dateStr)}`;
  };

  const render = () => {
    if (!tasks.length) {
      groupsEl.innerHTML = `<div class="card"><p class="empty-state">قائمتك فاضية! ابدئي بإضافة أول مهمة من فوق 🌸✨</p></div>`;
      return;
    }
    const byDate = {};
    for (const t of tasks) (byDate[t.date] ||= []).push(t);
    const dates = Object.keys(byDate).sort();
    const today = todayStr();

    groupsEl.innerHTML = dates.map((date) => {
      const list = sortByTime(byDate[date]);
      const doneCount = list.filter((t) => t.done).length;
      const overdue = date < today;
      return `
        <div class="card">
          <div class="group-header">
            <span class="group-title ${overdue ? 'overdue' : ''}">${overdue ? `😅 فاتت — ${arabicDate(date)}` : groupLabel(date)}</span>
            <span class="group-count">${doneCount} / ${list.length} ✔</span>
          </div>
          <ul class="task-list">${list.map(taskItemHtml).join('')}</ul>
        </div>`;
    }).join('');
  };
  rerenderPage = render;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title || !dateInput.value) return;
    tasks.push({
      id: `t${Date.now()}${Math.floor(Math.random() * 1e4)}`,
      title,
      emoji: emojiSelect.value,
      date: dateInput.value,
      time: timeInput.value || '',
      repeat: repeatSelect.value,
      done: false,
    });
    saveTasks(tasks);
    titleInput.value = '';
    timeInput.value = '';
    titleInput.focus();
    render();
  });

  bindListEvents(groupsEl, render);
  render();
};

/* ===== صفحة مهام اليوم (today.html) ===== */
const MOODS = [
  { min: 0,   emoji: '🐣', msg: 'يلا يا قمر، نبدأ أول مهمة! 💪' },
  { min: 1,   emoji: '🦋', msg: 'بداية حلوة! استمري يا مبدعة 🌸' },
  { min: 40,  emoji: '⭐', msg: 'ما شاء الله! عديتي نص الطريق ✨' },
  { min: 70,  emoji: '🔥', msg: 'قربتي تخلصين يا بطلة! 💖' },
  { min: 100, emoji: '👑', msg: 'أسطووورة! خلصتي كل شي 🎉' },
];

const throwConfetti = () => {
  const layer = document.getElementById('confetti-layer');
  const emojis = ['🎉', '💖', '🌸', '✨', '🎀', '⭐', '🦋', '💜'];
  for (let i = 0; i < 45; i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    s.textContent = emojis[i % emojis.length];
    s.style.left = `${Math.random() * 100}%`;
    s.style.animationDuration = `${2 + Math.random() * 2.5}s`;
    s.style.animationDelay = `${Math.random() * 0.8}s`;
    layer.appendChild(s);
  }
  setTimeout(() => { layer.innerHTML = ''; }, 6000);
};

const initTodayPage = () => {
  const listEl = document.getElementById('today-list');
  const emptyEl = document.getElementById('today-empty');
  const fillEl = document.getElementById('progress-fill');
  const percentEl = document.getElementById('meter-percent');
  const msgEl = document.getElementById('meter-message');
  const countEl = document.getElementById('meter-count');
  const moodEmojiEl = document.getElementById('meter-emoji');

  const hour = new Date().getHours();
  document.getElementById('greeting').textContent =
    hour < 12 ? 'صباح الورد يا ريتال 🌸' : hour < 18 ? 'نهارك سعيد يا ريتال 🌷' : 'مساء الخير يا ريتال 🌙';
  document.getElementById('today-date').textContent = arabicDate(todayStr());

  let lastPercent = null;

  const render = () => {
    const todays = sortByTime(tasks.filter((t) => t.date === todayStr()));
    const done = todays.filter((t) => t.done).length;
    const percent = todays.length ? Math.round((done / todays.length) * 100) : 0;

    listEl.innerHTML = todays.map(taskItemHtml).join('');
    emptyEl.hidden = todays.length > 0;

    fillEl.style.width = `${percent}%`;
    percentEl.textContent = `${percent}%`;
    countEl.textContent = todays.length
      ? `أنجزتي ${done} من ${todays.length} مهام اليوم`
      : 'ما فيه مهام لليوم';

    const mood = [...MOODS].reverse().find((m) => percent >= m.min);
    moodEmojiEl.textContent = mood.emoji;
    msgEl.textContent = todays.length ? mood.msg : 'أضيفي مهام وخلينا نبدأ! 🎀';

    if (percent === 100 && todays.length && lastPercent !== null && lastPercent < 100) {
      throwConfetti();
      soundCelebrate();
      showToast('👑 أسطووورة! خلصتي كل مهام اليوم 🎉💖');
      suppressChime = true;
    }
    lastPercent = percent;
  };
  rerenderPage = render;

  bindListEvents(listEl, render);
  render();
};

/* ===== الإقلاع ===== */
rollForwardRepeats();
if (document.body.dataset.page === 'plan') initPlanPage();
else if (document.body.dataset.page === 'today') initTodayPage();
initNotifyButton();
checkReminders();
setInterval(() => { if (rollForwardRepeats()) rerenderPage(); checkReminders(); }, 20000);
